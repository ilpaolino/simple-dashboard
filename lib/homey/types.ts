/**
 * Normalized Homey Web API DTOs.
 * Homey remains the source of truth; these are snapshots, not copies to persist.
 */

export interface HomeyApiDeviceDto {
  readonly id: string;
  readonly name: string;
  readonly zoneId: string | null;
  readonly available: boolean;
  readonly capabilities: readonly string[];
  readonly capabilityValues: Readonly<Record<string, unknown>>;
}

export interface HomeyApiZoneDto {
  readonly id: string;
  readonly name: string;
}

export interface HomeyDeviceSnapshot {
  readonly id: string;
  readonly name: string;
  readonly zoneId: string | null;
  readonly zoneName: string | null;
  readonly available: boolean;
  readonly capabilities: readonly string[];
  readonly capabilityValues: Readonly<Record<string, unknown>>;
}

/**
 * Minimal editor DTO. No Homey capability objects or unused metadata.
 */
export interface CompatibleDeviceOption {
  readonly id: string;
  readonly name: string;
  readonly zoneName: string | null;
}

/**
 * Handle returned by {@link HomeyWebApi.subscribeCapability}.
 * Call `destroy()` to unsubscribe (reference-counted at a higher layer).
 */
export interface HomeyCapabilitySubscription {
  destroy(): void;
}

/**
 * Official Homey Web API surface used by this app.
 * @see https://athombv.github.io/node-homey-api/HomeyAPI.html
 * @see https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#makeCapabilityInstance
 * @see https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#setCapabilityValue
 */
export interface HomeyWebApi {
  getDevices(): Promise<readonly HomeyApiDeviceDto[]>;
  getDevice(id: string): Promise<HomeyApiDeviceDto | null>;
  getZones(): Promise<Readonly<Record<string, HomeyApiZoneDto>>>;
  subscribeCapability(options: {
    readonly deviceId: string;
    readonly capabilityId: string;
    readonly onValue: (value: unknown) => void;
    readonly onDestroyed?: () => void;
  }): Promise<HomeyCapabilitySubscription | null>;
  /**
   * Sets a capability value via the official Homey Web API.
   * Resolving means Homey accepted the request — not that the physical
   * device has confirmed the new state (realtime remains source of truth).
   */
  setCapabilityValue(options: {
    readonly deviceId: string;
    readonly capabilityId: string;
    readonly value: boolean | number | string;
  }): Promise<void>;
}
