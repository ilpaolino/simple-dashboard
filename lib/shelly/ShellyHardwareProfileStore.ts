import type {
  ShellyHardwareDiagnosticsEntry,
  ShellyHardwareProfileState,
} from './types';

function emptyState(displayId: string): ShellyHardwareProfileState {
  return {
    displayId,
    discoveryStatus: 'not_discovered',
    profile: null,
    lastDiscoveryAt: null,
    lastHardwareError: null,
    rpcMethodCount: 0,
  };
}

/**
 * Runtime-only Shelly hardware profiles keyed by display id.
 * Not persisted — rediscovered at pairing, startup, and manual request.
 */
export class ShellyHardwareProfileStore {
  private readonly byDisplayId = new Map<string, ShellyHardwareProfileState>();

  public clear(): void {
    this.byDisplayId.clear();
  }

  public remove(displayId: string): void {
    this.byDisplayId.delete(displayId);
  }

  public get(displayId: string): ShellyHardwareProfileState {
    return this.byDisplayId.get(displayId) ?? emptyState(displayId);
  }

  public set(state: ShellyHardwareProfileState): void {
    this.byDisplayId.set(state.displayId, state);
  }

  public getAll(): readonly ShellyHardwareProfileState[] {
    return [...this.byDisplayId.values()];
  }

  public buildDiagnosticsEntry(input: {
    readonly displayId: string;
    readonly displayName: string;
    readonly ipAddress: string;
  }): ShellyHardwareDiagnosticsEntry {
    const state = this.get(input.displayId);
    const features = state.profile?.features ?? {
      reboot: 'unknown' as const,
    };

    return {
      displayId: input.displayId,
      displayName: input.displayName,
      ipAddress: input.ipAddress,
      discoveryStatus: state.discoveryStatus,
      lastDiscoveryAt: state.lastDiscoveryAt,
      rpcMethodCount: state.rpcMethodCount,
      features,
      lastHardwareError: state.lastHardwareError,
      methods: state.profile?.methods ?? null,
    };
  }
}
