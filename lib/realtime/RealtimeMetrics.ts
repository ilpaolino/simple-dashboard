/**
 * Process-local realtime counters. Not persisted; used by /diagnostics.
 */
import type { CommandDiagnosticEntry } from './PendingCommandManager';

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
  readonly commandsReceived: number;
  readonly commandsAccepted: number;
  readonly commandsRejected: number;
  readonly commandsSucceeded: number;
  readonly commandsFailed: number;
  readonly commandsTimedOut: number;
  readonly activePendingCommands: number;
  readonly recentCommands: readonly CommandDiagnosticEntry[];
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
  private commandsReceived = 0;
  private commandsAccepted = 0;
  private commandsRejected = 0;
  private commandsSucceeded = 0;
  private commandsFailed = 0;
  private commandsTimedOut = 0;
  private activePendingCommands = 0;
  private recentCommands: CommandDiagnosticEntry[] = [];

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

  public recordCommandReceived(): void {
    this.commandsReceived += 1;
  }

  public recordCommandAccepted(): void {
    this.commandsAccepted += 1;
  }

  public recordCommandRejected(): void {
    this.commandsRejected += 1;
  }

  public recordCommandSucceeded(): void {
    this.commandsSucceeded += 1;
  }

  public recordCommandFailed(): void {
    this.commandsFailed += 1;
  }

  public recordCommandTimedOut(): void {
    this.commandsTimedOut += 1;
  }

  public setActivePendingCommands(count: number): void {
    this.activePendingCommands = Math.max(0, count);
  }

  public setRecentCommands(entries: readonly CommandDiagnosticEntry[]): void {
    this.recentCommands = [...entries];
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
      commandsReceived: this.commandsReceived,
      commandsAccepted: this.commandsAccepted,
      commandsRejected: this.commandsRejected,
      commandsSucceeded: this.commandsSucceeded,
      commandsFailed: this.commandsFailed,
      commandsTimedOut: this.commandsTimedOut,
      activePendingCommands: this.activePendingCommands,
      recentCommands: [...this.recentCommands],
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
    this.commandsReceived = 0;
    this.commandsAccepted = 0;
    this.commandsRejected = 0;
    this.commandsSucceeded = 0;
    this.commandsFailed = 0;
    this.commandsTimedOut = 0;
    this.activePendingCommands = 0;
    this.recentCommands = [];
  }
}
