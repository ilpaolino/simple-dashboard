/**
 * Normalized Shelly Wall Display hardware model (runtime only).
 * @see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly#shellylistmethods
 */

export type HardwareFeatureStatus = 'supported' | 'unsupported' | 'unknown';

export type HardwareDiscoveryStatus =
  | 'not_discovered'
  | 'successful'
  | 'failed'
  | 'device_offline';

/** Only features verified in official docs and mapped in {@link mapMethodsToFeatures}. */
export interface ShellyHardwareFeatures {
  readonly reboot: HardwareFeatureStatus;
}

export interface ShellyHardwareProfile {
  readonly discoveredAt: number;
  readonly methods: readonly string[];
  readonly features: ShellyHardwareFeatures;
}

export interface ShellyHardwareProfileState {
  readonly displayId: string;
  readonly discoveryStatus: HardwareDiscoveryStatus;
  readonly profile: ShellyHardwareProfile | null;
  readonly lastDiscoveryAt: number | null;
  readonly lastHardwareError: string | null;
  readonly rpcMethodCount: number;
}

export interface ShellyHardwareDiagnosticsEntry {
  readonly displayId: string;
  readonly displayName: string;
  readonly ipAddress: string;
  readonly discoveryStatus: HardwareDiscoveryStatus;
  readonly lastDiscoveryAt: number | null;
  readonly rpcMethodCount: number;
  readonly features: ShellyHardwareFeatures;
  readonly lastHardwareError: string | null;
  readonly methods: readonly string[] | null;
}

export type ShellyRpcErrorCode =
  | 'timeout'
  | 'network'
  | 'http_status'
  | 'malformed_response'
  | 'rpc_error'
  | 'unsupported_method'
  | 'device_offline';

export class ShellyRpcError extends Error {
  public constructor(
    public readonly code: ShellyRpcErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ShellyRpcError';
  }
}

export type ShellyRebootResult =
  | { readonly ok: true; readonly expectedDisconnect: true }
  | { readonly ok: false; readonly error: ShellyRpcErrorCode; readonly message: string };
