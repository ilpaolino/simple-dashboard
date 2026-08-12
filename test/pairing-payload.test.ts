import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GenericWebDisplayAdapter } from '../lib/adapters/GenericWebDisplayAdapter';
import { ADAPTER_IDS, LAYOUT_IDS } from '../lib/adapters/types';
import { resolveDeviceId } from '../lib/device/identity';
import { buildPairingDevice } from '../lib/device/pairingPayload';

describe('device identity', () => {
  it('prefers the detected unique id over IP', () => {
    assert.equal(
      resolveDeviceId({
        manufacturer: 'Shelly',
        model: 'SAWD-0A1XX10EU1',
        uniqueId: 'shellywalldisplay-1',
        serial: 'AABBCC',
      }),
      'shellywalldisplay-1',
    );
  });

  it('falls back to a generated id when nothing was detected', () => {
    assert.equal(resolveDeviceId(undefined, () => 'generated-uuid'), 'generated-uuid');
  });
});

describe('buildPairingDevice', () => {
  it('stores IP in settings and identity in data.id', () => {
    const device = buildPairingDevice({
      ip: '192.168.1.50',
      adapter: new GenericWebDisplayAdapter(),
      adapterName: 'Generic Web Display',
      adapterAutoDetected: false,
      notAvailable: 'Not available',
      defaultName: 'Wall Display',
      createId: () => 'generated-uuid',
    });

    assert.equal(device.data.id, 'generated-uuid');
    assert.equal(device.settings.ip, '192.168.1.50');
    assert.notEqual(device.data.id, device.settings.ip);
    assert.equal(device.store.adapterId, ADAPTER_IDS.GENERIC_WEB_DISPLAY);
    assert.equal(device.store.adapterAutoDetected, false);
    assert.equal(device.settings.layout, LAYOUT_IDS.GRID_2X4);
    assert.equal(device.store.configuration.layoutId, LAYOUT_IDS.GRID_2X4);
    assert.equal(device.settings.manufacturer, 'Not available');
  });

  it('uses detected unique id and information when available', () => {
    const device = buildPairingDevice({
      ip: '10.0.0.8',
      adapter: new GenericWebDisplayAdapter(),
      adapterName: 'Shelly Wall Display',
      adapterAutoDetected: true,
      info: {
        manufacturer: 'Shelly',
        model: 'SAWD-5A1XX10EU0',
        firmware: '2.3.0',
        serial: 'AABBCCDDEEFF',
        uniqueId: 'shellywalldisplay-aabbccddeeff',
        name: 'Kitchen Display',
      },
      notAvailable: 'Not available',
      defaultName: 'Wall Display',
    });

    assert.equal(device.data.id, 'shellywalldisplay-aabbccddeeff');
    assert.equal(device.name, 'Kitchen Display');
    assert.equal(device.settings.ip, '10.0.0.8');
    assert.equal(device.settings.model, 'SAWD-5A1XX10EU0');
    assert.equal(device.settings.firmware, '2.3.0');
    assert.equal(device.store.adapterAutoDetected, true);
  });
});
