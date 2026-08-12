import {
  DISPLAY_ONLINE_TIMEOUT_MS,
  type OnlineStatus,
} from './types';

export function resolveOnlineStatus(
  lastSeenAt: Date | null,
  now: Date = new Date(),
  timeoutMs: number = DISPLAY_ONLINE_TIMEOUT_MS,
): OnlineStatus {
  if (!lastSeenAt) {
    return 'offline';
  }

  const ageMs = now.getTime() - lastSeenAt.getTime();
  if (ageMs < 0 || ageMs > timeoutMs) {
    return 'offline';
  }

  return 'online';
}
