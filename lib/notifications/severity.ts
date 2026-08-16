/**
 * Centralized notification severity priority.
 * Do not rely on alphabetical order.
 */

import type { NotificationSeverity } from './types';

/** Higher number = more severe. */
export const NOTIFICATION_SEVERITY_PRIORITY: Readonly<
  Record<NotificationSeverity, number>
> = {
  critical: 4,
  warning: 3,
  success: 2,
  info: 1,
};

export const NOTIFICATION_SEVERITIES: readonly NotificationSeverity[] = [
  'critical',
  'warning',
  'success',
  'info',
] as const;

export function isNotificationSeverity(
  value: unknown,
): value is NotificationSeverity {
  return (
    value === 'critical' ||
    value === 'warning' ||
    value === 'success' ||
    value === 'info'
  );
}

export function compareNotificationSeverity(
  left: NotificationSeverity,
  right: NotificationSeverity,
): number {
  return (
    NOTIFICATION_SEVERITY_PRIORITY[right] -
    NOTIFICATION_SEVERITY_PRIORITY[left]
  );
}

/**
 * Highest severity among a list, or null when empty.
 */
export function maxNotificationSeverity(
  severities: readonly NotificationSeverity[],
): NotificationSeverity | null {
  if (severities.length === 0) {
    return null;
  }

  let max: NotificationSeverity = severities[0]!;
  for (let i = 1; i < severities.length; i += 1) {
    const current = severities[i]!;
    if (
      NOTIFICATION_SEVERITY_PRIORITY[current] >
      NOTIFICATION_SEVERITY_PRIORITY[max]
    ) {
      max = current;
    }
  }
  return max;
}
