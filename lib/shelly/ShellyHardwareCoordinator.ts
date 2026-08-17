import type { Logger } from '../types';
import { parseIpv4 } from '../ip/ipv4';
import { featureChanges } from './mapFeatures';
import { ShellyWallDisplayHardwareService } from './ShellyWallDisplayHardwareService';
import { ShellyHardwareProfileStore } from './ShellyHardwareProfileStore';
import type {
  HardwareFeatureStatus,
  ShellyHardwareDiagnosticsEntry,
  ShellyHardwareProfileState,
  ShellyRebootResult,
} from './types';

export interface ShellyHardwareDeviceRef {
  readonly displayId: string;
  readonly ipAddress: string;
  readonly name: string;
}

export interface ShellyHardwareCoordinatorOptions {
  readonly hardwareService?: ShellyWallDisplayHardwareService;
  readonly store?: ShellyHardwareProfileStore;
  readonly logger?: Logger;
  readonly listDevices?: () => readonly ShellyHardwareDeviceRef[];
}

export interface PairingHardwareSummary {
  readonly discoveryStatus: ShellyHardwareProfileState['discoveryStatus'];
  readonly rebootStatus: HardwareFeatureStatus;
  readonly rpcMethodCount: number;
  readonly warningKey: string | null;
}

/**
 * Coordinates Shelly hardware discovery and commands for all Wall Displays.
 * Discovery runs at pairing, app startup (once), and manual maintenance — never periodic.
 */
export class ShellyHardwareCoordinator {
  private readonly hardwareService: ShellyWallDisplayHardwareService;
  private readonly store: ShellyHardwareProfileStore;
  private startupDiscoveryPromise: Promise<void> | null = null;

  public constructor(private readonly options: ShellyHardwareCoordinatorOptions = {}) {
    this.hardwareService =
      options.hardwareService ?? new ShellyWallDisplayHardwareService();
    this.store = options.store ?? new ShellyHardwareProfileStore();
  }

  public getProfileStore(): ShellyHardwareProfileStore {
    return this.store;
  }

  public getState(displayId: string): ShellyHardwareProfileState {
    return this.store.get(displayId);
  }

  public removeDisplay(displayId: string): void {
    this.store.remove(displayId);
  }

  public clear(): void {
    this.store.clear();
    this.startupDiscoveryPromise = null;
  }

  /**
   * One discovery pass for every configured Shelly display at app startup.
   * Sequential to avoid network bursts.
   */
  public runStartupDiscovery(): Promise<void> {
    if (!this.startupDiscoveryPromise) {
      this.startupDiscoveryPromise = this.discoverAllConfigured('startup');
    }
    return this.startupDiscoveryPromise;
  }

  public async discoverForDisplay(
    device: ShellyHardwareDeviceRef,
    reason: 'pairing' | 'startup' | 'manual',
  ): Promise<ShellyHardwareProfileState> {
    this.log('info', 'Shelly hardware discovery started', {
      displayId: device.displayId,
      ip: device.ipAddress,
      reason,
    });

    const previous = this.store.get(device.displayId);
    const result = await this.hardwareService.discoverCapabilities(
      {
        displayId: device.displayId,
        ipAddress: device.ipAddress,
      },
      previous,
    );

    this.store.set(result.state);

    if (result.state.discoveryStatus === 'successful') {
      this.log('info', 'Shelly hardware discovery succeeded', {
        displayId: device.displayId,
        rpcMethodCount: result.state.rpcMethodCount,
        reboot: result.state.profile?.features.reboot,
        reason,
      });
    } else {
      this.log('warn', 'Shelly hardware discovery failed', {
        displayId: device.displayId,
        status: result.state.discoveryStatus,
        error: result.state.lastHardwareError,
        reason,
      });
    }

    for (const change of result.featureChanges) {
      this.log('info', 'Shelly hardware feature changed', {
        displayId: device.displayId,
        feature: change.feature,
        from: change.from,
        to: change.to,
        reason,
      });
    }

    return result.state;
  }

  public async discoverAtPairing(ipAddress: string): Promise<PairingHardwareSummary> {
    const tempId = '__pairing__';
    const state = await this.discoverForDisplay(
      { displayId: tempId, ipAddress, name: 'pairing' },
      'pairing',
    );
    this.store.remove(tempId);

    const rebootStatus = state.profile?.features.reboot ?? 'unknown';
    return {
      discoveryStatus: state.discoveryStatus,
      rebootStatus,
      rpcMethodCount: state.rpcMethodCount,
      warningKey:
        state.discoveryStatus === 'successful'
          ? null
          : 'hardware.discovery.pairingWarning',
    };
  }

  public async rebootDisplay(device: ShellyHardwareDeviceRef): Promise<ShellyRebootResult> {
    this.log('info', 'Shelly reboot requested', {
      displayId: device.displayId,
      ip: device.ipAddress,
    });

    const state = this.store.get(device.displayId);
    const features = state.profile?.features ?? { reboot: 'unknown' as const };

    const result = await this.hardwareService.reboot(device.ipAddress, features);

    if (result.ok) {
      this.log('info', 'Shelly reboot RPC sent', {
        displayId: device.displayId,
        expectedDisconnect: true,
      });
      return result;
    }

    this.log('error', 'Shelly reboot failed', {
      displayId: device.displayId,
      error: result.error,
      message: result.message,
    });

    return result;
  }

  public listDiagnostics(
    devices: readonly ShellyHardwareDeviceRef[],
  ): readonly ShellyHardwareDiagnosticsEntry[] {
    return devices.map((device) =>
      this.store.buildDiagnosticsEntry({
        displayId: device.displayId,
        displayName: device.name,
        ipAddress: device.ipAddress,
      }),
    );
  }

  private async discoverAllConfigured(reason: 'startup'): Promise<void> {
    const devices = this.options.listDevices?.() ?? [];
    if (devices.length === 0) {
      this.log('info', 'Shelly startup hardware discovery skipped (no devices)', {
        reason,
      });
      return;
    }

    this.log('info', 'Shelly startup hardware discovery batch', {
      count: devices.length,
      reason,
    });

    for (const device of devices) {
      await this.discoverForDisplay(device, reason);
    }
  }

  private log(
    level: 'info' | 'warn' | 'error',
    message: string,
    details?: Record<string, unknown>,
  ): void {
    const logger = this.options.logger;
    if (!logger) {
      return;
    }
    if (details) {
      logger[level](message, details);
      return;
    }
    logger[level](message);
  }
}

export function readShellyDeviceRef(device: {
  getData(): unknown;
  getName(): string;
  getSettings(): unknown;
}): ShellyHardwareDeviceRef | null {
  const data = device.getData();
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const id = (data as Record<string, unknown>).id;
  if (typeof id !== 'string' || id.trim() === '') {
    return null;
  }

  const settings = device.getSettings();
  if (typeof settings !== 'object' || settings === null) {
    return null;
  }

  try {
    const ipAddress = parseIpv4((settings as Record<string, unknown>).ip);
    return {
      displayId: id,
      ipAddress,
      name: device.getName(),
    };
  } catch {
    return null;
  }
}

export { featureChanges };
