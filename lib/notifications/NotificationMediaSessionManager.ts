/**
 * At most one live media session per Display.
 * Tracks presentation lifecycle only — does not keep streams or buffers.
 */

export interface NotificationMediaSession {
  readonly displayId: string;
  readonly notificationId: string;
  readonly notificationKey: string | undefined;
  readonly deviceName: string | null;
  readonly playback: 'video' | 'image' | 'unavailable';
  readonly videoKind: string | null;
  readonly fallbackAvailable: boolean;
  readonly state: 'active';
  readonly startedAt: number;
}

export interface NotificationMediaSessionStartInput {
  readonly displayId: string;
  readonly notificationId: string;
  readonly notificationKey?: string;
  readonly deviceName?: string | null;
  readonly playback: 'video' | 'image' | 'unavailable';
  readonly videoKind?: string | null;
  readonly fallbackAvailable?: boolean;
}

export class NotificationMediaSessionManager {
  private readonly sessions = new Map<string, NotificationMediaSession>();
  private readonly now: () => number;

  public constructor(now: () => number = () => Date.now()) {
    this.now = now;
  }

  public start(
    input: NotificationMediaSessionStartInput,
  ): NotificationMediaSession {
    const session: NotificationMediaSession = {
      displayId: input.displayId,
      notificationId: input.notificationId,
      notificationKey: input.notificationKey,
      deviceName: input.deviceName ?? null,
      playback: input.playback,
      videoKind: input.videoKind ?? null,
      fallbackAvailable: input.fallbackAvailable === true,
      state: 'active',
      startedAt: this.now(),
    };
    this.sessions.set(input.displayId, session);
    return session;
  }

  public stop(displayId: string, notificationId?: string): boolean {
    const current = this.sessions.get(displayId);
    if (!current) {
      return false;
    }
    if (
      notificationId !== undefined &&
      current.notificationId !== notificationId
    ) {
      return false;
    }
    this.sessions.delete(displayId);
    return true;
  }

  public stopAllForDisplay(displayId: string): boolean {
    return this.sessions.delete(displayId);
  }

  public stopForNotification(notificationId: string): number {
    let stopped = 0;
    for (const [displayId, session] of this.sessions) {
      if (session.notificationId === notificationId) {
        this.sessions.delete(displayId);
        stopped += 1;
      }
    }
    return stopped;
  }

  public get(displayId: string): NotificationMediaSession | null {
    return this.sessions.get(displayId) ?? null;
  }

  public isActive(displayId: string, notificationId: string): boolean {
    const session = this.sessions.get(displayId);
    return session?.notificationId === notificationId;
  }

  public getActiveCount(): number {
    return this.sessions.size;
  }

  public list(): readonly NotificationMediaSession[] {
    return [...this.sessions.values()];
  }

  public reset(): void {
    this.sessions.clear();
  }
}
