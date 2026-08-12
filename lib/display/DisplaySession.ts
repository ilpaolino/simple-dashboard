import type { DisplaySession } from './types';

export function createDisplaySession(
  displayId: string,
  ipAddress: string,
  at: Date = new Date(),
): DisplaySession {
  return {
    displayId,
    ipAddress,
    connectedAt: at,
    lastSeenAt: at,
  };
}

export function touchDisplaySession(
  session: DisplaySession,
  at: Date = new Date(),
): DisplaySession {
  return {
    displayId: session.displayId,
    ipAddress: session.ipAddress,
    connectedAt: session.connectedAt,
    lastSeenAt: at,
  };
}
