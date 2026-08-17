import { createDisplaySession, touchDisplaySession } from './DisplaySession';
import { normalizeClientIp } from './ipNormalize';
import type {
  DisplaySession,
  DisplaySnapshot,
  DisplayTypeId,
  MatchStatus,
  OnlineStatus,
  RegisteredDisplay,
} from './types';
import type { LightWidgetDiagnostic } from '../widgets/light/types';
import type { CoverWidgetDiagnostic } from '../widgets/cover/types';

function emptyRuntime(): RegisteredDisplay['runtime'] {
  return {
    lastSeenAt: null,
    session: null,
    lastMatchStatus: null,
    lastErrorKey: null,
    lastRenderedAt: null,
    lastLayoutErrorKey: null,
    lastDashboardErrorKey: null,
    lastDashboardLoadedAt: null,
    lastLightWidgetDiagnostics: [],
    lastCoverWidgetDiagnostics: [],
    realtimeConnectionId: null,
    realtimeConnectedAt: null,
    realtimeRemoteAddress: null,
    realtimeLastHeartbeatAt: null,
    realtimeSubscribedDeviceCount: 0,
    realtimeReconnectCount: 0,
    realtimeSeen: false,
  };
}

/**
 * Runtime registry of configured wall displays.
 * Rebuilt from Homey Devices — never a second persistence layer.
 */
export class DisplayRegistry {
  private readonly byId = new Map<string, RegisteredDisplay>();

  public clear(): void {
    this.byId.clear();
  }

  /**
   * Full rebuild from Homey Device snapshots.
   * Drops orphans and resets all runtime state.
   */
  public rebuild(snapshots: readonly DisplaySnapshot[]): void {
    this.byId.clear();
    for (const snapshot of snapshots) {
      this.byId.set(snapshot.displayId, {
        config: snapshot,
        runtime: emptyRuntime(),
      });
    }
  }

  public upsert(snapshot: DisplaySnapshot): void {
    const existing = this.byId.get(snapshot.displayId);
    this.byId.set(snapshot.displayId, {
      config: snapshot,
      runtime: existing?.runtime ?? emptyRuntime(),
    });
  }

  public remove(displayId: string): void {
    this.byId.delete(displayId);
  }

  public getById(displayId: string): RegisteredDisplay | null {
    return this.byId.get(displayId) ?? null;
  }

  public getAll(): readonly RegisteredDisplay[] {
    return [...this.byId.values()];
  }

  public count(): number {
    return this.byId.size;
  }

  /**
   * IP is routing only. Returns the first display configured with this IP.
   */
  public findByIp(rawIp: string): RegisteredDisplay | null {
    const ip = normalizeClientIp(rawIp);
    for (const entry of this.byId.values()) {
      if (normalizeClientIp(entry.config.ipAddress) === ip) {
        return entry;
      }
    }
    return null;
  }

  /** Returns true when another display already uses this IP (routing collision). */
  public isIpTaken(rawIp: string, excludeDisplayId?: string): boolean {
    const ip = normalizeClientIp(rawIp);
    for (const entry of this.byId.values()) {
      if (excludeDisplayId && entry.config.displayId === excludeDisplayId) {
        continue;
      }
      if (normalizeClientIp(entry.config.ipAddress) === ip) {
        return true;
      }
    }
    return false;
  }

  public touch(
    displayId: string,
    ipAddress: string,
    at: Date = new Date(),
  ): DisplaySession | null {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return null;
    }

    const session = entry.runtime.session
      ? touchDisplaySession(entry.runtime.session, at)
      : createDisplaySession(displayId, ipAddress, at);

    entry.runtime.session = session;
    entry.runtime.lastSeenAt = at;
    return session;
  }

  public setMatchResult(
    displayId: string,
    status: MatchStatus,
    errorKey: string | null = null,
  ): void {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return;
    }

    entry.runtime.lastMatchStatus = status;
    entry.runtime.lastErrorKey = errorKey;
  }

  public markDashboardRendered(
    displayId: string,
    at: Date = new Date(),
  ): void {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return;
    }

    entry.runtime.lastRenderedAt = at;
    entry.runtime.lastLayoutErrorKey = null;
    entry.runtime.lastDashboardLoadedAt = at.toISOString();
  }

  public markLayoutError(
    displayId: string,
    errorKey: string,
  ): void {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return;
    }

    entry.runtime.lastLayoutErrorKey = errorKey;
  }

  public markDashboardError(
    displayId: string,
    errorKey: string | null,
  ): void {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return;
    }

    entry.runtime.lastDashboardErrorKey = errorKey;
  }

  public markLightWidgetDiagnostics(
    displayId: string,
    diagnostics: readonly LightWidgetDiagnostic[],
  ): void {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return;
    }

    entry.runtime.lastLightWidgetDiagnostics = diagnostics;
  }

  public markCoverWidgetDiagnostics(
    displayId: string,
    diagnostics: readonly CoverWidgetDiagnostic[],
  ): void {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return;
    }

    entry.runtime.lastCoverWidgetDiagnostics = diagnostics;
  }

  public markRealtimeConnected(
    displayId: string,
    info: {
      readonly connectionId: string;
      readonly connectedAt: Date;
      readonly remoteAddress: string;
    },
  ): void {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return;
    }

    // Count a reconnect when this display already had a realtime session in-process.
    if (entry.runtime.realtimeSeen) {
      entry.runtime.realtimeReconnectCount += 1;
    }

    entry.runtime.realtimeSeen = true;
    entry.runtime.realtimeConnectionId = info.connectionId;
    entry.runtime.realtimeConnectedAt = info.connectedAt;
    entry.runtime.realtimeRemoteAddress = info.remoteAddress;
    entry.runtime.realtimeLastHeartbeatAt = info.connectedAt;
    entry.runtime.lastSeenAt = info.connectedAt;
  }

  public markRealtimeHeartbeat(
    displayId: string,
    at: Date = new Date(),
  ): void {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return;
    }

    entry.runtime.realtimeLastHeartbeatAt = at;
    entry.runtime.lastSeenAt = at;
  }

  public markRealtimeSubscribedDevices(
    displayId: string,
    count: number,
  ): void {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return;
    }

    entry.runtime.realtimeSubscribedDeviceCount = Math.max(0, count);
  }

  public markRealtimeDisconnected(displayId: string): void {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return;
    }

    entry.runtime.realtimeConnectionId = null;
    entry.runtime.realtimeConnectedAt = null;
    entry.runtime.realtimeRemoteAddress = null;
    entry.runtime.realtimeLastHeartbeatAt = null;
    entry.runtime.realtimeSubscribedDeviceCount = 0;
  }

  public getOnlineStatus(
    displayId: string,
    _now: Date = new Date(),
  ): OnlineStatus {
    const entry = this.byId.get(displayId);
    if (!entry) {
      return 'offline';
    }

    return entry.runtime.realtimeConnectionId ? 'online' : 'offline';
  }

  public listByType(typeId: DisplayTypeId): readonly RegisteredDisplay[] {
    return this.getAll().filter((entry) => entry.config.typeId === typeId);
  }
}
