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
  'device.notAvailable': 'Not available',
  'device.defaultName': 'Wall Display',
  'adapters.shelly_wall_display': 'Shelly Wall Display',
  'adapters.generic_web_display': 'Generic Web Display',
};

function createFlow(httpPayload: unknown | Error): {
  flow: PairingFlow;
  session: MemorySession;
} {
  const flow = new PairingFlow({
    registry: new AdapterRegistry([
      new ShellyWallDisplayAdapter(new MockJsonHttpClient(httpPayload)),
      new GenericWebDisplayAdapter(),
    ]),
    translate: (key) => translations[key] ?? key,
    createId: () => 'generated-uuid',
  });
  const session = new MemorySession();
  flow.bind(session);
  return { flow, session };
}

describe('PairingFlow', () => {
  it('rejects an invalid IP before probing', async () => {
    const { session } = createFlow(new Error('unused'));
    await assert.rejects(
      () => session.emit('probe', { ip: 'bad' }),
      /Enter a valid IPv4 address/,
    );
  });

  it('returns confirm when a Shelly Wall Display is recognized', async () => {
    const { session } = createFlow({
      id: 'shellywalldisplay-1',
      mac: 'AABBCCDDEEFF',
      model: 'SAWD-0A1XX10EU1',
      ver: '2.1.0',
      app: 'WallDisplay',
    });

    const probe = await session.emit('probe', { ip: '192.168.1.50' });
    assert.deepEqual(probe, {
      ok: true,
      ip: '192.168.1.50',
      nextView: 'confirm',
    });

    const info = await session.emit('get_detected_info');
    assert.deepEqual(info, {
      manufacturer: 'Shelly',
      model: 'SAWD-0A1XX10EU1',
      firmware: '2.1.0',
      serial: 'AABBCCDDEEFF',
      adapterName: 'Shelly Wall Display',
    });

    const device = (await session.emit('get_pairing_device')) as {
      data: { id: string };
      settings: { ip: string; layout: string };
      store: { adapterAutoDetected: boolean };
    };
    assert.equal(device.data.id, 'shellywalldisplay-1');
    assert.equal(device.settings.ip, '192.168.1.50');
    assert.equal(device.settings.layout, LAYOUT_IDS.GRID_2X2);
    assert.equal(device.store.adapterAutoDetected, true);
  });

  it('returns select_adapter when the device is unknown', async () => {
    const { session } = createFlow(new Error('offline'));

    const probe = await session.emit('probe', { ip: '192.168.1.50' });
    assert.deepEqual(probe, {
      ok: true,
      ip: '192.168.1.50',
      nextView: 'select_adapter',
    });

    const adapters = await session.emit('list_adapters');
    assert.deepEqual(adapters, [
      { id: ADAPTER_IDS.SHELLY_WALL_DISPLAY, name: 'Shelly Wall Display' },
      { id: ADAPTER_IDS.GENERIC_WEB_DISPLAY, name: 'Generic Web Display' },
    ]);

    await session.emit('select_adapter', {
      adapterId: ADAPTER_IDS.GENERIC_WEB_DISPLAY,
    });

    const device = (await session.emit('get_pairing_device')) as {
      data: { id: string };
      settings: { ip: string; layout: string; adapter: string };
      store: { adapterId: string; adapterAutoDetected: boolean };
    };
    assert.equal(device.data.id, 'generated-uuid');
    assert.notEqual(device.data.id, '192.168.1.50');
    assert.equal(device.settings.ip, '192.168.1.50');
    assert.equal(device.settings.adapter, 'Generic Web Display');
    assert.equal(device.settings.layout, LAYOUT_IDS.GRID_2X4);
    assert.equal(device.store.adapterId, ADAPTER_IDS.GENERIC_WEB_DISPLAY);
    assert.equal(device.store.adapterAutoDetected, false);
  });
});
