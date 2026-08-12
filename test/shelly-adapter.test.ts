import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isShellyWallDisplay,
  parseShellyDeviceInfo,
  ShellyWallDisplayAdapter,
} from '../lib/adapters/ShellyWallDisplayAdapter';
import { LAYOUT_IDS } from '../lib/adapters/types';
import type { JsonHttpClient } from '../lib/http/JsonHttpClient';

class MockJsonHttpClient implements JsonHttpClient {
  public constructor(
    private readonly impl: (url: string) => Promise<unknown>,
  ) {}

  public getJson(url: string): Promise<unknown> {
    return this.impl(url);
  }
}

const wallDisplayInfo = {
  id: 'shellywalldisplay-aabbccddeeff',
  mac: 'AABBCCDDEEFF',
  model: 'SAWD-5A1XX10EU0',
  ver: '2.3.0',
  app: 'WallDisplay',
};

describe('ShellyWallDisplayAdapter', () => {
  it('parses official Shelly.GetDeviceInfo payloads', () => {
    const parsed = parseShellyDeviceInfo(wallDisplayInfo);
    assert.ok(parsed);
    assert.equal(parsed.id, wallDisplayInfo.id);
    assert.equal(parsed.model, wallDisplayInfo.model);
    assert.equal(isShellyWallDisplay(parsed), true);
  });

  it('does not treat other Shelly products as wall displays', () => {
    const parsed = parseShellyDeviceInfo({
      id: 'shellypro4pm-f008d1d8b8b8',
      mac: 'F008D1D8B8B8',
      model: 'SPSW-004PE16EU',
      ver: '0.6.7',
      app: 'FourPro',
    });
    assert.ok(parsed);
    assert.equal(isShellyWallDisplay(parsed), false);
  });

  it('identifies a reachable Wall Display and maps detected fields', async () => {
    const adapter = new ShellyWallDisplayAdapter(
      new MockJsonHttpClient(async (url) => {
        assert.equal(url, 'http://192.168.1.50/rpc/Shelly.GetDeviceInfo');
        return wallDisplayInfo;
      }),
    );

    const info = await adapter.tryIdentify('192.168.1.50');
    assert.ok(info);
    assert.equal(info.manufacturer, 'Shelly');
    assert.equal(info.model, 'SAWD-5A1XX10EU0');
    assert.equal(info.firmware, '2.3.0');
    assert.equal(info.serial, 'AABBCCDDEEFF');
    assert.equal(info.uniqueId, 'shellywalldisplay-aabbccddeeff');
  });

  it('returns null when the HTTP call fails', async () => {
    const adapter = new ShellyWallDisplayAdapter(
      new MockJsonHttpClient(async () => {
        throw new Error('timeout');
      }),
    );

    assert.equal(await adapter.tryIdentify('192.168.1.50'), null);
  });

  it('creates a 2x2 / 3x3 initial configuration', () => {
    const adapter = new ShellyWallDisplayAdapter(
      new MockJsonHttpClient(async () => wallDisplayInfo),
    );
    const configuration = adapter.createInitialConfiguration();
    assert.equal(configuration.layoutId, LAYOUT_IDS.GRID_2X2);
    assert.deepEqual(configuration.supportedLayoutIds, [
      LAYOUT_IDS.GRID_2X2,
      LAYOUT_IDS.GRID_3X3,
    ]);
  });
});
