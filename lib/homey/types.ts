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
 * Official Homey Web API surface used by this app.
 * @see https://athombv.github.io/node-homey-api/HomeyAPI.html
 */
export interface HomeyWebApi {
  getDevices(): Promise<readonly HomeyApiDeviceDto[]>;
  getDevice(id: string): Promise<HomeyApiDeviceDto | null>;
  getZones(): Promise<Readonly<Record<string, HomeyApiZoneDto>>>;
}
