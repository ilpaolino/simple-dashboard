/**
 * Flow-facing upsert input for a single Display.
 */

import type { NotificationAction } from './action';
import type { NotificationIcon, NotificationSeverity } from './types';

export interface UpsertDisplayNotificationInput {
  readonly displayId: string;
  readonly notificationKey: string;
  readonly title?: string;
  readonly message: string;
  readonly severity: NotificationSeverity;
  readonly icon?: NotificationIcon;
  readonly dismissable?: boolean;
  readonly highlight?: boolean;
  readonly autoOpen?: boolean;
  readonly autoCloseSeconds?: number;
  /**
   * When provided (including `null`), replaces action.
   * Omit to leave action unchanged on update; on create, means no action.
   */
  readonly action?: NotificationAction | null;
}

export type AggregateNotificationSeverity =
  | 'none'
  | NotificationSeverity;

/** Tokens exposed by the notification-action-pressed device trigger. */
export interface NotificationActionFlowTokens {
  readonly notificationKey: string;
  readonly actionId: string;
  readonly actionLabel: string;
  readonly actionText: string;
  readonly notificationTitle: string;
  readonly notificationMessage: string;
}

export interface NotificationActionTriggerState {
  readonly actionId: string;
  readonly notificationKey: string;
}
