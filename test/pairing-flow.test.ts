import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdapterRegistry } from '../lib/adapters/AdapterRegistry';
import { GenericWebDisplayAdapter } from '../lib/adapters/GenericWebDisplayAdapter';
import { ShellyWallDisplayAdapter } from '../lib/adapters/ShellyWallDisplayAdapter';
import { ADAPTER_IDS, LAYOUT_IDS } from '../lib/adapters/types';
import type { JsonHttpClient } from '../lib/http/JsonHttpClient';
import { PairingFlow, type PairingSessionPort } from '../lib/pairing/PairingFlow';

class MockJsonHttpClient implements JsonHttpClient {
  public constructor(private readonly payload: unknown | Error) {}

  public async getJson(): Promise<unknown> {
    if (this.payload instanceof Error) {
      throw this.payload;
    }
    return this.payload;
  }
}

class MemorySession implements PairingSessionPort {
  public readonly handlers = new Map<string, (data: unknown) => Promise<unknown>>();

  public setHandler(
    event: string,
    handler: (data: unknown) => Promise<unknown>,
  ): void {
    this.handlers.set(event, handler);
  }

  public async emit(event: string, data?: unknown): Promise<unknown> {
    const handler = this.handlers.get(event);
    if (!handler) {
      throw new Error(`Missing handler ${event}`);
    }
    return handler(data);
  }
}

const translations: Record<string, string> = {
  'errors.invalidIp': 'Enter a valid IPv4 address.',
  'errors.unknownAdapter': 'Select a valid adapter.',
  'errors.deviceNotIdentified': 'No identified device is available to confirm.',
  'errors.notShellyWallDisplay': 'No Shelly Wall Display was found at this IP address.',
  'device.notAvailable': 'Not available',
  'device.defaultNameShelly': 'Shelly Wall Display',
  'device.defaultNameGeneric': 'Generic Web Display',
  'adapters.shelly_wall_display': 'Shelly Wall Display',
  'adapters.generic_web_display': 'Generic Web Display',
};

function createShellyFlow(httpPayload: unknown | Error): MemorySession {
  const flow = new PairingFlow({
    registry: new AdapterRegistry([
      new ShellyWallDisplayAdapter(new MockJsonHttpClient(httpPayload)),
    ]),
    mode: 'identify_required',
    adapterId: ADAPTER_IDS.SHELLY_WALL_DISPLAY,
    translate: (key) => translations[key] ?? key,
    createId: () => 'generated-uuid',
  });
  const session = new MemorySession();
  flow.bind(session);
  return session;
}

function createGenericFlow(): MemorySession {
  const flow = new PairingFlow({
    registry: new AdapterRegistry([new GenericWebDisplayAdapter()]),
    mode: 'ip_only',
    adapterId: ADAPTER_IDS.GENERIC_WEB_DISPLAY,
    translate: (key) => translations[key] ?? key,
    createId: () => 'generated-uuid',
  });
  const session = new MemorySession();
  flow.bind(session);
  return session;
}

describe('PairingFlow', () => {
  it('rejects an invalid IP before probing', async () => {
    const session = createShellyFlow(new Error('unused'));
    await assert.rejects(
      () => session.emit('probe', { ip: 'bad' }),
      /Enter a valid IPv4 address/,
    );
  });

  it('returns confirm when a Shelly Wall Display is recognized', async () => {
    const session = createShellyFlow({
      id: 'shellywalldisplay-1',
      mac: 'AABBCCDDEEFF',
      model: 'SAWD-0A1XX10EU1',
      app: 'WallDisplay',
      ver: '1.0.0',
    });

    const probe = await session.emit('probe', { ip: '192.168.1.20' });
    assert.deepEqual(probe, {
      ok: true,
      ip: '192.168.1.20',
      nextView: 'confirm',
    });

    const device = (await session.emit('get_pairing_device')) as {
      data: { id: string };
      settings: { ip: string; layout: string; model: string };
      store: { adapterId: string };
    };

    assert.equal(device.data.id, 'shellywalldisplay-1');
    assert.equal(device.settings.ip, '192.168.1.20');
    assert.equal(device.settings.model, 'SAWD-0A1XX10EU1');
    assert.equal(device.settings.layout, LAYOUT_IDS.GRID_2X2);
    assert.equal(device.store.adapterId, ADAPTER_IDS.SHELLY_WALL_DISPLAY);
  });

  it('rejects unrecognized devices for the Shelly driver', async () => {
    const session = createShellyFlow(new Error('offline'));
    await assert.rejects(
      () => session.emit('probe', { ip: '192.168.1.20' }),
      /No Shelly Wall Display was found/,
    );
  });

  it('pairs Generic Web Display by IP without probing hardware', async () => {
    const session = createGenericFlow();
    const probe = await session.emit('probe', { ip: '10.0.0.8' });
    assert.deepEqual(probe, {
      ok: true,
      ip: '10.0.0.8',
      nextView: 'ready',
    });

    const device = (await session.emit('get_pairing_device')) as {
      data: { id: string };
      settings: { ip: string; layout: string };
      store: { adapterId: string; adapterAutoDetected: boolean };
    };

    assert.equal(device.data.id, 'generated-uuid');
    assert.equal(device.settings.ip, '10.0.0.8');
    assert.equal(device.settings.layout, LAYOUT_IDS.GRID_2X4);
    assert.equal(device.store.adapterId, ADAPTER_IDS.GENERIC_WEB_DISPLAY);
    assert.equal(device.store.adapterAutoDetected, false);
    assert.equal('manufacturer' in device.settings, false);
  });
});
