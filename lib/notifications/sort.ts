/**
 * Sort visible notifications: severity (critical first), then publishedAt ascending.
 */

import { compareNotificationSeverity } from './severity';
import type { DisplayNotification } from './types';

export function compareDisplayNotifications(
  left: DisplayNotification,
  right: DisplayNotification,
): number {
  const bySeverity = compareNotificationSeverity(left.severity, right.severity);
  if (bySeverity !== 0) {
    return bySeverity;
  }
  if (left.publishedAt !== right.publishedAt) {
    return left.publishedAt - right.publishedAt;
  }
  return left.id.localeCompare(right.id);
}

export function sortDisplayNotifications(
  notifications: readonly DisplayNotification[],
): DisplayNotification[] {
  return [...notifications].sort(compareDisplayNotifications);
}

/**
 * Index of the most severe notification (first in sorted order).
 * Used when opening the Notification Center from the indicator.
 */
export function indexOfHighestSeverity(
  notifications: readonly DisplayNotification[],
): number {
  if (notifications.length === 0) {
    return 0;
  }
  const sorted = sortDisplayNotifications(notifications);
  const targetId = sorted[0]!.id;
  const index = notifications.findIndex((item) => item.id === targetId);
  return index >= 0 ? index : 0;
}
