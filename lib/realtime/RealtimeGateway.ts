import type { IncomingMessage, Server as HttpServerNode } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { DisplayRegistry } from '../display/DisplayRegistry';
import { normalizeClientIp } from '../display/ipNormalize';
import type { HomeyDeviceRepository } from '../homey/HomeyDeviceRepository';
import type { HomeyCapabilitySubscription } from '../homey/types';
import type { Logger, HttpResponse } from '../types';
import {
  createDashboardUiCopy,
  createEmptyStateCopy,
} from '../dashboard';
import { resolveLayoutId } from '../dashboard/layoutParse';
import { resolveDashboardTheme } from '../widgets/types';
import {
  resolveDashboardRuntime,
  resolveLightWidgetRuntimeFromSnapshot,
  createLightApiErrorRuntime,
  resolveCoverWidgetRuntimeFromSnapshot,
  createCoverApiErrorRuntime,
  parseOnoff,
  LIGHT_CAPABILITY_ID,
  LIGHT_DIM_CAPABILITY_ID,
  LIGHT_HUE_CAPABILITY_ID,
  LIGHT_SATURATION_CAPABILITY_ID,
  LIGHT_TEMPERATURE_CAPABILITY_ID,
  listPresentLightOptionalCapabilities,
  COVER_CAPABILITY_ID,
  COVER_STATE_CAPABILITY_ID,
  COVER_STOP_STATE_VALUE,
  evaluateCoverPositionConfirmation,
  evaluateLightPercentConfirmation,
  evaluateLightColorConfirmation,
  hasWindowcoveringsStateCapability,
  normalizeWindowcoveringsSet,
  normalizeHomeyUnitInterval,
  decodeLightColorExpected,
} from '../widgets';
import { DISPLAY_TYPE_IDS } from '../display/types';
import { REALTIME_PROTOCOL_VERSION, REALTIME_WEBSOCKET_PATH } from './constants';
import {
  extractReferencedCapabilitySubscriptions,
  subscriptionKey,
  type HomeyCapabilityRef,
} from './extractReferencedDeviceIds';
import {
  DisplayRealtimeSession,
} from './DisplayRealtimeSession';
import { PendingCommandManager } from './PendingCommandManager';
import { RealtimeMetrics } from './RealtimeMetrics';
import { RealtimeSessionManager } from './RealtimeSessionManager';
import {
  RealtimeSubscriptionManager,
  type HomeyCapabilitySubscriber,
} from './RealtimeSubscriptionManager';
import { WidgetCommandHandler } from './WidgetCommandHandler';
import type {
  DashboardSnapshotPayload,
  NotificationActionRejectReason,
  RealtimeUiCopy,
  ServerMessage,
} from './protocol';
import {
  NotificationManager,
  NotificationMediaSessionManager,
  NOTIFICATION_MEDIA_IMAGE_REF_CACHE_MS,
  type NotificationActionFlowTokens,
  type NotificationActionTriggerState,
  type NotificationChangeEvent,
  type PublishNotificationInput,
  type UpdateNotificationInput,
  type UpsertDisplayNotificationInput,
  type NotificationManagerResult,
  type DisplayNotification,
  type NotificationDiagnosticsSnapshot,
} from '../notifications';
import type { NotificationMediaResolver } from '../homey/NotificationMediaResolver';
import type { HomeyDeviceImageRef } from '../homey/parseHomeyMedia';
import {
  GenericBrowserCapabilityStore,
  parseGenericClientHello,
  PairingRealtimeSessionManager,
} from '../pairing';

export interface RealtimeGatewayOptions {
  readonly registry: DisplayRegistry;
  readonly deviceRepository: HomeyDeviceRepository;
  readonly capabilitySubscriber: HomeyCapabilitySubscriber;
  readonly logger: Logger;
  readonly translate: (key: string) => string;
  readonly getLanguage: () => string;
  /**
   * Called when active (SoT) notifications change for Displays.
   * Not fired for local dismiss.
   */
  readonly onNotificationAggregatesChanged?: (
    displayIds: readonly string[],
  ) => void;
  /**
   * Fire Homey Device Flow Trigger for a validated notification action.
   */
  readonly onNotificationActionPressed?: (input: {
    readonly displayId: string;
    readonly tokens: NotificationActionFlowTokens;
    readonly state: NotificationActionTriggerState;
  }) => Promise<void>;
  readonly mediaResolver?: NotificationMediaResolver | null;
  readonly genericBrowserCapabilities?: GenericBrowserCapabilityStore | null;
}

/**
 * Owns WebSocket upgrade, DisplaySession binding, Homey subscriptions,
 * selective event routing, widget commands, and live configuration push.
 */
export class RealtimeGateway {
  private readonly registry: DisplayRegistry;
  private readonly deviceRepository: HomeyDeviceRepository;
  private readonly capabilitySubscriber: HomeyCapabilitySubscriber;
  private readonly logger: Logger;
  private readonly translate: (key: string) => string;
  private readonly getLanguage: () => string;
  private readonly onNotificationAggregatesChanged:
    | ((displayIds: readonly string[]) => void)
    | null;
  private readonly onNotificationActionPressed:
    | ((input: {
        readonly displayId: string;
        readonly tokens: NotificationActionFlowTokens;
        readonly state: NotificationActionTriggerState;
      }) => Promise<void>)
    | null;
  private readonly mediaResolver: NotificationMediaResolver | null;
  private readonly genericBrowserCapabilities: GenericBrowserCapabilityStore;
  private readonly pairingSockets: PairingRealtimeSessionManager;
  private readonly notificationImageRefCache = new Map<
    string,
    { readonly image: HomeyDeviceImageRef; readonly expiresAt: number }
  >();

  public readonly metrics = new RealtimeMetrics();
  public readonly notifications: NotificationManager;
  public readonly mediaSessions = new NotificationMediaSessionManager();
  private readonly sessions: RealtimeSessionManager;
  private readonly subscriptions: RealtimeSubscriptionManager;
  private readonly pendingCommands: PendingCommandManager;
  private readonly commandHandler: WidgetCommandHandler;

  private wss: WebSocketServer | null = null;
  private httpServer: HttpServerNode | null = null;
  private upgradeHandler:
    | ((request: IncomingMessage, socket: Duplex, head: Buffer) => void)
    | null = null;
  private active = false;

  public constructor(options: RealtimeGatewayOptions) {
    this.registry = options.registry;
    this.deviceRepository = options.deviceRepository;
    this.capabilitySubscriber = options.capabilitySubscriber;
    this.logger = options.logger;
    this.translate = options.translate;
    this.getLanguage = options.getLanguage;
    this.onNotificationAggregatesChanged =
      options.onNotificationAggregatesChanged ?? null;
    this.onNotificationActionPressed =
      options.onNotificationActionPressed ?? null;
    this.mediaResolver = options.mediaResolver ?? null;
    this.genericBrowserCapabilities =
      options.genericBrowserCapabilities ?? new GenericBrowserCapabilityStore();
    this.pairingSockets = new PairingRealtimeSessionManager(this.logger);

    this.pendingCommands = new PendingCommandManager({
      onTimeout: (command) => {
        this.metrics.recordCommandTimedOut();
        if (
          command.action === 'set-position' ||
          command.action === 'stop'
        ) {
          this.metrics.recordCoverCommandTimedOut();
        } else if (
          command.action === 'toggle' ||
          command.action === 'set-dim' ||
          command.action === 'set-temperature' ||
          command.action === 'set-color'
        ) {
          this.metrics.recordLightCommandTimedOut();
        }
        this.syncPendingMetrics();
        this.logger.warn('Command timed out', {
          displayId: command.displayId,
          widgetId: command.widgetId,
          action: command.action,
          requestId: command.requestId,
        });
        this.sessions.sendToDisplay(command.displayId, {
          type: 'command-timeout',
          requestId: command.requestId,
        });
      },
    });

    this.commandHandler = new WidgetCommandHandler({
      registry: this.registry,
      deviceRepository: this.deviceRepository,
      pending: this.pendingCommands,
      metrics: this.metrics,
      logger: this.logger,
    });

    this.notifications = new NotificationManager({
      onChange: (event) => {
        this.handleNotificationChange(event);
      },
    });

    this.sessions = new RealtimeSessionManager({
      metrics: this.metrics,
      logger: this.logger,
      onSessionOpened: (session) => {
        this.registry.markRealtimeConnected(session.displayId, {
          connectionId: session.connectionId,
          connectedAt: session.connectedAt,
          remoteAddress: session.remoteAddress,
        });
      },
      onSessionClosed: (session) => {
        void this.handleSessionClosed(session);
      },
      onClientMessage: (session, message) => {
        if (message.type === 'heartbeat-ack') {
          this.registry.markRealtimeHeartbeat(session.displayId);
          return;
        }
        if (message.type === 'widget-action') {
          void this.handleWidgetAction(session, message);
          return;
        }
        if (message.type === 'notification-dismiss') {
          this.handleNotificationDismiss(session, message.notificationId);
          return;
        }
        if (message.type === 'notification-center-opened') {
          this.metrics.recordNotificationCenterOpened();
          return;
        }
        if (message.type === 'notification-auto-opened') {
          this.metrics.recordNotificationAutoOpened();
          this.logger.info('Notification auto-open', {
            displayId: session.displayId,
          });
          return;
        }
        if (message.type === 'notification-auto-closed') {
          this.metrics.recordNotificationAutoClosed();
          this.logger.info('Notification auto-close fired', {
            displayId: session.displayId,
          });
          return;
        }
        if (message.type === 'notification-action') {
          void this.handleNotificationAction(session, message);
          return;
        }
        if (message.type === 'notification-media-start') {
          void this.handleNotificationMediaStart(
            session,
            message.notificationId,
          );
          return;
        }
        if (message.type === 'notification-media-stop') {
          this.handleNotificationMediaStop(session, message.notificationId);
          return;
        }
        if (message.type === 'notification-media-telemetry') {
          this.handleNotificationMediaTelemetry(session, message);
        }
      },
      onGenericClientHello: (session, hello) => {
        this.handleGenericClientHello(session.displayId, session.remoteAddress, hello);
      },
    });

    this.subscriptions = new RealtimeSubscriptionManager({
      subscriber: this.capabilitySubscriber,
      metrics: this.metrics,
      logger: this.logger,
      onCapabilityValue: (event) => {
        void this.handleCapabilityValue(
          event.deviceId,
          event.capabilityId,
          event.value,
        );
      },
      onDeviceRemoved: (deviceId, capabilityId) => {
        void this.handleDeviceRemoved(deviceId, capabilityId);
      },
    });
  }

  public getGenericBrowserCapabilities(): GenericBrowserCapabilityStore {
    return this.genericBrowserCapabilities;
  }

  public notifyGenericPairingCompleted(ipAddress: string): void {
    this.pairingSockets.notifyPairingCompleted(ipAddress);
  }

  public isActive(): boolean {
    return this.active && this.wss !== null;
  }

  public getMetrics() {
    this.syncPendingMetrics();
    const base = this.metrics.snapshot();
    const notifications = this.notifications.getDiagnostics();
    return {
      ...base,
      notificationsPublished: notifications.notificationsPublished,
      notificationsUpdated: notifications.notificationsUpdated,
      notificationsRemoved: notifications.notificationsRemoved,
      notificationsDismissedLocally:
        notifications.notificationsDismissedLocally,
      notificationMessagesSent: Math.max(
        base.notificationMessagesSent,
        notifications.notificationMessagesSent,
      ),
      mediaResolveAttempts:
        this.mediaResolver?.metrics.resolveAttempts ??
        base.mediaResolveAttempts,
      mediaResolveSuccess:
        this.mediaResolver?.metrics.resolveSuccess ?? base.mediaResolveSuccess,
      mediaResolveFailures:
        this.mediaResolver?.metrics.resolveFailures ??
        base.mediaResolveFailures,
      activeMediaSessions: this.mediaSessions.getActiveCount(),
    };
  }

  public listSessions() {
    return this.sessions.list();
  }

  public listSubscriptions() {
    return this.subscriptions.listDiagnostics();
  }

  public hasActiveSession(displayId: string): boolean {
    return this.sessions.hasActiveSession(displayId);
  }

  /**
   * Attach to the Node HTTP server (same port). Safe to call again after restart.
   */
  public attach(httpServer: HttpServerNode): void {
    this.detach();

    this.httpServer = httpServer;
    this.wss = new WebSocketServer({ noServer: true });
    this.active = true;

    this.upgradeHandler = (request, socket, head) => {
      void this.handleUpgrade(request, socket, head);
    };

    httpServer.on('upgrade', this.upgradeHandler);

    this.logger.info('WebSocket realtime gateway attached', {
      path: REALTIME_WEBSOCKET_PATH,
    });
  }

  public detach(): void {
    if (this.httpServer && this.upgradeHandler) {
      this.httpServer.off('upgrade', this.upgradeHandler);
    }

    this.sessions.closeAll(1001, 'server_restart');
    this.pendingCommands.destroy();
    this.pairingSockets.clear();

    if (this.wss) {
      try {
        for (const client of this.wss.clients) {
          try {
            client.terminate();
          } catch {
            // ignore
          }
        }
        this.wss.close();
      } catch {
        // ignore
      }
    }

    this.wss = null;
    this.httpServer = null;
    this.upgradeHandler = null;
    this.active = false;
  }

  public async destroy(): Promise<void> {
    this.detach();
    await this.subscriptions.destroy();
    this.mediaSessions.reset();
    this.notifications.reset();
    this.metrics.reset();
    this.notificationImageRefCache.clear();
  }

  /**
   * Flow-ready API: publish a notification to one or more Displays.
   */
  public publishNotification(
    input: PublishNotificationInput,
  ): NotificationManagerResult<DisplayNotification> {
    return this.notifications.publishNotification(input);
  }

  public updateNotification(
    input: UpdateNotificationInput,
  ): NotificationManagerResult<DisplayNotification> {
    return this.notifications.updateNotification(input);
  }

  public removeNotification(
    notificationId: string,
  ): NotificationManagerResult<true> {
    return this.notifications.removeNotification(notificationId);
  }

  public getNotificationDiagnostics(): NotificationDiagnosticsSnapshot {
    const base = this.notifications.getDiagnostics();
    return {
      ...base,
      mediaSessions: this.mediaSessions.list().map((session) => ({
        displayId: session.displayId,
        notificationId: session.notificationId,
        notificationKey: session.notificationKey ?? null,
        deviceName: session.deviceName,
        playback: session.playback,
        resolvedType: session.videoKind ?? session.playback,
        fallbackAvailable: session.fallbackAvailable,
        state: session.state,
      })),
    };
  }

  public upsertForDisplay(
    input: UpsertDisplayNotificationInput,
  ): NotificationManagerResult<DisplayNotification> & {
    readonly created?: boolean;
  } {
    return this.notifications.upsertForDisplay(input);
  }

  public removeNotificationByKey(
    displayId: string,
    notificationKey: string,
  ): NotificationManagerResult<{ readonly removed: boolean }> {
    return this.notifications.removeByKey(displayId, notificationKey);
  }

  public removeAllNotificationsForDisplay(
    displayId: string,
  ): NotificationManagerResult<{ readonly removedCount: number }> {
    return this.notifications.removeAllForDisplay(displayId);
  }

  /**
   * Called after a dashboard configuration is saved.
   * Sequence: update subscriptions → resolve runtime → send complete config.
   * Offline displays receive nothing (no message queue); reconnect gets a full snapshot.
   */
  public async notifyDashboardConfigurationChanged(
    displayId: string,
  ): Promise<void> {
    const entry = this.registry.getById(displayId);
    if (!entry) {
      return;
    }

    const subscriptions = await this.resolveCapabilitySubscriptions(
      entry.config.dashboard,
    );

    if (this.sessions.hasActiveSession(displayId)) {
      await this.subscriptions.setDisplaySubscriptions(displayId, subscriptions);
      this.registry.markRealtimeSubscribedDevices(
        displayId,
        subscriptions.length,
      );

      const runtime = await resolveDashboardRuntime({
        widgets: entry.config.dashboard.widgets,
        repository: this.deviceRepository,
        logger: this.logger,
      });

      this.registry.markLightWidgetDiagnostics(
        displayId,
        runtime.lightDiagnostics,
      );
      this.registry.markCoverWidgetDiagnostics(
        displayId,
        runtime.coverDiagnostics,
      );

      this.sessions.sendToDisplay(displayId, {
        type: 'dashboard-configuration',
        configuration: entry.config.dashboard,
        widgetStates: runtime.states,
        theme: resolveDashboardTheme(entry.config.dashboard.theme),
      });
    }
  }

  public async notifyDisplayRemoved(displayId: string): Promise<void> {
    this.mediaSessions.stopAllForDisplay(displayId);
    this.metrics.setActiveMediaSessions(this.mediaSessions.getActiveCount());
    this.sessions.closeDisplay(displayId, 1001, 'display_removed');
    await this.subscriptions.removeDisplay(displayId);
    this.notifications.removeDisplay(displayId);
    this.registry.markRealtimeDisconnected(displayId);
    this.genericBrowserCapabilities.remove(displayId);
  }

  private async handleWidgetAction(
    session: DisplayRealtimeSession,
    message: Extract<
      import('./protocol').ClientMessage,
      { readonly type: 'widget-action' }
    >,
  ): Promise<void> {
    if (!session.isOpen()) {
      return;
    }

    const result = await this.commandHandler.handle({
      displayId: session.displayId,
      widgetId: message.widgetId,
      action: message.action,
      requestId: message.requestId,
      positionPercent:
        message.action === 'set-position'
          ? message.positionPercent
          : undefined,
      valuePercent:
        message.action === 'set-dim' || message.action === 'set-temperature'
          ? message.valuePercent
          : undefined,
      huePercent:
        message.action === 'set-color' ? message.huePercent : undefined,
      saturationPercent:
        message.action === 'set-color' ? message.saturationPercent : undefined,
    });

    this.syncPendingMetrics();

    if (!session.isOpen()) {
      // Socket dropped while Homey API was in flight — drop pending, no replay.
      this.pendingCommands.cancel(message.requestId);
      this.syncPendingMetrics();
      return;
    }

    if (!result.ok) {
      session.send({
        type: 'command-rejected',
        requestId: message.requestId,
        reason: result.reason,
      });
      return;
    }

    session.send({
      type: 'command-accepted',
      requestId: message.requestId,
    });
  }

  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    if (!this.wss) {
      socket.destroy();
      return;
    }

    const path = pathOnly(request.url ?? '/');
    if (path !== REALTIME_WEBSOCKET_PATH) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const remoteAddress = normalizeClientIp(
      request.socket.remoteAddress ?? 'unknown',
    );
    const entry = this.registry.findByIp(remoteAddress);

    if (!entry) {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.acceptPairingConnection(ws, remoteAddress);
      });
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      void this.acceptConnection(ws, entry.config.displayId, remoteAddress);
    });
  }

  private acceptPairingConnection(
    socket: WebSocket,
    remoteAddress: string,
  ): void {
    this.pairingSockets.register(remoteAddress, socket);

    socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      const raw = Buffer.isBuffer(data)
        ? data.toString('utf8')
        : Array.isArray(data)
          ? Buffer.concat(data).toString('utf8')
          : Buffer.from(data).toString('utf8');

      if (this.pairingSockets.handleMessage(remoteAddress, socket, raw)) {
        return;
      }

      if (isUnpairedPrivilegedMessage(raw)) {
        this.logger.warn('Rejected privileged message from unpaired client', {
          remoteAddress,
        });
      }
    });

    this.logger.info('Pairing realtime session opened', { remoteAddress });
  }

  private handleGenericClientHello(
    displayId: string,
    remoteAddress: string,
    raw: unknown,
  ): void {
    const hello = parseGenericClientHello(raw);
    if (!hello) {
      this.logger.warn('Invalid generic client hello', { displayId, remoteAddress });
      return;
    }

    const entry = this.registry.getById(displayId);
    if (!entry || entry.config.typeId !== DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY) {
      return;
    }

    this.genericBrowserCapabilities.set(displayId, {
      capabilities: hello.capabilities,
      viewport: hello.viewport,
      userAgent: '',
      lastHelloAt: new Date(),
    });

    this.logger.info('Generic browser capability hello', {
      displayId,
      remoteAddress,
      touch: hello.capabilities.touch,
      fullscreen: hello.capabilities.fullscreen,
      audioPlayback: hello.capabilities.audioPlayback,
      viewport: hello.viewport,
    });
  }

  private async acceptConnection(
    socket: WebSocket,
    displayId: string,
    remoteAddress: string,
  ): Promise<void> {
    const session = this.sessions.open({
      displayId,
      remoteAddress,
      socket,
    });

    try {
      await this.sendInitialSnapshot(session);
    } catch (error) {
      this.logger.error('Failed to send realtime snapshot', {
        displayId,
        connectionId: session.connectionId,
        error,
      });
      session.send({
        type: 'error',
        code: 'snapshot_failed',
        message: 'snapshot_failed',
      });
      session.close(1011, 'snapshot_failed');
    }
  }

  private async sendInitialSnapshot(
    session: DisplayRealtimeSession,
  ): Promise<void> {
    const snapshot = await this.buildSnapshot(session.displayId);
    if (!snapshot) {
      session.send({
        type: 'error',
        code: 'display_session_invalid',
        message: 'display_session_invalid',
      });
      session.close(1008, 'display_session_invalid');
      return;
    }

    const subscriptions = await this.resolveCapabilitySubscriptions(
      snapshot.configuration,
    );
    await this.subscriptions.setDisplaySubscriptions(
      session.displayId,
      subscriptions,
    );
    this.registry.markRealtimeSubscribedDevices(
      session.displayId,
      subscriptions.length,
    );

    const message: ServerMessage = {
      type: 'dashboard-snapshot',
      snapshot,
    };
    session.send(message);
  }

  private async buildSnapshot(
    displayId: string,
  ): Promise<DashboardSnapshotPayload | null> {
    const entry = this.registry.getById(displayId);
    if (!entry) {
      return null;
    }

    const layout = resolveLayoutId(entry.config.layoutId);
    if (!layout.ok) {
      return null;
    }

    const runtime = await resolveDashboardRuntime({
      widgets: entry.config.dashboard.widgets,
      repository: this.deviceRepository,
      logger: this.logger,
    });

    this.registry.markLightWidgetDiagnostics(
      displayId,
      runtime.lightDiagnostics,
    );
    this.registry.markCoverWidgetDiagnostics(
      displayId,
      runtime.coverDiagnostics,
    );

    const copy = createRealtimeDashboardCopy(this.translate);

    return {
      protocolVersion: REALTIME_PROTOCOL_VERSION,
      displayId: entry.config.displayId,
      displayName: entry.config.name,
      typeLabel: typeLabelForDisplay(entry.config.typeId, this.translate),
      layoutId: entry.config.layoutId,
      layout: layout.config,
      configuration: entry.config.dashboard,
      widgetStates: runtime.states,
      notifications: this.notifications.getNotificationsForDisplay(displayId),
      theme: resolveDashboardTheme(entry.config.dashboard.theme),
      locale: this.getLanguage(),
      emptyState: createEmptyStateCopy(this.translate),
      copy,
    };
  }

  private handleNotificationDismiss(
    session: DisplayRealtimeSession,
    notificationId: string,
  ): void {
    this.mediaSessions.stop(session.displayId, notificationId);
    this.metrics.setActiveMediaSessions(this.mediaSessions.getActiveCount());
    this.notifications.dismissForDisplay(session.displayId, notificationId);
  }

  private async handleNotificationMediaStart(
    session: DisplayRealtimeSession,
    notificationId: string,
  ): Promise<void> {
    if (
      !this.notifications.notificationTargetsDisplay(
        notificationId,
        session.displayId,
      )
    ) {
      this.logger.warn('Rejected media start for foreign notification', {
        displayId: session.displayId,
        notificationId,
      });
      return;
    }

    const notification = this.notifications.getActiveNotification(notificationId);
    const binding = this.notifications.getMediaBinding(notificationId);
    if (!notification?.media || !binding) {
      this.logger.info('Media start ignored — no media binding', {
        displayId: session.displayId,
        notificationId,
      });
      return;
    }

    let deviceName: string | null = null;
    let videoKind: string | null = null;
    let playback = notification.media.playback;
    if (this.mediaResolver) {
      const resolved = await this.mediaResolver.resolve(binding.deviceId);
      deviceName = resolved.deviceName;
      videoKind = resolved.videoKind;
      playback = resolved.media.playback;
      this.logger.info('Notification media resolve', {
        displayId: session.displayId,
        notificationId,
        playback,
        strategy: resolved.reason,
        hasImage: resolved.media.hasImage,
        hasVideo: resolved.media.hasVideo,
      });
    }

    this.mediaSessions.start({
      displayId: session.displayId,
      notificationId,
      notificationKey: notification.notificationKey,
      deviceName,
      playback,
      videoKind,
      fallbackAvailable: notification.media.hasImage,
    });
    this.metrics.setActiveMediaSessions(this.mediaSessions.getActiveCount());
    if (playback === 'video') {
      this.metrics.recordVideoStartAttempt();
    }
    this.logger.info('Notification media start', {
      displayId: session.displayId,
      notificationId,
      playback,
    });
  }

  private handleNotificationMediaStop(
    session: DisplayRealtimeSession,
    notificationId: string,
  ): void {
    const stopped = this.mediaSessions.stop(session.displayId, notificationId);
    this.metrics.setActiveMediaSessions(this.mediaSessions.getActiveCount());
    if (stopped) {
      this.logger.info('Notification media stop', {
        displayId: session.displayId,
        notificationId,
      });
    }
  }

  private handleNotificationMediaTelemetry(
    session: DisplayRealtimeSession,
    message: {
      readonly notificationId: string;
      readonly event:
        | 'image-loaded'
        | 'video-ready'
        | 'video-failed'
        | 'image-fallback';
    },
  ): void {
    if (
      !this.notifications.notificationTargetsDisplay(
        message.notificationId,
        session.displayId,
      )
    ) {
      return;
    }
    switch (message.event) {
      case 'image-loaded':
        this.metrics.recordImageLoad();
        this.logger.info('Notification media image loaded', {
          displayId: session.displayId,
          notificationId: message.notificationId,
        });
        break;
      case 'video-ready':
        this.metrics.recordVideoStartSuccess();
        this.logger.info('Notification media video ready', {
          displayId: session.displayId,
          notificationId: message.notificationId,
        });
        break;
      case 'video-failed':
        this.metrics.recordVideoStartFailure();
        this.logger.info('Notification media video failed', {
          displayId: session.displayId,
          notificationId: message.notificationId,
        });
        break;
      case 'image-fallback':
        this.metrics.recordImageFallback();
        this.logger.info('Notification media fallback image', {
          displayId: session.displayId,
          notificationId: message.notificationId,
        });
        break;
      default:
        break;
    }
  }

  public async serveNotificationImage(
    displayId: string,
    notificationId: string,
  ): Promise<HttpResponse> {
    const notFound: HttpResponse = {
      statusCode: 404,
      contentType: 'text/plain; charset=utf-8',
      body: 'Not Found',
    };

    if (
      !this.notifications.notificationTargetsDisplay(notificationId, displayId)
    ) {
      return notFound;
    }

    const activeNotification =
      this.notifications.getActiveNotification(notificationId);
    if (!activeNotification?.media) {
      return notFound;
    }

    const binding = this.notifications.getMediaBinding(notificationId);
    if (!binding || !this.mediaResolver) {
      return notFound;
    }

    const cacheKey = `${notificationId}\0${binding.deviceId}`;
    const now = Date.now();
    const cached = this.notificationImageRefCache.get(cacheKey);
    let imageRef = cached && cached.expiresAt > now ? cached.image : null;
    if (!imageRef) {
      const resolved = await this.mediaResolver.resolve(binding.deviceId);
      if (!resolved.image) {
        this.notificationImageRefCache.delete(cacheKey);
        return notFound;
      }
      imageRef = resolved.image;
      this.notificationImageRefCache.set(cacheKey, {
        image: imageRef,
        expiresAt: now + NOTIFICATION_MEDIA_IMAGE_REF_CACHE_MS,
      });
    }

    const image = await this.mediaResolver.loadImage(imageRef);
    if (!image) {
      this.notificationImageRefCache.delete(cacheKey);
      return notFound;
    }

    return {
      statusCode: 200,
      contentType: image.contentType,
      body: '',
      binaryBody: image.bytes,
      cacheControl: 'private, no-store',
    };
  }

  private purgeNotificationImageCache(notificationId: string): void {
    const prefix = `${notificationId}\0`;
    for (const key of [...this.notificationImageRefCache.keys()]) {
      if (key.startsWith(prefix)) {
        this.notificationImageRefCache.delete(key);
      }
    }
  }

  public serveNotificationVideo(): HttpResponse {
    // Homey camera video types (RTSP/RTMP/WebRTC/HLS/DASH) are not piped.
    // No transcoding; no arbitrary URL proxy.
    return {
      statusCode: 415,
      contentType: 'text/plain; charset=utf-8',
      body: 'Unsupported Media Type',
    };
  }

  private async handleNotificationAction(
    session: DisplayRealtimeSession,
    message: {
      readonly notificationId: string;
      readonly notificationKey: string;
      readonly actionId: string;
      readonly requestId: string;
    },
  ): Promise<void> {
    const reject = (reason: NotificationActionRejectReason): void => {
      this.metrics.recordNotificationActionValidationRejected();
      this.logger.warn('Notification action validation rejected', {
        displayId: session.displayId,
        notificationId: message.notificationId,
        actionId: message.actionId,
        reason,
      });
      session.send({
        type: 'notification-action-rejected',
        requestId: message.requestId,
        reason,
      });
    };

    this.metrics.recordNotificationActionPressed();
    this.logger.info('Notification action pressed', {
      displayId: session.displayId,
      notificationId: message.notificationId,
      actionId: message.actionId,
    });

    const notification = this.notifications.resolveNotificationAction({
      displayId: session.displayId,
      notificationId: message.notificationId,
      actionId: message.actionId,
      notificationKey: message.notificationKey,
    });

    if (!notification) {
      const active = this.notifications.getActiveNotification(
        message.notificationId.trim(),
      );
      if (
        !active ||
        !this.notifications
          .getDisplayIdsForNotification(message.notificationId.trim())
          .includes(session.displayId)
      ) {
        reject('notification_not_found');
        return;
      }
      if (!active.action) {
        reject('notification_action_invalid');
        return;
      }
      reject('notification_action_mismatch');
      return;
    }

    if (!this.onNotificationActionPressed) {
      reject('homey_api_error');
      return;
    }

    session.send({
      type: 'notification-action-accepted',
      requestId: message.requestId,
    });

    const tokens: NotificationActionFlowTokens = {
      notificationKey: notification.notificationKey ?? '',
      actionId: notification.action!.actionId,
      actionLabel: notification.action!.label,
      actionText: notification.action!.text ?? '',
      notificationTitle: notification.title ?? '',
      notificationMessage: notification.message,
    };
    const state: NotificationActionTriggerState = {
      actionId: notification.action!.actionId,
      notificationKey: notification.notificationKey ?? '',
    };

    try {
      this.logger.info('Flow trigger fired for notification action', {
        displayId: session.displayId,
        actionId: state.actionId,
        notificationKey: state.notificationKey,
      });
      await this.onNotificationActionPressed({
        displayId: session.displayId,
        tokens,
        state,
      });
      this.metrics.recordNotificationActionTriggerSucceeded();
      session.send({
        type: 'notification-action-succeeded',
        requestId: message.requestId,
      });
    } catch (error) {
      this.metrics.recordNotificationActionTriggerFailed();
      this.logger.error('Flow trigger failure for notification action', {
        displayId: session.displayId,
        actionId: state.actionId,
        error,
      });
      session.send({
        type: 'notification-action-rejected',
        requestId: message.requestId,
        reason: 'homey_api_error',
      });
    }
  }

  private handleNotificationChange(event: NotificationChangeEvent): void {
    if (event.kind === 'removed') {
      this.mediaSessions.stopForNotification(event.notificationId);
      this.purgeNotificationImageCache(event.notificationId);
      this.metrics.setActiveMediaSessions(this.mediaSessions.getActiveCount());
    } else if (
      event.kind === 'updated' &&
      event.notification &&
      !event.notification.media
    ) {
      this.purgeNotificationImageCache(event.notificationId);
    }
    for (const displayId of event.affectedDisplayIds) {
      if (!this.sessions.hasActiveSession(displayId)) {
        continue;
      }

      if (event.kind === 'removed' || event.kind === 'dismissed') {
        const sent = this.sessions.sendToDisplay(displayId, {
          type: 'notification-removed',
          notificationId: event.notificationId,
        });
        if (sent) {
          this.metrics.recordNotificationMessageSent();
          this.notifications.recordMessageSent();
        }
        continue;
      }

      if (!event.notification) {
        continue;
      }

      // Skip Displays that have locally dismissed this id (update stays hidden).
      if (
        this.notifications.isDismissedOnDisplay(displayId, event.notificationId)
      ) {
        continue;
      }

      // Skip if this Display is no longer a target (update re-route).
      const visible = this.notifications.getNotificationsForDisplay(displayId);
      const stillVisible = visible.some(
        (item) => item.id === event.notificationId,
      );
      if (!stillVisible) {
        const sent = this.sessions.sendToDisplay(displayId, {
          type: 'notification-removed',
          notificationId: event.notificationId,
        });
        if (sent) {
          this.metrics.recordNotificationMessageSent();
          this.notifications.recordMessageSent();
        }
        continue;
      }

      const message: ServerMessage =
        event.kind === 'added'
          ? { type: 'notification-added', notification: event.notification }
          : { type: 'notification-updated', notification: event.notification };

      const sent = this.sessions.sendToDisplay(displayId, message);
      if (sent) {
        this.metrics.recordNotificationMessageSent();
        this.notifications.recordMessageSent();
      }
    }

    // Aggregate Homey capabilities reflect SoT, not local dismiss.
    if (event.kind !== 'dismissed') {
      this.onNotificationAggregatesChanged?.(event.affectedDisplayIds);
    }
  }

  private async handleSessionClosed(
    session: DisplayRealtimeSession,
  ): Promise<void> {
    const active = this.sessions.getByDisplayId(session.displayId);
    if (active && active.connectionId !== session.connectionId) {
      return;
    }

    const cancelled = this.pendingCommands.cancelForDisplay(session.displayId);
    if (cancelled.length > 0) {
      this.logger.info('Cleared pending commands on socket close', {
        displayId: session.displayId,
        count: cancelled.length,
      });
      this.syncPendingMetrics();
    }

    this.mediaSessions.stopAllForDisplay(session.displayId);
    this.metrics.setActiveMediaSessions(this.mediaSessions.getActiveCount());

    await this.subscriptions.removeDisplay(session.displayId);
    this.registry.markRealtimeDisconnected(session.displayId);
  }

  private async handleCapabilityValue(
    deviceId: string,
    capabilityId: string,
    value: unknown,
  ): Promise<void> {
    if (capabilityId === LIGHT_CAPABILITY_ID) {
      const on = parseOnoff(value);
      this.resolvePendingForLightToggle(deviceId, on);
      await this.routeLightCapabilityUpdate(deviceId, {
        [LIGHT_CAPABILITY_ID]: on ?? value,
      });
      return;
    }

    if (capabilityId === LIGHT_DIM_CAPABILITY_ID) {
      this.resolvePendingForLightPercent(
        deviceId,
        LIGHT_DIM_CAPABILITY_ID,
        'set-dim',
        value,
      );
      await this.routeLightCapabilityUpdate(deviceId, {
        [LIGHT_DIM_CAPABILITY_ID]: value,
      });
      return;
    }

    if (capabilityId === LIGHT_TEMPERATURE_CAPABILITY_ID) {
      this.resolvePendingForLightPercent(
        deviceId,
        LIGHT_TEMPERATURE_CAPABILITY_ID,
        'set-temperature',
        value,
      );
      await this.routeLightCapabilityUpdate(deviceId, {
        [LIGHT_TEMPERATURE_CAPABILITY_ID]: value,
      });
      return;
    }

    if (
      capabilityId === LIGHT_HUE_CAPABILITY_ID ||
      capabilityId === LIGHT_SATURATION_CAPABILITY_ID
    ) {
      this.resolvePendingForLightColor(deviceId);
      await this.routeLightCapabilityUpdate(deviceId, {
        [capabilityId]: value,
      });
      return;
    }

    if (capabilityId === COVER_CAPABILITY_ID) {
      this.resolvePendingForCoverPosition(deviceId, value);
      await this.routeCoverCapabilityUpdate(deviceId, value);
      return;
    }

    if (capabilityId === COVER_STATE_CAPABILITY_ID) {
      this.resolvePendingForCoverStop(deviceId, value);
    }
  }

  private async routeLightCapabilityUpdate(
    deviceId: string,
    capabilityPatch: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    const displayIds = this.subscriptions.getDisplayIdsForDevice(
      deviceId,
      LIGHT_CAPABILITY_ID,
    );
    if (displayIds.length === 0) {
      return;
    }

    let device = null;
    try {
      device = await this.deviceRepository.getDevice(deviceId);
    } catch (error) {
      this.logger.error('Failed to resolve Homey device after capability change', {
        deviceId,
        error,
      });
    }

    for (const displayId of displayIds) {
      const entry = this.registry.getById(displayId);
      if (!entry) {
        continue;
      }

      for (const widget of entry.config.dashboard.widgets) {
        if (widget.type !== 'light' || widget.config.deviceId !== deviceId) {
          continue;
        }

        try {
          const resolved = device
            ? resolveLightWidgetRuntimeFromSnapshot({
                widgetId: widget.id,
                deviceId,
                device: {
                  ...device,
                  capabilityValues: {
                    ...device.capabilityValues,
                    ...capabilityPatch,
                  },
                },
                title: widget.config.title,
              })
            : createLightApiErrorRuntime(
                widget.id,
                deviceId,
                widget.config.title,
              );

          this.sessions.sendToDisplay(displayId, {
            type: 'widget-state',
            widgetId: widget.id,
            state: resolved.state,
          });
        } catch (error) {
          this.logger.error('Failed to route widget state update', {
            displayId,
            widgetId: widget.id,
            deviceId,
            error,
          });
        }
      }
    }
  }

  private async routeCoverCapabilityUpdate(
    deviceId: string,
    value: unknown,
  ): Promise<void> {
    const displayIds = this.subscriptions.getDisplayIdsForDevice(
      deviceId,
      COVER_CAPABILITY_ID,
    );
    if (displayIds.length === 0) {
      return;
    }

    let device = null;
    try {
      device = await this.deviceRepository.getDevice(deviceId);
    } catch (error) {
      this.logger.error('Failed to resolve Homey device after cover change', {
        deviceId,
        error,
      });
    }

    for (const displayId of displayIds) {
      const entry = this.registry.getById(displayId);
      if (!entry) {
        continue;
      }

      for (const widget of entry.config.dashboard.widgets) {
        if (widget.type !== 'cover' || widget.config.deviceId !== deviceId) {
          continue;
        }

        try {
          const resolved = device
            ? resolveCoverWidgetRuntimeFromSnapshot({
                widgetId: widget.id,
                deviceId,
                device: {
                  ...device,
                  capabilityValues: {
                    ...device.capabilityValues,
                    [COVER_CAPABILITY_ID]: value,
                  },
                },
                title: widget.config.title,
              })
            : createCoverApiErrorRuntime(
                widget.id,
                deviceId,
                widget.config.title,
              );

          this.sessions.sendToDisplay(displayId, {
            type: 'widget-state',
            widgetId: widget.id,
            state: resolved.state,
          });
        } catch (error) {
          this.logger.error('Failed to route cover widget state update', {
            displayId,
            widgetId: widget.id,
            deviceId,
            error,
          });
        }
      }
    }
  }

  /**
   * Homey realtime is the only confirmation of success for light toggles.
   *
   * Mismatch policy (deterministic): if a pending command expected ON and Homey
   * reports OFF (or the reverse), clear pending, adopt Homey's value via the
   * normal widget-state path, and count the command as failed — no auto-retry.
   */
  private resolvePendingForLightToggle(
    deviceId: string,
    on: boolean | null,
  ): void {
    const pending = this.pendingCommands.findByDeviceAndCapability(
      deviceId,
      LIGHT_CAPABILITY_ID,
    );
    if (pending.length === 0 || on === null) {
      return;
    }

    for (const command of pending) {
      if (command.action !== 'toggle') {
        continue;
      }
      if (command.expectedValue === on) {
        this.pendingCommands.resolveSuccess(command.requestId);
        this.metrics.recordCommandSucceeded();
        this.logger.info('Command confirmation received', {
          displayId: command.displayId,
          widgetId: command.widgetId,
          requestId: command.requestId,
          value: on,
        });
        this.sessions.sendToDisplay(command.displayId, {
          type: 'command-succeeded',
          requestId: command.requestId,
        });
      } else {
        this.pendingCommands.resolveMismatch(command.requestId);
        this.metrics.recordCommandFailed();
        this.metrics.recordLightCommandFailed();
        this.logger.warn('Command pending cleared by mismatched Homey state', {
          displayId: command.displayId,
          widgetId: command.widgetId,
          requestId: command.requestId,
          expected: command.expectedValue,
          actual: on,
        });
        this.sessions.sendToDisplay(command.displayId, {
          type: 'command-rejected',
          requestId: command.requestId,
          reason: 'unexpected_state',
        });
      }
    }

    this.syncPendingMetrics();
  }

  private resolvePendingForLightPercent(
    deviceId: string,
    capabilityId: string,
    action: 'set-dim' | 'set-temperature',
    value: unknown,
  ): void {
    const reportedPercent = normalizeHomeyUnitInterval(value).percent;
    if (reportedPercent === null) {
      return;
    }

    const pending = this.pendingCommands.findByDeviceAndCapability(
      deviceId,
      capabilityId,
    );
    if (pending.length === 0) {
      return;
    }

    for (const command of pending) {
      if (
        command.action !== action ||
        typeof command.expectedValue !== 'number'
      ) {
        continue;
      }

      const result = evaluateLightPercentConfirmation({
        targetPercent: command.expectedValue,
        reportedPercent,
      });

      this.logger.info('Light realtime value update', {
        displayId: command.displayId,
        widgetId: command.widgetId,
        requestId: command.requestId,
        action,
        current: reportedPercent,
        target: command.expectedValue,
        result,
      });

      if (result === 'confirmed') {
        this.pendingCommands.resolveSuccess(command.requestId);
        this.metrics.recordCommandSucceeded();
        this.logger.info('Light command confirmation received', {
          displayId: command.displayId,
          widgetId: command.widgetId,
          requestId: command.requestId,
          action,
          value: reportedPercent,
        });
        this.sessions.sendToDisplay(command.displayId, {
          type: 'command-succeeded',
          requestId: command.requestId,
        });
      }
    }

    this.syncPendingMetrics();
  }

  private resolvePendingForLightColor(deviceId: string): void {
    const pending = this.pendingCommands.findByDeviceAndCapability(
      deviceId,
      LIGHT_HUE_CAPABILITY_ID,
    );
    if (pending.length === 0) {
      return;
    }

    void this.deviceRepository
      .getDevice(deviceId)
      .then((device) => {
        if (!device) {
          return;
        }
        const huePercent = normalizeHomeyUnitInterval(
          device.capabilityValues[LIGHT_HUE_CAPABILITY_ID],
        ).percent;
        const saturationPercent = normalizeHomeyUnitInterval(
          device.capabilityValues[LIGHT_SATURATION_CAPABILITY_ID],
        ).percent;

        for (const command of pending) {
          if (command.action !== 'set-color') {
            continue;
          }
          const expected = decodeLightColorExpected(command.expectedValue);
          if (!expected) {
            continue;
          }

          const result = evaluateLightColorConfirmation({
            targetHuePercent: expected.huePercent,
            targetSaturationPercent: expected.saturationPercent,
            reportedHuePercent: huePercent,
            reportedSaturationPercent: saturationPercent,
          });

          this.logger.info('Light color realtime update', {
            displayId: command.displayId,
            widgetId: command.widgetId,
            requestId: command.requestId,
            hue: huePercent,
            saturation: saturationPercent,
            target: expected,
            result,
          });

          if (result === 'confirmed') {
            this.pendingCommands.resolveSuccess(command.requestId);
            this.metrics.recordCommandSucceeded();
            this.logger.info('Light color confirmation received', {
              displayId: command.displayId,
              widgetId: command.widgetId,
              requestId: command.requestId,
            });
            this.sessions.sendToDisplay(command.displayId, {
              type: 'command-succeeded',
              requestId: command.requestId,
            });
          }
        }

        this.syncPendingMetrics();
      })
      .catch((error: unknown) => {
        this.logger.warn('Failed to confirm light color command', {
          deviceId,
          error,
        });
      });
  }

  /**
   * Cover set-position confirmation: first coherent progress toward target OR
   * reported percent within tolerance. Intermediate Homey values still update
   * the tile via widget-state while pending remains until confirmed / failed.
   */
  private resolvePendingForCoverPosition(
    deviceId: string,
    value: unknown,
  ): void {
    const normalized = normalizeWindowcoveringsSet(value);
    const reportedPercent = normalized.positionPercent;
    if (reportedPercent === null) {
      return;
    }

    const pending = this.pendingCommands.findByDeviceAndCapability(
      deviceId,
      COVER_CAPABILITY_ID,
    );
    if (pending.length === 0) {
      return;
    }

    for (const command of pending) {
      if (
        command.action !== 'set-position' ||
        typeof command.expectedValue !== 'number'
      ) {
        continue;
      }

      const result = evaluateCoverPositionConfirmation({
        targetPercent: command.expectedValue,
        baselinePercent: command.baselineValue,
        reportedPercent,
      });

      this.logger.info('Cover realtime progress', {
        displayId: command.displayId,
        widgetId: command.widgetId,
        requestId: command.requestId,
        current: reportedPercent,
        target: command.expectedValue,
        result,
      });

      if (result === 'confirmed') {
        this.pendingCommands.resolveSuccess(command.requestId);
        this.metrics.recordCommandSucceeded();
        this.logger.info('Cover command confirmation received', {
          displayId: command.displayId,
          widgetId: command.widgetId,
          requestId: command.requestId,
          current: reportedPercent,
          target: command.expectedValue,
        });
        this.sessions.sendToDisplay(command.displayId, {
          type: 'command-succeeded',
          requestId: command.requestId,
        });
      } else if (result === 'mismatched') {
        this.pendingCommands.resolveMismatch(command.requestId);
        this.metrics.recordCommandFailed();
        this.metrics.recordCoverCommandFailed();
        this.logger.warn('Cover command cleared by mismatched Homey state', {
          displayId: command.displayId,
          widgetId: command.widgetId,
          requestId: command.requestId,
          expected: command.expectedValue,
          actual: reportedPercent,
        });
        this.sessions.sendToDisplay(command.displayId, {
          type: 'command-rejected',
          requestId: command.requestId,
          reason: 'unexpected_state',
        });
      }
    }

    this.syncPendingMetrics();
  }

  /**
   * Stop confirmation: Homey reports `windowcoverings_state` === `idle`.
   */
  private resolvePendingForCoverStop(
    deviceId: string,
    value: unknown,
  ): void {
    const pending = this.pendingCommands.findByDeviceAndCapability(
      deviceId,
      COVER_STATE_CAPABILITY_ID,
    );
    if (pending.length === 0) {
      return;
    }

    for (const command of pending) {
      if (command.action !== 'stop') {
        continue;
      }

      if (value === COVER_STOP_STATE_VALUE) {
        this.pendingCommands.resolveSuccess(command.requestId);
        this.metrics.recordCommandSucceeded();
        this.logger.info('Cover stop confirmation received', {
          displayId: command.displayId,
          widgetId: command.widgetId,
          requestId: command.requestId,
        });
        this.sessions.sendToDisplay(command.displayId, {
          type: 'command-succeeded',
          requestId: command.requestId,
        });
      }
    }

    this.syncPendingMetrics();
  }

  private syncPendingMetrics(): void {
    this.metrics.setActivePendingCommands(this.pendingCommands.activeCount());
    this.metrics.setRecentCommands(this.pendingCommands.listRecent());
    const coverPending = this.pendingCommands
      .listActive()
      .filter(
        (entry) =>
          entry.action === 'set-position' || entry.action === 'stop',
      ).length;
    this.metrics.setCoverPendingCommands(coverPending);
    const lightPending = this.pendingCommands
      .listActive()
      .filter(
        (entry) =>
          entry.action === 'toggle' ||
          entry.action === 'set-dim' ||
          entry.action === 'set-temperature' ||
          entry.action === 'set-color',
      ).length;
    this.metrics.setLightPendingCommands(lightPending);
  }

  /**
   * Base refs from dashboard widgets, plus optional light capabilities and
   * `windowcoverings_state` when Homey documents them on the bound device.
   */
  private async resolveCapabilitySubscriptions(
    configuration: import('../widgets/types').DashboardConfiguration,
  ): Promise<readonly HomeyCapabilityRef[]> {
    const base = extractReferencedCapabilitySubscriptions(configuration);
    const keys = new Set(
      base.map((ref) => subscriptionKey(ref.deviceId, ref.capabilityId)),
    );
    const enriched: HomeyCapabilityRef[] = [...base];

    for (const ref of base) {
      if (ref.capabilityId === COVER_CAPABILITY_ID) {
        const stateKey = subscriptionKey(ref.deviceId, COVER_STATE_CAPABILITY_ID);
        if (keys.has(stateKey)) {
          continue;
        }
        try {
          const device = await this.deviceRepository.getDevice(ref.deviceId);
          if (device && hasWindowcoveringsStateCapability(device)) {
            keys.add(stateKey);
            enriched.push({
              deviceId: ref.deviceId,
              capabilityId: COVER_STATE_CAPABILITY_ID,
            });
          }
        } catch (error) {
          this.logger.warn('Failed to probe cover stop capability for subscription', {
            deviceId: ref.deviceId,
            error,
          });
        }
        continue;
      }

      if (ref.capabilityId !== LIGHT_CAPABILITY_ID) {
        continue;
      }

      try {
        const device = await this.deviceRepository.getDevice(ref.deviceId);
        if (!device) {
          continue;
        }
        for (const capabilityId of listPresentLightOptionalCapabilities(device)) {
          const key = subscriptionKey(ref.deviceId, capabilityId);
          if (keys.has(key)) {
            continue;
          }
          keys.add(key);
          enriched.push({ deviceId: ref.deviceId, capabilityId });
        }
      } catch (error) {
        this.logger.warn('Failed to probe light optional capabilities for subscription', {
          deviceId: ref.deviceId,
          error,
        });
      }
    }

    enriched.sort((left, right) => {
      const byDevice = left.deviceId.localeCompare(right.deviceId);
      if (byDevice !== 0) {
        return byDevice;
      }
      return left.capabilityId.localeCompare(right.capabilityId);
    });

    return enriched;
  }

  private async handleDeviceRemoved(
    deviceId: string,
    capabilityId: string,
  ): Promise<void> {
    if (
      capabilityId === LIGHT_CAPABILITY_ID ||
      capabilityId === LIGHT_DIM_CAPABILITY_ID ||
      capabilityId === LIGHT_TEMPERATURE_CAPABILITY_ID ||
      capabilityId === LIGHT_HUE_CAPABILITY_ID ||
      capabilityId === LIGHT_SATURATION_CAPABILITY_ID ||
      capabilityId === COVER_CAPABILITY_ID ||
      capabilityId === COVER_STATE_CAPABILITY_ID
    ) {
      const pending = this.pendingCommands.findByDeviceAndCapability(
        deviceId,
        capabilityId,
      );
      for (const command of pending) {
        this.pendingCommands.resolveFailed(command.requestId);
        this.metrics.recordCommandFailed();
        if (
          command.action === 'set-position' ||
          command.action === 'stop'
        ) {
          this.metrics.recordCoverCommandFailed();
        } else if (
          command.action === 'toggle' ||
          command.action === 'set-dim' ||
          command.action === 'set-temperature' ||
          command.action === 'set-color'
        ) {
          this.metrics.recordLightCommandFailed();
        }
        this.sessions.sendToDisplay(command.displayId, {
          type: 'command-rejected',
          requestId: command.requestId,
          reason: 'device_missing',
        });
      }
      this.syncPendingMetrics();
    }

    const displayIds = this.subscriptions.getDisplayIdsForDevice(
      deviceId,
      capabilityId === LIGHT_DIM_CAPABILITY_ID ||
        capabilityId === LIGHT_TEMPERATURE_CAPABILITY_ID ||
        capabilityId === LIGHT_HUE_CAPABILITY_ID ||
        capabilityId === LIGHT_SATURATION_CAPABILITY_ID
        ? LIGHT_CAPABILITY_ID
        : capabilityId,
    );
    for (const displayId of displayIds) {
      const entry = this.registry.getById(displayId);
      if (!entry) {
        continue;
      }

      for (const widget of entry.config.dashboard.widgets) {
        if (capabilityId === LIGHT_CAPABILITY_ID) {
          if (widget.type !== 'light' || widget.config.deviceId !== deviceId) {
            continue;
          }
          const resolved = createLightApiErrorRuntime(
            widget.id,
            deviceId,
            widget.config.title,
          );
          this.sessions.sendToDisplay(displayId, {
            type: 'widget-state',
            widgetId: widget.id,
            state: resolved.state,
          });
          continue;
        }

        if (capabilityId === COVER_CAPABILITY_ID) {
          if (widget.type !== 'cover' || widget.config.deviceId !== deviceId) {
            continue;
          }
          const resolved = createCoverApiErrorRuntime(
            widget.id,
            deviceId,
            widget.config.title,
          );
          this.sessions.sendToDisplay(displayId, {
            type: 'widget-state',
            widgetId: widget.id,
            state: resolved.state,
          });
        }
      }
    }
  }
}

export function createRealtimeUiCopy(
  translate: (key: string) => string,
): RealtimeUiCopy {
  return {
    connectionLost: translate('pages.realtime.connectionLost'),
    reconnecting: translate('pages.realtime.reconnecting'),
    connectionRestored: translate('pages.realtime.connectionRestored'),
    realtimeUnavailable: translate('pages.realtime.realtimeUnavailable'),
    protocolError: translate('pages.realtime.protocolError'),
    displaySessionInvalid: translate('pages.realtime.displaySessionInvalid'),
    snapshotFailed: translate('pages.realtime.snapshotFailed'),
    homeyConnectionError: translate('pages.realtime.homeyConnectionError'),
  };
}

export function createRealtimeDashboardCopy(
  translate: (key: string) => string,
) {
  return createDashboardUiCopy(translate);
}

function typeLabelForDisplay(
  typeId: string,
  translate: (key: string) => string,
): string {
  if (typeId === DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY) {
    return translate('adapters.shelly_wall_display');
  }
  if (typeId === DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY) {
    return translate('adapters.generic_web_display');
  }
  return typeId;
}

function pathOnly(url: string): string {
  const noQuery = url.split('?', 1)[0] ?? '/';
  return noQuery === '' ? '/' : noQuery;
}

const UNPAIRED_PRIVILEGED_CLIENT_TYPES = new Set([
  'widget-action',
  'notification-dismiss',
  'notification-action',
  'notification-media-start',
  'notification-media-stop',
  'client-ready',
]);

function isUnpairedPrivilegedMessage(raw: string): boolean {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return false;
    }
    const type = (parsed as { readonly type?: unknown }).type;
    return typeof type === 'string' && UNPAIRED_PRIVILEGED_CLIENT_TYPES.has(type);
  } catch {
    return false;
  }
}

/** Adapter so HomeyDeviceRepository / HomeyWebApi can feed the subscription manager. */
export function capabilitySubscriberFrom(
  subscribe: HomeyCapabilitySubscriber['subscribeCapability'],
): HomeyCapabilitySubscriber {
  return { subscribeCapability: subscribe };
}

export type { HomeyCapabilitySubscription };
