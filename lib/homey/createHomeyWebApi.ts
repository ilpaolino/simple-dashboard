import { HomeyAPI } from 'homey-api';
import {
  parseHomeyApiDevice,
  parseHomeyApiDeviceCollection,
  parseHomeyApiZoneCollection,
} from './parseHomeyApi';
import type { HomeyApiDeviceDto, HomeyApiZoneDto, HomeyWebApi } from './types';

type HomeyApiSdk = {
  readonly devices: {
    getDevices(): Promise<unknown>;
    getDevice(opts: { id: string }): Promise<unknown>;
  };
  readonly zones: {
    getZones(): Promise<unknown>;
  };
};

/**
 * Official in-app Homey Web API client.
 * Requires permission `homey:manager:api`.
 *
 * @see https://apps.developer.homey.app/the-basics/app/permissions
 * @see https://athombv.github.io/node-homey-api/HomeyAPI.html#createAppAPI
 */
export async function createHomeyWebApi(homey: unknown): Promise<HomeyWebApi> {
  const api = (await HomeyAPI.createAppAPI({
    homey,
  })) as HomeyApiSdk;

  return new HomeyApiWebClient(api);
}

class HomeyApiWebClient implements HomeyWebApi {
  public constructor(private readonly api: HomeyApiSdk) {}

  public async getDevices(): Promise<readonly HomeyApiDeviceDto[]> {
    const payload = await this.api.devices.getDevices();
    return parseHomeyApiDeviceCollection(payload);
  }

  public async getDevice(id: string): Promise<HomeyApiDeviceDto | null> {
    try {
      const payload = await this.api.devices.getDevice({ id });
      return parseHomeyApiDevice(payload);
    } catch {
      return null;
    }
  }

  public async getZones(): Promise<Readonly<Record<string, HomeyApiZoneDto>>> {
    const payload = await this.api.zones.getZones();
    return parseHomeyApiZoneCollection(payload);
  }
}
