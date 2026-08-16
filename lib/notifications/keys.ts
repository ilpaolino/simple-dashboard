/**
 * Notification key validation for Homey Flow upsert.
 * Uniqueness is (displayId + notificationKey), not global.
 */

/** Max length after trim (UTF-16 code units). */
export const NOTIFICATION_KEY_MAX_LENGTH = 64;

/**
 * Allowed characters: letters, digits, `.`, `_`, `-`.
 * No spaces or control characters.
 */
const NOTIFICATION_KEY_PATTERN = /^[A-Za-z0-9._-]+$/;

export type NotificationKeyNormalizeResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly message: string };

export function normalizeNotificationKey(
  value: unknown,
): NotificationKeyNormalizeResult {
  if (typeof value !== 'string') {
    return { ok: false, message: 'invalid_key' };
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return { ok: false, message: 'invalid_key' };
  }

  if (trimmed.length > NOTIFICATION_KEY_MAX_LENGTH) {
    return { ok: false, message: 'invalid_key' };
  }

  if (!NOTIFICATION_KEY_PATTERN.test(trimmed)) {
    return { ok: false, message: 'invalid_key' };
  }

  return { ok: true, value: trimmed };
}

export function notificationKeyIndexId(
  displayId: string,
  notificationKey: string,
): string {
  return `${displayId}\u0000${notificationKey}`;
}
