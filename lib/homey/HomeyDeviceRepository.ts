import type {
  CompatibleDeviceOption,
  HomeyApiDeviceDto,
  HomeyApiZoneDto,
  HomeyDeviceSnapshot,
  HomeyWebApi,
} from './types';
import { isCompatibleWithLightWidget } from '../widgets/light/compatibility';

/**
 * Backend-only access to Homey devices. The frontend never calls Homey APIs.
 *
 * Each method hits Homey Web API on demand. There is no long-lived device cache
 * so names, zones, availability, and capability values stay Homey's source of truth.
 */
export class HomeyDeviceRepository {
  public constructor(private readonly api: HomeyWebApi) {}

  public async listDevices(): Promise<readonly HomeyDeviceSnapshot[]> {
    const devices = await this.api.getDevices();
    const zones = await this.loadZones();
    return devices.map((device) => this.toSnapshot(device, zones));
  }

  public async getDevice(id: string): Promise<HomeyDeviceSnapshot | null> {
    const device = await this.api.getDevice(id);
    if (!device) {
      return null;
    }

    const zones = await this.loadZones();
    return this.toSnapshot(device, zones);
  }

  public async listCompatibleLightDevices(): Promise<
    readonly CompatibleDeviceOption[]
  > {
    const devices = await this.listDevices();
    return devices
      .filter((device) => isCompatibleWithLightWidget(device))
      .map((device) => ({
        id: device.id,
        name: device.name,
        zoneName: device.zoneName,
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private async loadZones(): Promise<Readonly<Record<string, HomeyApiZoneDto>>> {
    try {
      return await this.api.getZones();
    } catch {
      // A missing zone map must not break device listing or the editor selector.
      return {};
    }
  }

  private toSnapshot(
    device: HomeyApiDeviceDto,
    zones: Readonly<Record<string, HomeyApiZoneDto>>,
  ): HomeyDeviceSnapshot {
    const zoneName =
      device.zoneId !== null ? (zones[device.zoneId]?.name ?? null) : null;

    return {
      id: device.id,
      name: device.name,
      zoneId: device.zoneId,
      zoneName,
      available: device.available,
      capabilities: device.capabilities,
      capabilityValues: device.capabilityValues,
    };
  }
}

/**
 * Used when Homey Web API cannot be initialized. Callers treat thrown errors
 * as API failures and keep the rest of the dashboard rendering.
 */
export class UnavailableHomeyWebApi implements HomeyWebApi {
  public async getDevices(): Promise<never> {
    throw new Error('Homey Web API is not available');
  }

  public async getDevice(): Promise<never> {
    throw new Error('Homey Web API is not available');
  }

  public async getZones(): Promise<never> {
    throw new Error('Homey Web API is not available');
  }
}
