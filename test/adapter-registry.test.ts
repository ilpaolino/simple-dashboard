import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdapterRegistry, UnknownAdapterError } from '../lib/adapters/AdapterRegistry';
import { GenericWebDisplayAdapter } from '../lib/adapters/GenericWebDisplayAdapter';
import { ShellyWallDisplayAdapter } from '../lib/adapters/ShellyWallDisplayAdapter';
import { ADAPTER_IDS } from '../lib/adapters/types';
import type { JsonHttpClient } from '../lib/http/JsonHttpClient';

class MockJsonHttpClient implements JsonHttpClient {
  public constructor(private readonly payload: unknown | Error) {}

  public async getJson(): Promise<unknown> {
    if (this.payload instanceof Error) {
      throw this.payload;
    }
    return this.payload;
  }
}

describe('AdapterRegistry', () => {
  it('matches the first auto-identifying adapter and skips Generic', async () => {
    const registry = new AdapterRegistry([
      new ShellyWallDisplayAdapter(
        new MockJsonHttpClient({
          id: 'shellywalldisplay-1',
          model: 'SAWD-0A1XX10EU1',
          app: 'WallDisplay',
          ver: '1.0.0',
        }),
      ),
      new GenericWebDisplayAdapter(),
    ]);

    const result = await registry.identify('192.168.1.20');
    assert.equal(result.kind, 'matched');
    if (result.kind === 'matched') {
      assert.equal(result.adapter.id, ADAPTER_IDS.SHELLY_WALL_DISPLAY);
    }
  });

  it('returns unrecognized when no adapter matches', async () => {
    const registry = new AdapterRegistry([
      new ShellyWallDisplayAdapter(new MockJsonHttpClient(new Error('offline'))),
      new GenericWebDisplayAdapter(),
    ]);

    const result = await registry.identify('192.168.1.20');
    assert.deepEqual(result, { kind: 'unrecognized' });
  });

  it('resolves adapters by id', () => {
    const registry = new AdapterRegistry([
      new ShellyWallDisplayAdapter(new MockJsonHttpClient({})),
      new GenericWebDisplayAdapter(),
    ]);

    assert.equal(
      registry.getById(ADAPTER_IDS.GENERIC_WEB_DISPLAY).id,
      ADAPTER_IDS.GENERIC_WEB_DISPLAY,
    );
    assert.throws(() => registry.getById('missing'), UnknownAdapterError);
  });
});
