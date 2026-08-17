import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_TIMEOUT_MS,
} from './constants';
import type { RealtimeMetrics } from './RealtimeMetrics';
import {
  serializeServerMessage,
  isClientMessage,
  isWidgetActionId,
  type ClientMessage,
  type ServerMessage,
} from './protocol';

export interface DisplayRealtimeSessionInfo {
  readonly displayId: string;
  readonly connectionId: string;
  readonly connectedAt: Date;
  readonly remoteAddress: string;
  readonly lastHeartbeatAt: Date | null;
  readonly lastHeartbeatAckAt: Date | null;
}

export interface DisplayRealtimeSessionOptions {
  readonly displayId: string;
  readonly remoteAddress: string;
  readonly socket: WebSocket;
  readonly metrics: RealtimeMetrics;
  readonly onClose: (session: DisplayRealtimeSession) => void;
  readonly onClientMessage: (
    session: DisplayRealtimeSession,
    message: ClientMessage,
  ) => void;
  readonly onProtocolError: (
    session: DisplayRealtimeSession,
    reason: string,
  ) => void;
  readonly now?: () => Date;
  readonly heartbeatIntervalMs?: number;
  readonly heartbeatTimeoutMs?: number;
}

/**
 * One WebSocket ↔ one Display. Heartbeat timers are owned by the session
 * and cleared on close.
 */
export class DisplayRealtimeSession {
  public readonly displayId: string;
  public readonly connectionId: string;
  public readonly connectedAt: Date;
  public readonly remoteAddress: string;

  private readonly socket: WebSocket;
  private readonly metrics: RealtimeMetrics;
  private readonly onClose: (session: DisplayRealtimeSession) => void;
  private readonly onClientMessage: DisplayRealtimeSessionOptions['onClientMessage'];
  private readonly onProtocolError: DisplayRealtimeSessionOptions['onProtocolError'];
  private readonly now: () => Date;
  private readonly heartbeatIntervalMs: number;
  private readonly heartbeatTimeoutMs: number;

  private lastHeartbeatAt: Date | null = null;
  private lastHeartbeatAckAt: Date | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private awaitingAck = false;

  public constructor(options: DisplayRealtimeSessionOptions) {
    this.displayId = options.displayId;
    this.connectionId = randomUUID();
    this.connectedAt = (options.now ?? (() => new Date()))();
    this.remoteAddress = options.remoteAddress;
    this.socket = options.socket;
    this.metrics = options.metrics;
    this.onClose = options.onClose;
    this.onClientMessage = options.onClientMessage;
    this.onProtocolError = options.onProtocolError;
    this.now = options.now ?? (() => new Date());
    this.heartbeatIntervalMs =
      options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
    this.heartbeatTimeoutMs =
      options.heartbeatTimeoutMs ?? HEARTBEAT_TIMEOUT_MS;

    this.socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      this.handleRawMessage(data);
    });

    this.socket.on('close', () => {
      this.cleanup('socket_close');
    });

    this.socket.on('error', () => {
      this.close(1011, 'socket_error');
    });

    this.startHeartbeat();
  }

  public getInfo(): DisplayRealtimeSessionInfo {
    return {
      displayId: this.displayId,
      connectionId: this.connectionId,
      connectedAt: this.connectedAt,
      remoteAddress: this.remoteAddress,
      lastHeartbeatAt: this.lastHeartbeatAt,
      lastHeartbeatAckAt: this.lastHeartbeatAckAt,
    };
  }

  public isOpen(): boolean {
    return !this.closed && this.socket.readyState === this.socket.OPEN;
  }

  public send(message: ServerMessage): boolean {
    if (!this.isOpen()) {
      return false;
    }

    try {
      this.socket.send(serializeServerMessage(message));
      this.metrics.recordMessageSent();
      return true;
    } catch {
      this.close(1011, 'send_failed');
      return false;
    }
  }

  public noteHeartbeatAck(): void {
    this.lastHeartbeatAckAt = this.now();
    this.awaitingAck = false;
  }

  public close(code = 1000, reason = 'closed'): void {
    if (this.closed) {
      return;
    }

    try {
      if (
        this.socket.readyState === this.socket.OPEN ||
        this.socket.readyState === this.socket.CONNECTING
      ) {
        this.socket.close(code, reason.slice(0, 120));
      }
    } catch {
      try {
        this.socket.terminate();
      } catch {
        // ignore
      }
    }

    this.cleanup(reason);
  }

  private handleRawMessage(data: Buffer | ArrayBuffer | Buffer[]): void {
    this.metrics.recordMessageReceived();

    const raw = Buffer.isBuffer(data)
      ? data.toString('utf8')
      : Array.isArray(data)
        ? Buffer.concat(data).toString('utf8')
        : Buffer.from(data).toString('utf8');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.onProtocolError(this, 'invalid_json');
      return;
    }

    if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
      this.onProtocolError(this, 'missing_type');
      return;
    }

    const type = (parsed as { type: unknown }).type;
    if (type === 'heartbeat-ack') {
      const atValue = (parsed as { at?: unknown }).at;
      const at =
        typeof atValue === 'string' ? atValue : this.now().toISOString();
      this.noteHeartbeatAck();
      this.onClientMessage(this, { type: 'heartbeat-ack', at });
      return;
    }

    if (type === 'client-ready') {
      this.onClientMessage(this, { type: 'client-ready' });
      return;
    }

    if (type === 'widget-action') {
      const candidate = parsed as {
        readonly widgetId?: unknown;
        readonly action?: unknown;
        readonly requestId?: unknown;
        readonly positionPercent?: unknown;
        readonly valuePercent?: unknown;
        readonly huePercent?: unknown;
        readonly saturationPercent?: unknown;
      };
      if (
        typeof candidate.widgetId !== 'string' ||
        candidate.widgetId.trim() === '' ||
        !isWidgetActionId(candidate.action) ||
        typeof candidate.requestId !== 'string' ||
        candidate.requestId.trim() === ''
      ) {
        this.onProtocolError(this, 'invalid_widget_action');
        return;
      }

      const widgetId = candidate.widgetId.trim();
      const requestId = candidate.requestId.trim();

      if (candidate.action === 'set-position') {
        if (
          typeof candidate.positionPercent !== 'number' ||
          !Number.isInteger(candidate.positionPercent) ||
          candidate.positionPercent < 0 ||
          candidate.positionPercent > 100
        ) {
          this.onProtocolError(this, 'invalid_widget_action');
          return;
        }
        this.onClientMessage(this, {
          type: 'widget-action',
          widgetId,
          action: 'set-position',
          requestId,
          positionPercent: candidate.positionPercent,
        });
        return;
      }

      if (candidate.action === 'set-dim' || candidate.action === 'set-temperature') {
        if (
          typeof candidate.valuePercent !== 'number' ||
          !Number.isInteger(candidate.valuePercent) ||
          candidate.valuePercent < 0 ||
          candidate.valuePercent > 100
        ) {
          this.onProtocolError(this, 'invalid_widget_action');
          return;
        }
        this.onClientMessage(this, {
          type: 'widget-action',
          widgetId,
          action: candidate.action,
          requestId,
          valuePercent: candidate.valuePercent,
        });
        return;
      }

      if (candidate.action === 'set-color') {
        if (
          typeof candidate.huePercent !== 'number' ||
          !Number.isInteger(candidate.huePercent) ||
          candidate.huePercent < 0 ||
          candidate.huePercent > 100 ||
          typeof candidate.saturationPercent !== 'number' ||
          !Number.isInteger(candidate.saturationPercent) ||
          candidate.saturationPercent < 0 ||
          candidate.saturationPercent > 100
        ) {
          this.onProtocolError(this, 'invalid_widget_action');
          return;
        }
        this.onClientMessage(this, {
          type: 'widget-action',
          widgetId,
          action: 'set-color',
          requestId,
          huePercent: candidate.huePercent,
          saturationPercent: candidate.saturationPercent,
        });
        return;
      }

      if (candidate.action === 'stop') {
        this.onClientMessage(this, {
          type: 'widget-action',
          widgetId,
          action: 'stop',
          requestId,
        });
        return;
      }

      this.onClientMessage(this, {
        type: 'widget-action',
        widgetId,
        action: 'toggle',
        requestId,
      });
      return;
    }

    if (type === 'notification-dismiss') {
      const notificationId = (parsed as { notificationId?: unknown })
        .notificationId;
      if (
        typeof notificationId !== 'string' ||
        notificationId.trim() === ''
      ) {
        this.onProtocolError(this, 'invalid_notification_dismiss');
        return;
      }
      this.onClientMessage(this, {
        type: 'notification-dismiss',
        notificationId: notificationId.trim(),
      });
      return;
    }

    if (type === 'notification-center-opened') {
      this.onClientMessage(this, { type: 'notification-center-opened' });
      return;
    }

    if (type === 'notification-auto-opened') {
      this.onClientMessage(this, { type: 'notification-auto-opened' });
      return;
    }

    if (type === 'notification-auto-closed') {
      this.onClientMessage(this, { type: 'notification-auto-closed' });
      return;
    }

    if (type === 'notification-action') {
      const candidate = parsed as {
        readonly notificationId?: unknown;
        readonly notificationKey?: unknown;
        readonly actionId?: unknown;
        readonly requestId?: unknown;
      };
      if (
        typeof candidate.notificationId !== 'string' ||
        candidate.notificationId.trim() === '' ||
        typeof candidate.notificationKey !== 'string' ||
        typeof candidate.actionId !== 'string' ||
        candidate.actionId.trim() === '' ||
        typeof candidate.requestId !== 'string' ||
        candidate.requestId.trim() === ''
      ) {
        this.onProtocolError(this, 'invalid_notification_action');
        return;
      }
      this.onClientMessage(this, {
        type: 'notification-action',
        notificationId: candidate.notificationId.trim(),
        notificationKey: candidate.notificationKey,
        actionId: candidate.actionId.trim(),
        requestId: candidate.requestId.trim(),
      });
      return;
    }

    // Typed protocol messages added later must still reach the gateway.
    if (isClientMessage(parsed)) {
      this.onClientMessage(this, parsed);
      return;
    }

    this.onProtocolError(this, 'unknown_client_message');
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.tickHeartbeat();
    }, this.heartbeatIntervalMs);

    if (typeof this.heartbeatTimer.unref === 'function') {
      this.heartbeatTimer.unref();
    }
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private tickHeartbeat(): void {
    if (!this.isOpen()) {
      return;
    }

    if (this.awaitingAck && this.lastHeartbeatAt) {
      const age = this.now().getTime() - this.lastHeartbeatAt.getTime();
      if (age >= this.heartbeatTimeoutMs) {
        this.metrics.recordHeartbeatTimeout();
        this.close(1001, 'heartbeat_timeout');
      }
      // Do not send overlapping heartbeats while waiting for an ack.
      return;
    }

    const at = this.now().toISOString();
    this.lastHeartbeatAt = this.now();
    this.awaitingAck = true;
    this.send({ type: 'heartbeat', at });
  }

  private cleanup(_reason: string): void {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.stopHeartbeat();
    this.socket.removeAllListeners();
    this.onClose(this);
  }
}
