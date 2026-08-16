import type { IncomingMessage, Server as HttpServerNode } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { DisplayRegistry } from '../display/DisplayRegistry';
import { normalizeClientIp } from '../display/ipNormalize';
import type { HomeyDeviceRepository } from '../homey/HomeyDeviceRepository';
import type { HomeyCapabilitySubscription } from '../homey/types';
import type { Logger } from '../types';
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
  COVER_CAPABILITY_ID,
} from '../widgets';
import { DISPLAY_TYPE_IDS } from '../display/types';
import { REALTIME_PROTOCOL_VERSION, REALTIME_WEBSOCKET_PATH } from './constants';
import { extractReferencedCapabilitySubscriptions } from './extractReferencedDeviceIds';
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
  RealtimeUiCopy,
  ServerMessage,
} from './protocol';

export interface RealtimeGatewayOptions {
  readonly registry: DisplayRegistry;
  readonly deviceRepository: HomeyDeviceRepository;
  readonly capabilitySubscriber: HomeyCapabilitySubscriber;
  readonly logger: Logger;
  readonly translate: (key: string) => string;
  readonly getLanguage: () => string;
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

  public readonly metrics = new RealtimeMetrics();
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

    this.pendingCommands = new PendingCommandManager({
      onTimeout: (command) => {
        this.metrics.recordCommandTimedOut();
        this.metrics.setActivePendingCommands(this.pendingCommands.activeCount());
        this.metrics.setRecentCommands(this.pendingCommands.listRecent());
        this.logger.warn('Command timed out', {
          displayId: command.displayId,
          widgetId: command.widgetId,
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
        }
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

  public isActive(): boolean {
    return this.active && this.wss !== null;
  }

  public getMetrics() {
    this.metrics.setActivePendingCommands(this.pendingCommands.activeCount());
    this.metrics.setRecentCommands(this.pendingCommands.listRecent());
    return this.metrics.snapshot();
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
    this.metrics.reset();
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

    const subscriptions = extractReferencedCapabilitySubscriptions(
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
    this.sessions.closeDisplay(displayId, 1001, 'display_removed');
    await this.subscriptions.removeDisplay(displayId);
    this.registry.markRealtimeDisconnected(displayId);
  }

  private async handleWidgetAction(
    session: DisplayRealtimeSession,
    message: {
      readonly widgetId: string;
      readonly action: 'toggle';
      readonly requestId: string;
    },
  ): Promise<void> {
    if (!session.isOpen()) {
      return;
    }

    const result = await this.commandHandler.handle({
      displayId: session.displayId,
      widgetId: message.widgetId,
      action: message.action,
      requestId: message.requestId,
    });

    this.metrics.setRecentCommands(this.pendingCommands.listRecent());
    this.metrics.setActivePendingCommands(this.pendingCommands.activeCount());

    if (!session.isOpen()) {
      // Socket dropped while Homey API was in flight — drop pending, no replay.
      this.pendingCommands.cancel(message.requestId);
      this.metrics.setActivePendingCommands(this.pendingCommands.activeCount());
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
      this.metrics.recordRejectedConnection();
      this.logger.warn('Rejected WebSocket from unconfigured display', {
        remoteAddress,
      });
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      void this.acceptConnection(ws, entry.config.displayId, remoteAddress);
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

    const subscriptions = extractReferencedCapabilitySubscriptions(
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
      theme: resolveDashboardTheme(entry.config.dashboard.theme),
      locale: this.getLanguage(),
      emptyState: createEmptyStateCopy(this.translate),
      copy,
    };
  }

  private async handleSessionClosed(
    session: DisplayRealtimeSession,
  ): Promise<void> {
    const cancelled = this.pendingCommands.cancelForDisplay(session.displayId);
    if (cancelled.length > 0) {
      this.logger.info('Cleared pending commands on socket close', {
        displayId: session.displayId,
        count: cancelled.length,
      });
      this.metrics.setActivePendingCommands(this.pendingCommands.activeCount());
      this.metrics.setRecentCommands(this.pendingCommands.listRecent());
    }

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
      this.resolvePendingForCapability(deviceId, on);
      await this.routeLightCapabilityUpdate(deviceId, on, value);
      return;
    }

    if (capabilityId === COVER_CAPABILITY_ID) {
      await this.routeCoverCapabilityUpdate(deviceId, value);
    }
  }

  private async routeLightCapabilityUpdate(
    deviceId: string,
    on: boolean | null,
    value: unknown,
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
                    [LIGHT_CAPABILITY_ID]: on ?? value,
                  },
                },
              })
            : createLightApiErrorRuntime(widget.id, deviceId);

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
              })
            : createCoverApiErrorRuntime(widget.id, deviceId);

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
   * Homey realtime is the only confirmation of success.
   *
   * Mismatch policy (deterministic): if a pending command expected ON and Homey
   * reports OFF (or the reverse), clear pending, adopt Homey's value via the
   * normal widget-state path, and count the command as failed — no auto-retry.
   */
  private resolvePendingForCapability(
    deviceId: string,
    on: boolean | null,
  ): void {
    const pending = this.pendingCommands.findByDeviceId(deviceId);
    if (pending.length === 0 || on === null) {
      return;
    }

    for (const command of pending) {
      if (command.expectedValue === on) {
        this.pendingCommands.resolveSuccess(command.requestId);
        this.metrics.recordCommandSucceeded();
        this.logger.info('Command confirmation received', {
          displayId: command.displayId,
          widgetId: command.widgetId,
          requestId: command.requestId,
          value: on,
        });
      } else {
        this.pendingCommands.resolveMismatch(command.requestId);
        this.metrics.recordCommandFailed();
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

    this.metrics.setActivePendingCommands(this.pendingCommands.activeCount());
    this.metrics.setRecentCommands(this.pendingCommands.listRecent());
  }

  private async handleDeviceRemoved(
    deviceId: string,
    capabilityId: string,
  ): Promise<void> {
    if (capabilityId === LIGHT_CAPABILITY_ID) {
      const pending = this.pendingCommands.findByDeviceId(deviceId);
      for (const command of pending) {
        this.pendingCommands.resolveFailed(command.requestId);
        this.metrics.recordCommandFailed();
        this.sessions.sendToDisplay(command.displayId, {
          type: 'command-rejected',
          requestId: command.requestId,
          reason: 'device_missing',
        });
      }
      this.metrics.setActivePendingCommands(this.pendingCommands.activeCount());
      this.metrics.setRecentCommands(this.pendingCommands.listRecent());
    }

    const displayIds = this.subscriptions.getDisplayIdsForDevice(
      deviceId,
      capabilityId,
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
          const resolved = createLightApiErrorRuntime(widget.id, deviceId);
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
          const resolved = createCoverApiErrorRuntime(widget.id, deviceId);
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

/** Adapter so HomeyDeviceRepository / HomeyWebApi can feed the subscription manager. */
export function capabilitySubscriberFrom(
  subscribe: HomeyCapabilitySubscriber['subscribeCapability'],
): HomeyCapabilitySubscriber {
  return { subscribeCapability: subscribe };
}

export type { HomeyCapabilitySubscription };
