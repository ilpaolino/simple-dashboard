import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DisplayRegistry } from '../lib/display/DisplayRegistry';
import { DISPLAY_TYPE_IDS } from '../lib/display/types';
import type { DisplaySnapshot } from '../lib/display/types';
import { LAYOUT_IDS } from '../lib/adapters/types';
import { emptyDashboardConfiguration } from '../lib/widgets';

function shelly(overrides: Partial<DisplaySnapshot> = {}): DisplaySnapshot {
  return {
    displayId: 'shellywalldisplay-1',
    name: 'Kitchen',
    typeId: DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY,
    ipAddress: '192.168.1.30',
    hardwareId: 'shellywalldisplay-1',
    layoutId: LAYOUT_IDS.GRID_3X3,
    dashboard: emptyDashboardConfiguration(),
    ...overrides,
  };
}

function generic(overrides: Partial<DisplaySnapshot> = {}): DisplaySnapshot {
  return {
    displayId: 'generated-uuid',
    name: 'Office',
    typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
    ipAddress: '192.168.1.40',
    hardwareId: null,
    layoutId: LAYOUT_IDS.GRID_2X4,
    dashboard: emptyDashboardConfiguration(),
    ...overrides,
  };
}

describe('DisplayRegistry', () => {
  it('starts empty', () => {
    const registry = new DisplayRegistry();
    assert.equal(registry.count(), 0);
    assert.deepEqual(registry.getAll(), []);
  });

  it('is populated from Homey device snapshots', () => {
    const registry = new DisplayRegistry();
    registry.rebuild([shelly(), generic()]);
    assert.equal(registry.count(), 2);
    assert.equal(registry.getById('shellywalldisplay-1')?.config.name, 'Kitchen');
  });

  it('matches displays by IP and leaves unknown IPs unmatched', () => {
    const registry = new DisplayRegistry();
    registry.rebuild([shelly(), generic()]);

    assert.equal(
      registry.findByIp('192.168.1.30')?.config.displayId,
      'shellywalldisplay-1',
    );
    assert.equal(
      registry.findByIp('::ffff:192.168.1.40')?.config.displayId,
      'generated-uuid',
    );
    assert.equal(registry.findByIp('192.168.1.50'), null);
  });

  it('removes devices without leaving orphans', () => {
    const registry = new DisplayRegistry();
    registry.rebuild([shelly(), generic()]);
    registry.remove('shellywalldisplay-1');

    assert.equal(registry.count(), 1);
    assert.equal(registry.findByIp('192.168.1.30'), null);
    assert.equal(registry.getById('shellywalldisplay-1'), null);
  });

  it('rebuild drops orphans and resets runtime state', () => {
    const registry = new DisplayRegistry();
    registry.rebuild([shelly(), generic()]);
    registry.touch('shellywalldisplay-1', '192.168.1.30');
    registry.setMatchResult('shellywalldisplay-1', 'recognized');

    assert.ok(registry.getById('shellywalldisplay-1')?.runtime.lastSeenAt);

    registry.rebuild([generic()]);

    assert.equal(registry.count(), 1);
    assert.equal(registry.getById('shellywalldisplay-1'), null);
    assert.equal(registry.getById('generated-uuid')?.runtime.lastSeenAt, null);
    assert.equal(registry.getById('generated-uuid')?.runtime.session, null);
  });

  it('tracks online status from active realtime sessions only', () => {
    const registry = new DisplayRegistry();
    registry.rebuild([generic()]);

    assert.equal(registry.getOnlineStatus('generated-uuid'), 'offline');

    const now = new Date('2026-08-13T10:00:00.000Z');
    registry.touch('generated-uuid', '192.168.1.40', now);
    // HTTP touch alone does not mark the display online.
    assert.equal(registry.getOnlineStatus('generated-uuid', now), 'offline');

    registry.markRealtimeConnected('generated-uuid', {
      connectionId: 'conn-1',
      connectedAt: now,
      remoteAddress: '192.168.1.40',
    });
    assert.equal(registry.getOnlineStatus('generated-uuid', now), 'online');

    registry.markRealtimeDisconnected('generated-uuid');
    assert.equal(registry.getOnlineStatus('generated-uuid', now), 'offline');
  });

  it('stores hardware mismatch match status for Shelly displays', () => {
    const registry = new DisplayRegistry();
    registry.rebuild([shelly()]);
    registry.setMatchResult(
      'shellywalldisplay-1',
      'hardware_mismatch',
      'pages.mismatch.heading',
    );

    const entry = registry.getById('shellywalldisplay-1');
    assert.equal(entry?.runtime.lastMatchStatus, 'hardware_mismatch');
    assert.equal(entry?.runtime.lastErrorKey, 'pages.mismatch.heading');
  });

  it('matches Generic displays by IP without hardware id', () => {
    const registry = new DisplayRegistry();
    registry.rebuild([generic()]);
    const entry = registry.findByIp('192.168.1.40');
    assert.equal(entry?.config.typeId, DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY);
    assert.equal(entry?.config.hardwareId, null);
  });
});
