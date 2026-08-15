import type { DashboardRenderer } from '../layout/DashboardRenderer';
import type { DashboardUiCopy } from '../../lib/dashboard/types';
import {
  RECONNECT_FACTOR,
  RECONNECT_INITIAL_MS,
  RECONNECT_MAX_MS,
  REALTIME_WEBSOCKET_PATH,
} from '../../lib/realtime/constants';
import {
  parseServerMessage,
  serializeClientMessage,
  type DashboardSnapshotPayload,
  type ServerMessage,
} from '../../lib/realtime/protocol';
import { ConnectionOverlay } from './ConnectionOverlay';

export interface RealtimeClientOptions {
  readonly renderer: DashboardRenderer;
  readonly copy: DashboardUiCopy;
  readonly overlay?: ConnectionOverlay;
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

  private socket: WebSocket | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
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

  private connect(): void {
    if (this.destroyed) {
      return;
    }

    this.clearReconnectTimer();

    const url = buildRealtimeUrl();
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      // Keep overlay until snapshot is applied.
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
        case 'error':
          // Keep overlay / session; isolated protocol errors must not crash UI.
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

    this.reconnectAttempt = 0;
    this.overlay.hide();
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

  private send(
    message:
      | { readonly type: 'heartbeat-ack'; readonly at: string }
      | { readonly type: 'client-ready' },
  ): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(serializeClientMessage(message));
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
