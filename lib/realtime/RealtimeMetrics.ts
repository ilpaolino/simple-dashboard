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
  readonly coverCommandsReceived: number;
  readonly coverSetPositionCommands: number;
  readonly coverOpenCommands: number;
  readonly coverCloseCommands: number;
  readonly coverStopCommands: number;
  readonly coverCommandsAccepted: number;
  readonly coverCommandsRejected: number;
  readonly coverCommandsFailed: number;
  readonly coverCommandsTimedOut: number;
  readonly coverPendingCommands: number;
  readonly lightCommandsReceived: number;
  readonly lightToggleCommands: number;
  readonly lightDimCommands: number;
  readonly lightTemperatureCommands: number;
  readonly lightColorCommands: number;
  readonly lightCommandsAccepted: number;
  readonly lightCommandsRejected: number;
  readonly lightCommandsFailed: number;
  readonly lightCommandsTimedOut: number;
  readonly lightPendingCommands: number;
  readonly notificationsPublished: number;
  readonly notificationsUpdated: number;
  readonly notificationsRemoved: number;
  readonly notificationsDismissedLocally: number;
  readonly notificationCenterOpened: number;
  readonly notificationMessagesSent: number;
  readonly flowNotificationsPublished: number;
  readonly flowNotificationsUpdated: number;
  readonly flowNotificationsRemoved: number;
  readonly flowNotificationsRemoveAll: number;
  readonly flowNotificationErrors: number;
  readonly notificationAutoOpened: number;
  readonly notificationAutoClosed: number;
  readonly notificationActionsPressed: number;
  readonly notificationActionTriggersSucceeded: number;
  readonly notificationActionTriggersFailed: number;
  readonly notificationActionValidationRejected: number;
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
  private coverCommandsReceived = 0;
  private coverSetPositionCommands = 0;
  private coverOpenCommands = 0;
  private coverCloseCommands = 0;
  private coverStopCommands = 0;
  private coverCommandsAccepted = 0;
  private coverCommandsRejected = 0;
  private coverCommandsFailed = 0;
  private coverCommandsTimedOut = 0;
  private coverPendingCommands = 0;
  private lightCommandsReceived = 0;
  private lightToggleCommands = 0;
  private lightDimCommands = 0;
  private lightTemperatureCommands = 0;
  private lightColorCommands = 0;
  private lightCommandsAccepted = 0;
  private lightCommandsRejected = 0;
  private lightCommandsFailed = 0;
  private lightCommandsTimedOut = 0;
  private lightPendingCommands = 0;
  private notificationsPublished = 0;
  private notificationsUpdated = 0;
  private notificationsRemoved = 0;
  private notificationsDismissedLocally = 0;
  private notificationCenterOpened = 0;
  private notificationMessagesSent = 0;
  private flowNotificationsPublished = 0;
  private flowNotificationsUpdated = 0;
  private flowNotificationsRemoved = 0;
  private flowNotificationsRemoveAll = 0;
  private flowNotificationErrors = 0;
  private notificationAutoOpened = 0;
  private notificationAutoClosed = 0;
  private notificationActionsPressed = 0;
  private notificationActionTriggersSucceeded = 0;
  private notificationActionTriggersFailed = 0;
  private notificationActionValidationRejected = 0;

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

  public recordCoverCommandReceived(
    action: 'set-position' | 'stop',
  ): void {
    this.coverCommandsReceived += 1;
    if (action === 'set-position') {
      this.coverSetPositionCommands += 1;
    } else {
      this.coverStopCommands += 1;
    }
  }

  public recordCoverOpenCommand(): void {
    this.coverOpenCommands += 1;
  }

  public recordCoverCloseCommand(): void {
    this.coverCloseCommands += 1;
  }

  public recordCoverCommandAccepted(): void {
    this.coverCommandsAccepted += 1;
  }

  public recordCoverCommandRejected(): void {
    this.coverCommandsRejected += 1;
  }

  public recordCoverCommandFailed(): void {
    this.coverCommandsFailed += 1;
  }

  public recordCoverCommandTimedOut(): void {
    this.coverCommandsTimedOut += 1;
  }

  public setCoverPendingCommands(count: number): void {
    this.coverPendingCommands = Math.max(0, count);
  }

  public recordLightCommandReceived(
    action: 'toggle' | 'set-dim' | 'set-temperature' | 'set-color',
  ): void {
    this.lightCommandsReceived += 1;
    if (action === 'toggle') {
      this.lightToggleCommands += 1;
    } else if (action === 'set-dim') {
      this.lightDimCommands += 1;
    } else if (action === 'set-temperature') {
      this.lightTemperatureCommands += 1;
    } else {
      this.lightColorCommands += 1;
    }
  }

  public recordLightCommandAccepted(): void {
    this.lightCommandsAccepted += 1;
  }

  public recordLightCommandRejected(): void {
    this.lightCommandsRejected += 1;
  }

  public recordLightCommandFailed(): void {
    this.lightCommandsFailed += 1;
  }

  public recordLightCommandTimedOut(): void {
    this.lightCommandsTimedOut += 1;
  }

  public setLightPendingCommands(count: number): void {
    this.lightPendingCommands = Math.max(0, count);
  }

  public recordNotificationPublished(): void {
    this.notificationsPublished += 1;
  }

  public recordNotificationUpdated(): void {
    this.notificationsUpdated += 1;
  }

  public recordNotificationRemoved(): void {
    this.notificationsRemoved += 1;
  }

  public recordNotificationDismissedLocally(): void {
    this.notificationsDismissedLocally += 1;
  }

  public recordNotificationCenterOpened(): void {
    this.notificationCenterOpened += 1;
  }

  public recordNotificationMessageSent(count = 1): void {
    this.notificationMessagesSent += Math.max(0, count);
  }

  public recordFlowNotificationPublished(): void {
    this.flowNotificationsPublished += 1;
  }

  public recordFlowNotificationUpdated(): void {
    this.flowNotificationsUpdated += 1;
  }

  public recordFlowNotificationRemoved(): void {
    this.flowNotificationsRemoved += 1;
  }

  public recordFlowNotificationRemoveAll(): void {
    this.flowNotificationsRemoveAll += 1;
  }

  public recordFlowNotificationError(): void {
    this.flowNotificationErrors += 1;
  }

  public recordNotificationAutoOpened(): void {
    this.notificationAutoOpened += 1;
  }

  public recordNotificationAutoClosed(): void {
    this.notificationAutoClosed += 1;
  }

  public recordNotificationActionPressed(): void {
    this.notificationActionsPressed += 1;
  }

  public recordNotificationActionTriggerSucceeded(): void {
    this.notificationActionTriggersSucceeded += 1;
  }

  public recordNotificationActionTriggerFailed(): void {
    this.notificationActionTriggersFailed += 1;
  }

  public recordNotificationActionValidationRejected(): void {
    this.notificationActionValidationRejected += 1;
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
      coverCommandsReceived: this.coverCommandsReceived,
      coverSetPositionCommands: this.coverSetPositionCommands,
      coverOpenCommands: this.coverOpenCommands,
      coverCloseCommands: this.coverCloseCommands,
      coverStopCommands: this.coverStopCommands,
      coverCommandsAccepted: this.coverCommandsAccepted,
      coverCommandsRejected: this.coverCommandsRejected,
      coverCommandsFailed: this.coverCommandsFailed,
      coverCommandsTimedOut: this.coverCommandsTimedOut,
      coverPendingCommands: this.coverPendingCommands,
      lightCommandsReceived: this.lightCommandsReceived,
      lightToggleCommands: this.lightToggleCommands,
      lightDimCommands: this.lightDimCommands,
      lightTemperatureCommands: this.lightTemperatureCommands,
      lightColorCommands: this.lightColorCommands,
      lightCommandsAccepted: this.lightCommandsAccepted,
      lightCommandsRejected: this.lightCommandsRejected,
      lightCommandsFailed: this.lightCommandsFailed,
      lightCommandsTimedOut: this.lightCommandsTimedOut,
      lightPendingCommands: this.lightPendingCommands,
      notificationsPublished: this.notificationsPublished,
      notificationsUpdated: this.notificationsUpdated,
      notificationsRemoved: this.notificationsRemoved,
      notificationsDismissedLocally: this.notificationsDismissedLocally,
      notificationCenterOpened: this.notificationCenterOpened,
      notificationMessagesSent: this.notificationMessagesSent,
      flowNotificationsPublished: this.flowNotificationsPublished,
      flowNotificationsUpdated: this.flowNotificationsUpdated,
      flowNotificationsRemoved: this.flowNotificationsRemoved,
      flowNotificationsRemoveAll: this.flowNotificationsRemoveAll,
      flowNotificationErrors: this.flowNotificationErrors,
      notificationAutoOpened: this.notificationAutoOpened,
      notificationAutoClosed: this.notificationAutoClosed,
      notificationActionsPressed: this.notificationActionsPressed,
      notificationActionTriggersSucceeded:
        this.notificationActionTriggersSucceeded,
      notificationActionTriggersFailed: this.notificationActionTriggersFailed,
      notificationActionValidationRejected:
        this.notificationActionValidationRejected,
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
    this.coverCommandsReceived = 0;
    this.coverSetPositionCommands = 0;
    this.coverOpenCommands = 0;
    this.coverCloseCommands = 0;
    this.coverStopCommands = 0;
    this.coverCommandsAccepted = 0;
    this.coverCommandsRejected = 0;
    this.coverCommandsFailed = 0;
    this.coverCommandsTimedOut = 0;
    this.coverPendingCommands = 0;
    this.lightCommandsReceived = 0;
    this.lightToggleCommands = 0;
    this.lightDimCommands = 0;
    this.lightTemperatureCommands = 0;
    this.lightColorCommands = 0;
    this.lightCommandsAccepted = 0;
    this.lightCommandsRejected = 0;
    this.lightCommandsFailed = 0;
    this.lightCommandsTimedOut = 0;
    this.lightPendingCommands = 0;
    this.notificationsPublished = 0;
    this.notificationsUpdated = 0;
    this.notificationsRemoved = 0;
    this.notificationsDismissedLocally = 0;
    this.notificationCenterOpened = 0;
    this.notificationMessagesSent = 0;
    this.flowNotificationsPublished = 0;
    this.flowNotificationsUpdated = 0;
    this.flowNotificationsRemoved = 0;
    this.flowNotificationsRemoveAll = 0;
    this.flowNotificationErrors = 0;
    this.notificationAutoOpened = 0;
    this.notificationAutoClosed = 0;
    this.notificationActionsPressed = 0;
    this.notificationActionTriggersSucceeded = 0;
    this.notificationActionTriggersFailed = 0;
    this.notificationActionValidationRejected = 0;
  }
}
