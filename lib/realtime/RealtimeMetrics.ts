/**
 * Process-local realtime counters. Not persisted; used by /diagnostics.
 */
export interface RealtimeMetricsSnapshot {
  readonly connectionsOpened: number;
  readonly connectionsClosed: number;
  readonly activeConnections: number;
  readonly reconnects: number;
  readonly messagesSent: number;
  readonly messagesReceived: number;
  readonly activeSubscriptions: number;
  readonly rejectedConnections: number;
  readonly heartbeatTimeouts: number;
}

export class RealtimeMetrics {
  private connectionsOpened = 0;
  private connectionsClosed = 0;
  private activeConnections = 0;
  private reconnects = 0;
  private messagesSent = 0;
  private messagesReceived = 0;
  private activeSubscriptions = 0;
  private rejectedConnections = 0;
  private heartbeatTimeouts = 0;

  public recordConnectionOpened(): void {
    this.connectionsOpened += 1;
    this.activeConnections += 1;
  }

  public recordConnectionClosed(): void {
    this.connectionsClosed += 1;
    this.activeConnections = Math.max(0, this.activeConnections - 1);
  }

  public recordReconnect(): void {
    this.reconnects += 1;
  }

  public recordMessageSent(): void {
    this.messagesSent += 1;
  }

  public recordMessageReceived(): void {
    this.messagesReceived += 1;
  }

  public setActiveSubscriptions(count: number): void {
    this.activeSubscriptions = Math.max(0, count);
  }

  public recordRejectedConnection(): void {
    this.rejectedConnections += 1;
  }

  public recordHeartbeatTimeout(): void {
    this.heartbeatTimeouts += 1;
  }

  public snapshot(): RealtimeMetricsSnapshot {
    return {
      connectionsOpened: this.connectionsOpened,
      connectionsClosed: this.connectionsClosed,
      activeConnections: this.activeConnections,
      reconnects: this.reconnects,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived,
      activeSubscriptions: this.activeSubscriptions,
      rejectedConnections: this.rejectedConnections,
      heartbeatTimeouts: this.heartbeatTimeouts,
    };
  }

  public reset(): void {
    this.connectionsOpened = 0;
    this.connectionsClosed = 0;
    this.activeConnections = 0;
    this.reconnects = 0;
    this.messagesSent = 0;
    this.messagesReceived = 0;
    this.activeSubscriptions = 0;
    this.rejectedConnections = 0;
    this.heartbeatTimeouts = 0;
  }
}
