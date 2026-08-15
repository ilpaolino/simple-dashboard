import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HomeyDeviceRepository } from '../lib/homey/HomeyDeviceRepository';
import {
  parseHomeyApiDevice,
  parseHomeyApiDeviceCollection,
  parseHomeyApiZoneCollection,
} from '../lib/homey/parseHomeyApi';
import type {
  HomeyApiDeviceDto,
  HomeyApiZoneDto,
  HomeyWebApi,
} from '../lib/homey/types';

class MemoryHomeyWebApi implements HomeyWebApi {
  public constructor(
    private readonly devices: readonly HomeyApiDeviceDto[],
    private readonly zones: Readonly<Record<string, HomeyApiZoneDto>> = {},
    private readonly failDevices = false,
  ) {}

  public async getDevices(): Promise<readonly HomeyApiDeviceDto[]> {
    if (this.failDevices) {
      throw new Error('Homey API error');
    }
    return this.devices;
  }

  public async getDevice(id: string): Promise<HomeyApiDeviceDto | null> {
    if (this.failDevices) {
      throw new Error('Homey API error');
    }
    return this.devices.find((device) => device.id === id) ?? null;
  }

  public async getZones(): Promise<Readonly<Record<string, HomeyApiZoneDto>>> {
    return this.zones;
  }

  public async subscribeCapability(): Promise<null> {
    return null;
  }

  public async setCapabilityValue(): Promise<void> {
    // no-op for repository listing tests
  }
}

function lightDevice(
  overrides: Partial<HomeyApiDeviceDto> = {},
): HomeyApiDeviceDto {
  return {
    id: 'light-1',
    name: 'Lampada divano',
    zoneId: 'zone-living',
    available: true,
    capabilities: ['onoff'],
    capabilityValues: { onoff: true },
    ...overrides,
  };
}

describe('Homey API DTO parsing', () => {
  it('parses devices and zones from Homey Web API payloads', () => {
    const parsed = parseHomeyApiDevice({
      id: 'abc',
      name: 'Lamp',
      zone: 'z1',
      available: true,
      capabilities: ['onoff', 'dim'],
      capabilitiesObj: { onoff: { value: false }, dim: { value: 0.4 } },
    });
    assert.deepEqual(parsed, {
      id: 'abc',
      name: 'Lamp',
      zoneId: 'z1',
      available: true,
      capabilities: ['onoff', 'dim'],
      capabilityValues: { onoff: false, dim: 0.4 },
    });

    const collection = parseHomeyApiDeviceCollection({
      abc: {
        id: 'abc',
        name: 'Lamp',
        zone: 'z1',
        available: true,
        capabilities: ['onoff'],
        capabilitiesObj: { onoff: { value: true } },
      },
    });
    assert.equal(collection.length, 1);

    const zones = parseHomeyApiZoneCollection({
      z1: { id: 'z1', name: 'Soggiorno' },
    });
    assert.equal(zones.z1?.name, 'Soggiorno');
  });
});

describe('HomeyDeviceRepository', () => {
  it('lists devices and looks up by id', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi(
        [lightDevice(), lightDevice({ id: 'switch-1', name: 'Switch', capabilities: ['onoff'] })],
        { 'zone-living': { id: 'zone-living', name: 'Soggiorno' } },
      ),
    );

    const listed = await repository.listDevices();
    assert.equal(listed.length, 2);

    const found = await repository.getDevice('light-1');
    assert.equal(found?.name, 'Lampada divano');
    assert.equal(found?.zoneName, 'Soggiorno');

    const missing = await repository.getDevice('nope');
    assert.equal(missing, null);
  });

  it('resolves zone name when present and falls back when absent', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi(
        [
          lightDevice(),
          lightDevice({
            id: 'light-2',
            name: 'Lampada ingresso',
            zoneId: null,
          }),
          lightDevice({
            id: 'light-3',
            name: 'Lampada persa',
            zoneId: 'missing-zone',
          }),
        ],
        { 'zone-living': { id: 'zone-living', name: 'Soggiorno' } },
      ),
    );

    const withZone = await repository.getDevice('light-1');
    const noZone = await repository.getDevice('light-2');
    const unknownZone = await repository.getDevice('light-3');

    assert.equal(withZone?.zoneName, 'Soggiorno');
    assert.equal(noZone?.zoneName, null);
    assert.equal(unknownZone?.zoneName, null);
  });

  it('exposes onoff capability values and availability', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([
        lightDevice({ capabilityValues: { onoff: false } }),
        lightDevice({
          id: 'offline',
          name: 'Offline lamp',
          available: false,
        }),
      ]),
    );

    const onoff = await repository.getDevice('light-1');
    const offline = await repository.getDevice('offline');
    assert.equal(onoff?.capabilityValues.onoff, false);
    assert.equal(onoff?.capabilities.includes('onoff'), true);
    assert.equal(offline?.available, false);
  });

  it('filters compatible light devices for the editor', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi(
        [
          lightDevice(),
          lightDevice({
            id: 'sensor-1',
            name: 'Temp',
            capabilities: ['measure_temperature'],
            capabilityValues: {},
          }),
        ],
        { 'zone-living': { id: 'zone-living', name: 'Soggiorno' } },
      ),
    );

    const options = await repository.listCompatibleLightDevices();
    assert.equal(options.length, 1);
    assert.deepEqual(options[0], {
      id: 'light-1',
      name: 'Lampada divano',
      zoneName: 'Soggiorno',
    });
  });

  it('propagates Homey API errors from listDevices', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([], {}, true),
    );
    await assert.rejects(() => repository.listDevices(), /Homey API error/);
  });
});
