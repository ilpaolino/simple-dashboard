import type { WebSocket } from 'ws';
import type { Logger } from '../types';
import {
  DisplayRealtimeSession,
  type DisplayRealtimeSessionInfo,
} from './DisplayRealtimeSession';
import type { RealtimeMetrics } from './RealtimeMetrics';
import type { ClientMessage, ServerMessage } from './protocol';

export interface RealtimeSessionManagerOptions {
  readonly metrics: RealtimeMetrics;
  readonly logger: Logger;
  readonly onSessionOpened: (session: DisplayRealtimeSession) => void;
  readonly onSessionClosed: (session: DisplayRealtimeSession) => void;
  readonly onClientMessage?: (
    session: DisplayRealtimeSession,
    message: ClientMessage,
  ) => void;
}

/**
 * Newest connection wins: a second socket for the same display closes the previous one.
 */
export class RealtimeSessionManager {
  private readonly byDisplayId = new Map<string, DisplayRealtimeSession>();
  private readonly byConnectionId = new Map<string, DisplayRealtimeSession>();
  private readonly metrics: RealtimeMetrics;
  private readonly logger: Logger;
  private readonly onSessionOpened: RealtimeSessionManagerOptions['onSessionOpened'];
  private readonly onSessionClosed: RealtimeSessionManagerOptions['onSessionClosed'];
  private readonly onClientMessage: RealtimeSessionManagerOptions['onClientMessage'];

  public constructor(options: RealtimeSessionManagerOptions) {
    this.metrics = options.metrics;
    this.logger = options.logger;
    this.onSessionOpened = options.onSessionOpened;
    this.onSessionClosed = options.onSessionClosed;
    this.onClientMessage = options.onClientMessage;
  }

  public open(options: {
    readonly displayId: string;
    readonly remoteAddress: string;
    readonly socket: WebSocket;
  }): DisplayRealtimeSession {
    const existing = this.byDisplayId.get(options.displayId);
    if (existing) {
      this.logger.info('Replacing duplicate realtime session', {
        displayId: options.displayId,
        previousConnectionId: existing.connectionId,
      });
      existing.close(4000, 'replaced_by_newer_connection');
    }

    const session = new DisplayRealtimeSession({
      displayId: options.displayId,
      remoteAddress: options.remoteAddress,
      socket: options.socket,
      metrics: this.metrics,
      onClose: (closed) => {
        this.handleClosed(closed);
      },
      onClientMessage: (active, message) => {
        this.onClientMessage?.(active, message);
      },
      onProtocolError: (active, reason) => {
        this.logger.warn('Realtime protocol error', {
          displayId: active.displayId,
          connectionId: active.connectionId,
          reason,
        });
        active.send({
          type: 'error',
          code: 'protocol_error',
          message: reason,
        });
      },
    });

    this.byDisplayId.set(options.displayId, session);
    this.byConnectionId.set(session.connectionId, session);
    this.metrics.recordConnectionOpened();
    this.onSessionOpened(session);

    this.logger.info('Realtime session opened', {
      displayId: session.displayId,
      connectionId: session.connectionId,
      remoteAddress: session.remoteAddress,
    });

    return session;
  }

  public getByDisplayId(displayId: string): DisplayRealtimeSession | null {
    return this.byDisplayId.get(displayId) ?? null;
  }

  public hasActiveSession(displayId: string): boolean {
    const session = this.byDisplayId.get(displayId);
    return session?.isOpen() === true;
  }

  public list(): readonly DisplayRealtimeSessionInfo[] {
    return [...this.byDisplayId.values()].map((session) => session.getInfo());
  }

  public activeCount(): number {
    return this.byDisplayId.size;
  }

  public sendToDisplay(displayId: string, message: ServerMessage): boolean {
    const session = this.byDisplayId.get(displayId);
    if (!session) {
      return false;
    }
    return session.send(message);
  }

  public broadcastToDisplays(
    displayIds: readonly string[],
    message: ServerMessage,
  ): void {
    for (const displayId of displayIds) {
      this.sendToDisplay(displayId, message);
    }
  }

  public closeDisplay(displayId: string, code = 1000, reason = 'closed'): void {
    const session = this.byDisplayId.get(displayId);
    session?.close(code, reason);
  }

  public closeAll(code = 1001, reason = 'server_shutdown'): void {
    for (const session of [...this.byDisplayId.values()]) {
      session.close(code, reason);
    }
  }

  private handleClosed(session: DisplayRealtimeSession): void {
    const current = this.byDisplayId.get(session.displayId);
    if (current?.connectionId === session.connectionId) {
      this.byDisplayId.delete(session.displayId);
    }
    this.byConnectionId.delete(session.connectionId);
    this.metrics.recordConnectionClosed();
    this.onSessionClosed(session);

    this.logger.info('Realtime session closed', {
      displayId: session.displayId,
      connectionId: session.connectionId,
    });
  }
}
