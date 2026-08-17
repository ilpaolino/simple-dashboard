import { featureChanges, mapMethodsToFeatures } from './mapFeatures';
import {
  ShellyWallDisplayRpcClient,
  shellyRpcErrorCode,
} from './ShellyWallDisplayRpcClient';
import type {
  HardwareDiscoveryStatus,
  ShellyHardwareFeatures,
  ShellyHardwareProfile,
  ShellyHardwareProfileState,
  ShellyRebootResult,
} from './types';
import { ShellyRpcError } from './types';

export interface ShellyWallDisplayHardwareServiceOptions {
  readonly rpcClient?: ShellyWallDisplayRpcClient;
}

export interface DiscoverHardwareInput {
  readonly displayId: string;
  readonly ipAddress: string;
}

export interface DiscoverHardwareResult {
  readonly state: ShellyHardwareProfileState;
  readonly featureChanges: ReturnType<typeof featureChanges>;
}

/**
 * Hardware semantics for Shelly Wall Display — no raw RPC in callers.
 */
export class ShellyWallDisplayHardwareService {
  private readonly rpcClient: ShellyWallDisplayRpcClient;

  public constructor(options: ShellyWallDisplayHardwareServiceOptions = {}) {
    this.rpcClient = options.rpcClient ?? new ShellyWallDisplayRpcClient();
  }

  public async discoverCapabilities(
    input: DiscoverHardwareInput,
    previous: ShellyHardwareProfileState | null,
  ): Promise<DiscoverHardwareResult> {
    const ip = input.ipAddress.trim();
    if (ip === '') {
      return this.failedState(input.displayId, previous, 'device_offline', 'missing_ip');
    }

    try {
      const methods = await this.rpcClient.listMethods(ip);
      const features = mapMethodsToFeatures(methods, true);
      const profile: ShellyHardwareProfile = {
        discoveredAt: Date.now(),
        methods,
        features,
      };

      const changes = featureChanges(previous?.profile?.features ?? null, features);

      return {
        state: {
          displayId: input.displayId,
          discoveryStatus: 'successful',
          profile,
          lastDiscoveryAt: profile.discoveredAt,
          lastHardwareError: null,
          rpcMethodCount: methods.length,
        },
        featureChanges: changes,
      };
    } catch (error) {
      const code = shellyRpcErrorCode(error);
      const discoveryStatus = toDiscoveryStatus(code);
      return this.failedState(input.displayId, previous, discoveryStatus, code, error);
    }
  }

  public async reboot(
    ipAddress: string,
    features: ShellyHardwareFeatures,
  ): Promise<ShellyRebootResult> {
    const ip = ipAddress.trim();
    if (ip === '') {
      return {
        ok: false,
        error: 'device_offline',
        message: 'missing_ip',
      };
    }

    if (features.reboot === 'unsupported') {
      return {
        ok: false,
        error: 'unsupported_method',
        message: 'reboot_unsupported',
      };
    }

    if (features.reboot === 'unknown') {
      return {
        ok: false,
        error: 'rpc_error',
        message: 'reboot_unknown',
      };
    }

    try {
      await this.rpcClient.reboot(ip);
      return { ok: true, expectedDisconnect: true };
    } catch (error) {
      const code = shellyRpcErrorCode(error);
      return {
        ok: false,
        error: code,
        message: error instanceof ShellyRpcError ? error.message : 'reboot_failed',
      };
    }
  }

  private failedState(
    displayId: string,
    previous: ShellyHardwareProfileState | null,
    discoveryStatus: HardwareDiscoveryStatus,
    errorCode: string,
    cause?: unknown,
  ): DiscoverHardwareResult {
    const message =
      cause instanceof Error ? cause.message : errorCode;

    return {
      state: {
        displayId,
        discoveryStatus,
        profile: previous?.profile ?? null,
        lastDiscoveryAt: previous?.lastDiscoveryAt ?? null,
        lastHardwareError: message,
        rpcMethodCount: previous?.rpcMethodCount ?? 0,
      },
      featureChanges: [],
    };
  }
}

function toDiscoveryStatus(code: ReturnType<typeof shellyRpcErrorCode>): HardwareDiscoveryStatus {
  if (code === 'timeout' || code === 'network' || code === 'http_status') {
    return 'device_offline';
  }
  if (code === 'malformed_response' || code === 'rpc_error') {
    return 'failed';
  }
  return 'failed';
}
