import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ShellyWallDisplayAdapter } from '../lib/adapters/ShellyWallDisplayAdapter';
import { verifyHardwareIdentity } from '../lib/display/hardwareIdentity';
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

describe('verifyHardwareIdentity', () => {
  it('returns unavailable when no expected hardware id is stored', async () => {
    const adapter = new ShellyWallDisplayAdapter(new MockJsonHttpClient({}));
    const result = await verifyHardwareIdentity({
      adapter,
      ipAddress: '192.168.1.30',
      expectedHardwareId: null,
    });
    assert.deepEqual(result, { kind: 'unavailable' });
  });

  it('matches when Shelly reports the expected id', async () => {
    const adapter = new ShellyWallDisplayAdapter(
      new MockJsonHttpClient({
        id: 'shellywalldisplay-abc',
        model: 'SAWD-0A1XX10EU1',
        app: 'WallDisplay',
      }),
    );

    const result = await verifyHardwareIdentity({
      adapter,
      ipAddress: '192.168.1.30',
      expectedHardwareId: 'shellywalldisplay-abc',
    });

    assert.equal(result.kind, 'match');
  });

  it('reports mismatch when another Shelly is on the configured IP', async () => {
    const adapter = new ShellyWallDisplayAdapter(
      new MockJsonHttpClient({
        id: 'shellywalldisplay-xyz',
        model: 'SAWD-0A1XX10EU1',
        app: 'WallDisplay',
      }),
    );

    const result = await verifyHardwareIdentity({
      adapter,
      ipAddress: '192.168.1.30',
      expectedHardwareId: 'shellywalldisplay-abc',
    });

    assert.deepEqual(result, {
      kind: 'mismatch',
      expectedId: 'shellywalldisplay-abc',
      actualId: 'shellywalldisplay-xyz',
    });
  });

  it('returns unavailable when the probe fails', async () => {
    const adapter = new ShellyWallDisplayAdapter(
      new MockJsonHttpClient(new Error('offline')),
    );

    const result = await verifyHardwareIdentity({
      adapter,
      ipAddress: '192.168.1.30',
      expectedHardwareId: 'shellywalldisplay-abc',
    });

    assert.deepEqual(result, { kind: 'unavailable' });
  });
});
