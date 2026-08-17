import { HomeyAPI } from 'homey-api';
import {
  parseHomeyApiDevice,
  parseHomeyApiDeviceCollection,
  parseHomeyApiZoneCollection,
} from './parseHomeyApi';
import type { HomeyImageBytes } from './NotificationMediaResolver';
import {
  NOTIFICATION_MEDIA_IMAGE_FETCH_TIMEOUT_MS,
  NOTIFICATION_MEDIA_IMAGE_MAX_BYTES,
} from '../notifications/mediaConstants';
import type {
  HomeyApiDeviceDto,
  HomeyApiZoneDto,
  HomeyCapabilitySubscription,
  HomeyWebApi,
} from './types';

export interface HomeyImageFetcher {
  fetchImage(url: string): Promise<HomeyImageBytes | null>;
}

type HomeyCapabilityInstance = {
  destroy(): void;
  on(event: 'destroy', listener: () => void): void;
};

type HomeyLiveDevice = {
  makeCapabilityInstance(
    capabilityId: string,
    listener: (value: unknown) => void,
  ): HomeyCapabilityInstance;
  setCapabilityValue(opts: {
    capabilityId: string;
    value: boolean | number | string;
  }): Promise<unknown>;
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

type HomeyApiHost = {
  readonly api?: {
    getLocalUrl?: () => Promise<string> | string;
    getOwnerApiToken?: () => Promise<string> | string;
  };
};

/**
 * Official in-app Homey Web API client.
 * Requires permission `homey:manager:api`.
 *
 * @see https://apps.developer.homey.app/the-basics/app/permissions
 * @see https://athombv.github.io/node-homey-api/HomeyAPI.html#createAppAPI
 * @see https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#makeCapabilityInstance
 * @see https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#setCapabilityValue
 * @see https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerImages.html
 */
export async function createHomeyWebApi(
  homey: unknown,
): Promise<HomeyWebApi & HomeyImageFetcher> {
  const api = (await HomeyAPI.createAppAPI({
    homey,
  })) as HomeyApiSdk;

  const host = homey as HomeyApiHost;
  let localUrl: string | null = null;
  let token: string | null = null;
  try {
    const rawUrl = await host.api?.getLocalUrl?.();
    if (typeof rawUrl === 'string' && rawUrl.trim() !== '') {
      localUrl = rawUrl.trim().replace(/\/+$/, '');
    }
  } catch {
    localUrl = null;
  }
  try {
    const rawToken = await host.api?.getOwnerApiToken?.();
    if (typeof rawToken === 'string' && rawToken.trim() !== '') {
      token = rawToken.trim();
    }
  } catch {
    token = null;
  }

  return new HomeyApiWebClient(api, localUrl, token);
}

class HomeyApiWebClient implements HomeyWebApi, HomeyImageFetcher {
  public constructor(
    private readonly api: HomeyApiSdk,
    private readonly localUrl: string | null,
    private readonly token: string | null,
  ) {}

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

  public async setCapabilityValue(options: {
    readonly deviceId: string;
    readonly capabilityId: string;
    readonly value: boolean | number | string;
  }): Promise<void> {
    const payload = await this.api.devices.getDevice({ id: options.deviceId });
    if (!payload || typeof payload !== 'object') {
      throw new Error('Homey device not found');
    }

    const device = payload as HomeyLiveDevice;
    if (typeof device.setCapabilityValue !== 'function') {
      throw new Error('Homey setCapabilityValue is unavailable');
    }

    await device.setCapabilityValue({
      capabilityId: options.capabilityId,
      value: options.value,
    });
  }

  /**
   * Fetch a Homey-managed image. Only same-host URLs relative to Homey's
   * local API are allowed (no arbitrary proxy / SSRF).
   */
  public async fetchImage(url: string): Promise<HomeyImageBytes | null> {
    if (!this.localUrl || !this.token) {
      return null;
    }

    let resolved: URL;
    try {
      resolved = new URL(url, `${this.localUrl}/`);
    } catch {
      return null;
    }

    let homeyOrigin: URL;
    try {
      homeyOrigin = new URL(this.localUrl);
    } catch {
      return null;
    }

    if (resolved.username !== '' || resolved.password !== '') {
      return null;
    }
    if (resolved.hostname !== homeyOrigin.hostname) {
      return null;
    }
    if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      NOTIFICATION_MEDIA_IMAGE_FETCH_TIMEOUT_MS,
    );
    try {
      resolved.searchParams.set('_sd', Date.now().toString());
      const response = await fetch(resolved.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        return null;
      }
      const lengthHeader = response.headers.get('content-length');
      if (lengthHeader !== null) {
        const length = Number.parseInt(lengthHeader, 10);
        if (
          Number.isFinite(length) &&
          length > NOTIFICATION_MEDIA_IMAGE_MAX_BYTES
        ) {
          return null;
        }
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > NOTIFICATION_MEDIA_IMAGE_MAX_BYTES) {
        return null;
      }
      const contentType = response.headers.get('content-type') ?? 'image/jpeg';
      return { bytes: buffer, contentType };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
