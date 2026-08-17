import type { DashboardRenderer } from '../layout/DashboardRenderer';
import type { DashboardUiCopy } from '../../lib/dashboard/types';
import type { CoverWidgetRuntimeState } from '../../lib/widgets/cover/types';
import type { LightWidgetRuntimeState } from '../../lib/widgets/light/types';
import {
  NOTIFICATION_ACTION_TIMEOUT_MS,
  RECONNECT_FACTOR,
  RECONNECT_INITIAL_MS,
  RECONNECT_MAX_MS,
  REALTIME_WEBSOCKET_PATH,
} from '../../lib/realtime/constants';
import {
  parseServerMessage,
  serializeClientMessage,
  type ClientMessage,
  type DashboardSnapshotPayload,
  type ServerMessage,
} from '../../lib/realtime/protocol';
import { WidgetControlOverlay } from '../overlays/widget-control/WidgetControlOverlay';
import { CoverControlPanel } from '../widgets/cover/CoverControlPanel';
import { LightControlPanel } from '../widgets/light/LightControlPanel';
import { NotificationCenter } from '../notifications/NotificationCenter';
import { NotificationController } from '../notifications/NotificationController';
import { NotificationIndicator } from '../notifications/NotificationIndicator';
import { shouldAutoOpenFromPush } from '../notifications/autoOpenFromPush';
import { ConnectionOverlay } from './ConnectionOverlay';
import {
  WidgetInteractionController,
  type WidgetActionDispatch,
} from './WidgetInteractionController';

export interface RealtimeClientOptions {
  readonly renderer: DashboardRenderer;
  readonly copy: DashboardUiCopy;
  readonly overlay?: ConnectionOverlay;
  readonly controlOverlay?: WidgetControlOverlay;
  readonly interactions?: WidgetInteractionController;
  readonly notifications?: NotificationController;
}

/**
 * Browser WebSocket client: reconnect with exponential backoff, heartbeat ack,
 * full snapshot as source of truth after reconnect. Overlay stays until snapshot
 * is applied — not merely when the socket opens.
 */
export class RealtimeClient {
  private readonly renderer: DashboardRenderer;
  private copy: DashboardUiCopy;
  private readonly overlay: ConnectionOverlay;
  private readonly controlOverlay: WidgetControlOverlay;
  private readonly interactions: WidgetInteractionController;
  private readonly notifications: NotificationController;
  private readonly notificationIndicator: NotificationIndicator;
  private readonly notificationCenter: NotificationCenter;

  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private activeCoverPanel: CoverControlPanel | null = null;
  private activeLightPanel: LightControlPanel | null = null;
  private openCoverDeviceId: string | null = null;
  private openLightDeviceId: string | null = null;
  private pendingNotificationActionRequestId: string | null = null;
  private notificationActionTimer: ReturnType<typeof setTimeout> | null = null;
  private displayMeta: {
    displayId: string;
    displayName: string;
    typeLabel: string;
    layoutId: string;
    layout: DashboardSnapshotPayload['layout'];
    locale: string;
    emptyState: DashboardSnapshotPayload['emptyState'];
  } | null = null;

  public constructor(options: RealtimeClientOptions) {
    this.renderer = options.renderer;
    this.copy = options.copy;
    this.overlay = options.overlay ?? new ConnectionOverlay();
    this.controlOverlay = options.controlOverlay ?? new WidgetControlOverlay();
    this.interactions =
      options.interactions ??
      new WidgetInteractionController({
        sendAction: (message) => this.sendWidgetAction(message),
      });
    this.notifications = options.notifications ?? new NotificationController();
    this.notificationIndicator = new NotificationIndicator(
      this.notifications,
      this.copy.notifications,
    );
    this.notificationCenter = new NotificationCenter({
      controller: this.notifications,
      copy: this.copy.notifications,
      onDismiss: (notificationId) => this.dismissNotification(notificationId),
      onAction: (input) => this.sendNotificationAction(input),
      onOpened: () => {
        this.send({ type: 'notification-center-opened' });
      },
      onAutoClosed: () => {
        this.send({ type: 'notification-auto-closed' });
      },
      onMediaStart: (notificationId) => {
        this.send({ type: 'notification-media-start', notificationId });
      },
      onMediaStop: (notificationId) => {
        this.send({ type: 'notification-media-stop', notificationId });
      },
      onMediaTelemetry: (notificationId, event) => {
        this.send({
          type: 'notification-media-telemetry',
          notificationId,
          event,
        });
      },
    });
    this.bindInteractions();
  }

  public getInteractionController(): WidgetInteractionController {
    return this.interactions;
  }

  public getNotificationController(): NotificationController {
    return this.notifications;
  }

  public start(): void {
    if (this.destroyed) {
      return;
    }
    this.overlay.show(this.copy.realtime);
    this.connect();
  }

  public destroy(): void {
    this.destroyed = true;
    this.clearReconnectTimer();
    this.clearNotificationActionPending();
    this.interactions.destroy();
    this.controlOverlay.destroy();
    this.notificationCenter.destroy();
    this.notificationIndicator.destroy();
    this.notifications.destroy();
    if (this.socket) {
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      try {
        this.socket.close();
      } catch {
        // ignore
      }
      this.socket = null;
    }
    this.overlay.destroy();
  }

  private bindInteractions(): void {
    this.renderer.setInteractions({
      requestToggle: (widgetId) =>
        this.interactions.handleGesture({
          widgetId,
          gesture: 'tap',
          action: 'toggle',
          interactive: true,
        }),
      requestLightSetDim: (widgetId, valuePercent) =>
        this.interactions.requestSetDim(widgetId, valuePercent),
      requestLightSetTemperature: (widgetId, valuePercent) =>
        this.interactions.requestSetTemperature(widgetId, valuePercent),
      requestLightSetColor: (widgetId, huePercent, saturationPercent) =>
        this.interactions.requestSetColor(
          widgetId,
          huePercent,
          saturationPercent,
        ),
      openLightControl: (widgetId) => this.openLightControl(widgetId),
      notifyLightRuntime: (widgetId, state) =>
        this.onLightRuntime(widgetId, state),
      notifyLightWidgetDestroyed: (widgetId) => {
        if (this.controlOverlay.getActiveWidgetId() === widgetId) {
          this.controlOverlay.close();
        }
      },
      requestCoverSetPosition: (widgetId, positionPercent) =>
        this.interactions.requestSetPosition(widgetId, positionPercent),
      requestCoverStop: (widgetId) => this.interactions.requestStop(widgetId),
      openCoverControl: (widgetId) => this.openCoverControl(widgetId),
      notifyCoverRuntime: (widgetId, state) =>
        this.onCoverRuntime(widgetId, state),
      notifyCoverWidgetDestroyed: (widgetId) => {
        if (this.controlOverlay.getActiveWidgetId() === widgetId) {
          this.controlOverlay.close();
        }
      },
      onStatus: (widgetId, listener) =>
        this.interactions.onStatus(widgetId, listener),
      notifyStateConfirmed: (widgetId) =>
        this.interactions.handleWidgetStateConfirmed(widgetId),
      isPending: (widgetId) => this.interactions.isPending(widgetId),
    });

    this.renderer.setOnConfigurationApplied((widgetIds) => {
      this.controlOverlay.handleWidgetsChanged(widgetIds);
    });
  }

  private openLightControl(widgetId: string): void {
    const runtime = this.renderer.getWidgetRuntime(widgetId);
    if (!runtime || runtime.type !== 'light') {
      return;
    }

    this.openLightDeviceId = runtime.deviceId;
    const lightCopy = this.copy.light;
    this.controlOverlay.open({
      widgetId,
      title: runtime.name || lightCopy.controls,
      ariaLabel: `${runtime.name || lightCopy.controls}. ${lightCopy.openControl}`,
      closeLabel: lightCopy.closeControl,
      render: (surface) => {
        const panel = new LightControlPanel({
          copy: lightCopy,
          initialRuntime: runtime,
          actions: {
            toggle: () =>
              this.interactions.handleGesture({
                widgetId,
                gesture: 'tap',
                action: 'toggle',
                interactive: true,
              }),
            setDim: (valuePercent) =>
              this.interactions.requestSetDim(widgetId, valuePercent),
            setTemperature: (valuePercent) =>
              this.interactions.requestSetTemperature(widgetId, valuePercent),
            setColor: (huePercent, saturationPercent) =>
              this.interactions.requestSetColor(
                widgetId,
                huePercent,
                saturationPercent,
              ),
            isPending: () => this.interactions.isPending(widgetId),
            onStatus: (listener) =>
              this.interactions.onStatus(widgetId, (feedback) => {
                listener(feedback.status);
              }),
          },
        });
        panel.mount(surface);
        this.activeLightPanel = panel;
        return () => {
          panel.destroy();
          if (this.activeLightPanel === panel) {
            this.activeLightPanel = null;
          }
          this.openLightDeviceId = null;
        };
      },
    });
  }

  private onLightRuntime(
    widgetId: string,
    state: LightWidgetRuntimeState,
  ): void {
    if (this.controlOverlay.getActiveWidgetId() !== widgetId) {
      return;
    }

    if (
      this.openLightDeviceId !== null &&
      state.deviceId !== this.openLightDeviceId
    ) {
      this.controlOverlay.close();
      return;
    }

    this.activeLightPanel?.updateRuntime(state);
  }

  private openCoverControl(widgetId: string): void {
    const runtime = this.renderer.getWidgetRuntime(widgetId);
    if (!runtime || runtime.type !== 'cover') {
      return;
    }

    this.openCoverDeviceId = runtime.deviceId;
    const coverCopy = this.copy.cover;
    this.controlOverlay.open({
      widgetId,
      title: runtime.name || coverCopy.name,
      ariaLabel: `${runtime.name || coverCopy.name}. ${coverCopy.openControl}`,
      closeLabel: coverCopy.closeControl,
      render: (surface) => {
        const panel = new CoverControlPanel({
          copy: coverCopy,
          initialRuntime: runtime,
          actions: {
            setPosition: (positionPercent) =>
              this.interactions.requestSetPosition(widgetId, positionPercent),
            stop: () => this.interactions.requestStop(widgetId),
            isPending: () => this.interactions.isPending(widgetId),
            onStatus: (listener) =>
              this.interactions.onStatus(widgetId, (feedback) => {
                listener(feedback.status);
              }),
          },
        });
        panel.mount(surface);
        this.activeCoverPanel = panel;
        return () => {
          panel.destroy();
          if (this.activeCoverPanel === panel) {
            this.activeCoverPanel = null;
          }
          this.openCoverDeviceId = null;
        };
      },
    });
  }

  private onCoverRuntime(
    widgetId: string,
    state: CoverWidgetRuntimeState,
  ): void {
    if (this.controlOverlay.getActiveWidgetId() !== widgetId) {
      return;
    }

    if (
      this.openCoverDeviceId !== null &&
      state.deviceId !== this.openCoverDeviceId
    ) {
      this.controlOverlay.close();
      return;
    }

    this.activeCoverPanel?.updateRuntime(state);
  }

  private connect(): void {
    if (this.destroyed) {
      return;
    }

    this.clearReconnectTimer();

    const url = buildRealtimeUrl();
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      this.send({ type: 'client-ready' });
    });

    socket.addEventListener('message', (event) => {
      if (typeof event.data !== 'string') {
        return;
      }
      const message = parseServerMessage(event.data);
      if (!message) {
        return;
      }
      this.handleServerMessage(message);
    });

    socket.addEventListener('close', () => {
      this.socket = null;
      this.interactions.handleDisconnect();
      this.failPendingNotificationAction();
      this.notificationCenter.stopMedia();
      if (!this.destroyed) {
        this.overlay.show(this.copy.realtime);
        this.scheduleReconnect();
      }
    });

    socket.addEventListener('error', () => {
      // close handler schedules reconnect
    });
  }

  private handleServerMessage(message: ServerMessage): void {
    try {
      switch (message.type) {
        case 'heartbeat':
          this.send({ type: 'heartbeat-ack', at: message.at });
          break;
        case 'dashboard-snapshot':
          this.applySnapshot(message.snapshot);
          break;
        case 'dashboard-configuration':
          this.applyConfigurationUpdate(message);
          break;
        case 'widget-state':
          this.renderer.updateWidgetState(message.widgetId, message.state);
          break;
        case 'notification-snapshot':
          // Snapshot / reconnect must not storm auto-open for historical items.
          this.notificationCenter.cancelAutoClose('snapshot');
          this.notifications.applySnapshot(
            message.notifications.map((item) => ({
              ...item,
              autoOpen: item.autoOpen !== false,
            })),
          );
          break;
        case 'notification-added':
          this.notifications.addNotification({
            ...message.notification,
            autoOpen: message.notification.autoOpen !== false,
          });
          this.maybeAutoOpenFromPush(message.notification, 'added');
          break;
        case 'notification-updated': {
          const existed = this.notifications
            .getNotifications()
            .some((item) => item.id === message.notification.id);
          this.notifications.updateNotification({
            ...message.notification,
            autoOpen: message.notification.autoOpen !== false,
          });
          this.maybeAutoOpenFromPush(
            message.notification,
            existed ? 'updated' : 'restored',
          );
          break;
        }
        case 'notification-removed':
          this.notifications.removeNotification(message.notificationId);
          break;
        case 'notification-action-accepted':
          break;
        case 'notification-action-succeeded':
          if (message.requestId === this.pendingNotificationActionRequestId) {
            this.clearNotificationActionPending();
            this.notificationCenter.showActionFeedback('sent');
          }
          break;
        case 'notification-action-rejected':
          if (message.requestId === this.pendingNotificationActionRequestId) {
            this.failPendingNotificationAction();
          }
          break;
        case 'command-accepted':
          this.interactions.handleCommandAccepted(message.requestId);
          break;
        case 'command-succeeded':
          this.interactions.handleCommandSucceeded(message.requestId);
          break;
        case 'command-rejected':
          this.interactions.handleCommandRejected(
            message.requestId,
            message.reason,
          );
          break;
        case 'command-timeout':
          this.interactions.handleCommandTimeout(message.requestId);
          break;
        case 'error':
          this.failPendingNotificationAction();
          break;
        default:
          break;
      }
    } catch {
      // Isolate widget / apply failures from the socket lifecycle.
    }
  }

  private applySnapshot(snapshot: DashboardSnapshotPayload): void {
    this.copy = snapshot.copy;
    this.notificationIndicator.setCopy(this.copy.notifications);
    this.notificationCenter.setCopy(this.copy.notifications);
    this.displayMeta = {
      displayId: snapshot.displayId,
      displayName: snapshot.displayName,
      typeLabel: snapshot.typeLabel,
      layoutId: snapshot.layoutId,
      layout: snapshot.layout,
      locale: snapshot.locale,
      emptyState: snapshot.emptyState,
    };

    this.renderer.applyConfiguration({
      displayId: snapshot.displayId,
      displayName: snapshot.displayName,
      typeLabel: snapshot.typeLabel,
      layoutId: snapshot.layoutId,
      layout: snapshot.layout,
      widgets: snapshot.configuration.widgets,
      widgetRuntime: snapshot.widgetStates,
      theme: snapshot.theme,
      locale: snapshot.locale,
      emptyState: snapshot.emptyState,
      copy: snapshot.copy,
    });

    this.notifications.applySnapshot(
      (snapshot.notifications ?? []).map((item) => ({
        ...item,
        autoOpen: item.autoOpen !== false,
      })),
    );

    this.reconnectAttempt = 0;
    this.overlay.hide();
  }

  private dismissNotification(notificationId: string): void {
    this.notificationCenter.cancelAutoClose('dismiss');
    const dismissed = this.notifications.dismissLocal(notificationId);
    if (!dismissed) {
      return;
    }
    this.send({
      type: 'notification-dismiss',
      notificationId,
    });
  }

  private sendNotificationAction(input: {
    readonly notificationId: string;
    readonly notificationKey: string;
    readonly actionId: string;
  }): void {
    if (this.pendingNotificationActionRequestId !== null) {
      return;
    }
    const requestId = `na-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.pendingNotificationActionRequestId = requestId;
    const sent = this.send({
      type: 'notification-action',
      notificationId: input.notificationId,
      notificationKey: input.notificationKey,
      actionId: input.actionId,
      requestId,
    });
    if (!sent) {
      this.failPendingNotificationAction();
      return;
    }
    this.notificationActionTimer = setTimeout(() => {
      this.failPendingNotificationAction();
    }, NOTIFICATION_ACTION_TIMEOUT_MS);
  }

  private failPendingNotificationAction(): void {
    if (this.pendingNotificationActionRequestId === null) {
      return;
    }
    this.clearNotificationActionPending();
    this.notificationCenter.showActionFeedback('failed');
  }

  private clearNotificationActionPending(): void {
    if (this.notificationActionTimer !== null) {
      clearTimeout(this.notificationActionTimer);
      this.notificationActionTimer = null;
    }
    this.pendingNotificationActionRequestId = null;
    this.notificationCenter.setActionPending(false);
  }

  /**
   * Realtime push auto-open. Snapshot/reconnect never calls this.
   * Manual ribbon open never schedules auto-close.
   * A second Flow Show of the same key must re-present (doorbell rings again).
   */
  private maybeAutoOpenFromPush(
    notification: {
      readonly autoOpen?: boolean;
      readonly autoCloseSeconds?: number;
      readonly dismissable?: boolean;
      readonly id: string;
    },
    kind: 'added' | 'restored' | 'updated',
  ): void {
    if (!shouldAutoOpenFromPush(notification.autoOpen, kind)) {
      return;
    }
    if (!this.notifications.openTo(notification.id)) {
      return;
    }
    this.send({ type: 'notification-auto-opened' });
    this.send({ type: 'notification-center-opened' });
    const seconds = notification.autoCloseSeconds ?? 0;
    if (seconds > 0 && notification.dismissable !== false) {
      this.notificationCenter.scheduleAutoClose(seconds);
    }
  }

  private applyConfigurationUpdate(message: {
    readonly configuration: DashboardSnapshotPayload['configuration'];
    readonly widgetStates: DashboardSnapshotPayload['widgetStates'];
    readonly theme: DashboardSnapshotPayload['theme'];
  }): void {
    if (!this.displayMeta) {
      return;
    }

    this.renderer.applyConfiguration({
      displayId: this.displayMeta.displayId,
      displayName: this.displayMeta.displayName,
      typeLabel: this.displayMeta.typeLabel,
      layoutId: this.displayMeta.layoutId,
      layout: this.displayMeta.layout,
      widgets: message.configuration.widgets,
      widgetRuntime: message.widgetStates,
      theme: message.theme,
      locale: this.displayMeta.locale,
      emptyState: this.displayMeta.emptyState,
      copy: this.copy,
    });
  }

  private sendWidgetAction(message: WidgetActionDispatch): boolean {
    if (message.action === 'set-position') {
      if (typeof message.positionPercent !== 'number') {
        return false;
      }
      return this.send({
        type: 'widget-action',
        widgetId: message.widgetId,
        action: 'set-position',
        requestId: message.requestId,
        positionPercent: message.positionPercent,
      });
    }

    if (message.action === 'set-dim' || message.action === 'set-temperature') {
      if (typeof message.valuePercent !== 'number') {
        return false;
      }
      return this.send({
        type: 'widget-action',
        widgetId: message.widgetId,
        action: message.action,
        requestId: message.requestId,
        valuePercent: message.valuePercent,
      });
    }

    if (message.action === 'set-color') {
      if (
        typeof message.huePercent !== 'number' ||
        typeof message.saturationPercent !== 'number'
      ) {
        return false;
      }
      return this.send({
        type: 'widget-action',
        widgetId: message.widgetId,
        action: 'set-color',
        requestId: message.requestId,
        huePercent: message.huePercent,
        saturationPercent: message.saturationPercent,
      });
    }

    if (message.action === 'stop') {
      return this.send({
        type: 'widget-action',
        widgetId: message.widgetId,
        action: 'stop',
        requestId: message.requestId,
      });
    }

    return this.send({
      type: 'widget-action',
      widgetId: message.widgetId,
      action: 'toggle',
      requestId: message.requestId,
    });
  }

  private send(message: ClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.socket.send(serializeClientMessage(message));
    return true;
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = Math.min(
      RECONNECT_INITIAL_MS * RECONNECT_FACTOR ** this.reconnectAttempt,
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

function buildRealtimeUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}${REALTIME_WEBSOCKET_PATH}`;
}
