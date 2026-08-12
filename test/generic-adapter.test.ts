import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GenericWebDisplayAdapter } from '../lib/adapters/GenericWebDisplayAdapter';
import { LAYOUT_IDS } from '../lib/adapters/types';

describe('GenericWebDisplayAdapter', () => {
  it('never attempts recognition', async () => {
    const adapter = new GenericWebDisplayAdapter();
    assert.equal(adapter.canAutoIdentify, false);
    assert.equal(await adapter.tryIdentify('192.168.1.50'), null);
  });

  it('creates a 2x4 / 3x6 initial configuration', () => {
    const adapter = new GenericWebDisplayAdapter();
    const configuration = adapter.createInitialConfiguration();
    assert.equal(configuration.layoutId, LAYOUT_IDS.GRID_2X4);
    assert.deepEqual(configuration.supportedLayoutIds, [
      LAYOUT_IDS.GRID_2X4,
      LAYOUT_IDS.GRID_3X6,
    ]);
  });
});
