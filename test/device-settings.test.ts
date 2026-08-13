import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LAYOUT_IDS } from '../lib/adapters/types';
import {
  isLayoutSupported,
  withExpandedSupportedLayouts,
  withLayout,
} from '../lib/device/configuration';
import { validateDeviceSettingsChange } from '../lib/device/settingsValidation';
import type { WallDisplayStore } from '../lib/device/types';
import { ADAPTER_IDS } from '../lib/adapters/types';

const store: WallDisplayStore = {
  adapterId: ADAPTER_IDS.SHELLY_WALL_DISPLAY,
  adapterAutoDetected: true,
  configuration: {
    version: 1,
    layoutId: LAYOUT_IDS.GRID_2X2,
    supportedLayoutIds: [LAYOUT_IDS.GRID_2X2, LAYOUT_IDS.GRID_3X3],
    recommended: { capabilities: [] },
  },
};

describe('validateDeviceSettingsChange', () => {
  it('accepts a valid IP change without touching identity', () => {
    const result = validateDeviceSettingsChange({
      changedKeys: ['ip'],
      newSettings: { ip: '10.0.0.20' },
      store,
    });
    assert.deepEqual(result, { ok: true });
  });

  it('rejects an invalid IP', () => {
    const result = validateDeviceSettingsChange({
      changedKeys: ['ip'],
      newSettings: { ip: 'not-an-ip' },
      store,
    });
    assert.deepEqual(result, { ok: false, errorKey: 'errors.invalidIp' });
  });

  it('rejects adapter changes from settings', () => {
    const result = validateDeviceSettingsChange({
      changedKeys: ['adapter'],
      newSettings: { adapter: 'Generic Web Display' },
      store,
    });
    assert.deepEqual(result, { ok: false, errorKey: 'errors.adapterReadOnly' });
  });

  it('accepts a supported layout and updates stored configuration', () => {
    const result = validateDeviceSettingsChange({
      changedKeys: ['layout'],
      newSettings: { layout: LAYOUT_IDS.GRID_3X3 },
      store,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.updatedConfiguration?.layoutId, LAYOUT_IDS.GRID_3X3);
      assert.deepEqual(
        result.updatedConfiguration?.supportedLayoutIds,
        store.configuration.supportedLayoutIds,
      );
    }
  });

  it('rejects a layout that the stored configuration does not support', () => {
    const result = validateDeviceSettingsChange({
      changedKeys: ['layout'],
      newSettings: { layout: LAYOUT_IDS.GRID_3X6 },
      store,
    });
    assert.deepEqual(result, { ok: false, errorKey: 'errors.unsupportedLayout' });
  });

  it('accepts landscape variants on an older Generic configuration', () => {
    const genericStore: WallDisplayStore = {
      adapterId: ADAPTER_IDS.GENERIC_WEB_DISPLAY,
      adapterAutoDetected: false,
      configuration: {
        version: 1,
        layoutId: LAYOUT_IDS.GRID_2X4,
        supportedLayoutIds: [LAYOUT_IDS.GRID_2X4, LAYOUT_IDS.GRID_3X6],
        recommended: { capabilities: [] },
      },
    };

    const result = validateDeviceSettingsChange({
      changedKeys: ['layout'],
      newSettings: { layout: LAYOUT_IDS.GRID_4X2 },
      store: genericStore,
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.updatedConfiguration?.layoutId, LAYOUT_IDS.GRID_4X2);
      assert.deepEqual(result.updatedConfiguration?.supportedLayoutIds, [
        LAYOUT_IDS.GRID_2X4,
        LAYOUT_IDS.GRID_4X2,
        LAYOUT_IDS.GRID_3X6,
        LAYOUT_IDS.GRID_6X3,
      ]);
    }
  });
});

describe('configuration helpers', () => {
  it('reports supported layouts from the stored configuration', () => {
    assert.equal(isLayoutSupported(store.configuration, LAYOUT_IDS.GRID_2X2), true);
    assert.equal(isLayoutSupported(store.configuration, LAYOUT_IDS.GRID_2X4), false);
    assert.equal(withLayout(store.configuration, LAYOUT_IDS.GRID_3X3).layoutId, LAYOUT_IDS.GRID_3X3);
  });

  it('expands older Generic layout lists with landscape variants', () => {
    const expanded = withExpandedSupportedLayouts(
      {
        version: 1,
        layoutId: LAYOUT_IDS.GRID_2X4,
        supportedLayoutIds: [LAYOUT_IDS.GRID_2X4, LAYOUT_IDS.GRID_3X6],
        recommended: { capabilities: [] },
      },
      [
        LAYOUT_IDS.GRID_2X4,
        LAYOUT_IDS.GRID_4X2,
        LAYOUT_IDS.GRID_3X6,
        LAYOUT_IDS.GRID_6X3,
      ],
    );

    assert.equal(expanded.layoutId, LAYOUT_IDS.GRID_2X4);
    assert.deepEqual(expanded.supportedLayoutIds, [
      LAYOUT_IDS.GRID_2X4,
      LAYOUT_IDS.GRID_4X2,
      LAYOUT_IDS.GRID_3X6,
      LAYOUT_IDS.GRID_6X3,
    ]);
  });
});
