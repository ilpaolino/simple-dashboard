/**
 * Controlled notification icon keys. No arbitrary markup.
 */

import type { NotificationIcon } from './types';

export const NOTIFICATION_ICONS: readonly NotificationIcon[] = [
  'info',
  'warning',
  'success',
  'error',
  'home',
  'bell',
  'door',
  'washing-machine',
] as const;

export function isNotificationIcon(value: unknown): value is NotificationIcon {
  return (
    value === 'info' ||
    value === 'warning' ||
    value === 'success' ||
    value === 'error' ||
    value === 'home' ||
    value === 'bell' ||
    value === 'door' ||
    value === 'washing-machine'
  );
}
