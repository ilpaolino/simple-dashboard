/**
 * Realtime auto-open policy for the Notification Center.
 * Snapshot / reconnect must never storm historical items.
 */

export type NotificationPushKind = 'added' | 'updated' | 'restored' | 'snapshot';

/**
 * Flow Show / upsert is a new presentation even when the same key already
 * exists (doorbell rings again after auto-close). Content is already in the
 * visible list; skipping auto-open would hide the second event.
 */
export function shouldAutoOpenFromPush(
  autoOpen: boolean | undefined,
  kind: NotificationPushKind,
): boolean {
  if (autoOpen === false) {
    return false;
  }
  return kind !== 'snapshot';
}
