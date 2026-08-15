import { HomeyAPI } from 'homey-api';
import {
  parseHomeyApiDevice,
  parseHomeyApiDeviceCollection,
  parseHomeyApiZoneCollection,
} from './parseHomeyApi';
import type {
  HomeyApiDeviceDto,
  HomeyApiZoneDto,
  HomeyCapabilitySubscription,
  HomeyWebApi,
} from './types';

type HomeyCapabilityInstance = {
  destroy(): void;
  on(event: 'destroy', listener: () => void): void;
};

type HomeyLiveDevice = {
  makeCapabilityInstance(
    capabilityId: string,
    listener: (value: unknown) => void,
  ): HomeyCapabilityInstance;
};

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
 * @see https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#makeCapabilityInstance
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

  public async subscribeCapability(options: {
    readonly deviceId: string;
    readonly capabilityId: string;
    readonly onValue: (value: unknown) => void;
    readonly onDestroyed?: () => void;
  }): Promise<HomeyCapabilitySubscription | null> {
    let payload: unknown;
    try {
      payload = await this.api.devices.getDevice({ id: options.deviceId });
    } catch {
      return null;
    }

    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const device = payload as HomeyLiveDevice;
    if (typeof device.makeCapabilityInstance !== 'function') {
      return null;
    }

    const instance = device.makeCapabilityInstance(
      options.capabilityId,
      options.onValue,
    );

    if (options.onDestroyed) {
      instance.on('destroy', options.onDestroyed);
    }

    return {
      destroy(): void {
        instance.destroy();
      },
    };
  }
}
