/**
 * Flow-facing upsert input for a single Display.
 */

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
}

export type AggregateNotificationSeverity =
  | 'none'
  | NotificationSeverity;
