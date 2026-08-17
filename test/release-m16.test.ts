/**
 * Milestone 16 — v1 release contracts: branding, compatibility, security, cleanup.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { describe, it } from 'node:test';
import { DisplayRegistry } from '../lib/display/DisplayRegistry';
import { DISPLAY_TYPE_IDS } from '../lib/display/types';
import { LAYOUT_IDS } from '../lib/adapters/types';
import { AppLogger } from '../lib/Logger';
import { HttpServer } from '../lib/HttpServer';
import { NotificationManager } from '../lib/notifications';
import { GenericDisplayPairingManager } from '../lib/pairing';
import { RealtimeSubscriptionManager } from '../lib/realtime/RealtimeSubscriptionManager';
import {
  parseDashboardConfiguration,
  validateDashboardConfiguration,
  emptyDashboardConfiguration,
} from '../lib/widgets';
import { resolveLayoutId } from '../lib/dashboard/layoutParse';
import type { HomeyCapabilitySubscription } from '../lib/homey/types';
import type { HomeyLogSink, HttpResponse, RequestInfo } from '../lib/types';

const ROOT = path.resolve(import.meta.dirname, '..');

describe('M16 branding vs technical identity', () => {
  it('keeps Homey app id dev.dadda.simpledashboard for upgrade compatibility', () => {
    const compose = JSON.parse(
      fs.readFileSync(path.join(ROOT, '.homeycompose/app.json'), 'utf8'),
    ) as { id: string; name: { en: string } };
    assert.equal(compose.id, 'dev.dadda.simpledashboard');
    assert.equal(compose.name.en, 'LocalDashboard');
  });

  it('keeps npm package name aligned with Homey app id', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
    ) as { name: string; version: string };
    assert.equal(pkg.name, 'dev.dadda.simpledashboard');
    assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  });
});

describe('M16 persisted dashboard compatibility', () => {
  it('accepts a legacy dashboard Device Store payload with light and cover widgets', () => {
    const parsed = parseDashboardConfiguration({
      version: 1,
      theme: 'dark',
      widgets: [
        {
          id: 'title-1',
          type: 'title',
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
          config: { text: 'Kitchen', alignment: 'left' },
        },
        {
          id: 'light-1',
          type: 'light',
          placement: { row: 1, column: 0, rowSpan: 1, columnSpan: 1 },
          config: { deviceId: 'homey-device-abc' },
        },
        {
          id: 'cover-1',
          type: 'cover',
          placement: { row: 1, column: 1, rowSpan: 1, columnSpan: 1 },
          config: { deviceId: 'homey-cover-xyz' },
        },
      ],
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }

    const grid = resolveLayoutId(LAYOUT_IDS.GRID_3X3);
    assert.equal(grid.ok, true);
    if (!grid.ok) {
      return;
    }

    const validated = validateDashboardConfiguration({
      grid: grid.config,
      configuration: parsed.configuration,
    });
    assert.equal(validated.ok, true);
  });

  it('accepts empty dashboard configuration (Device Store key dashboard)', () => {
    const empty = emptyDashboardConfiguration();
    const parsed = parseDashboardConfiguration(empty);
    assert.equal(parsed.ok, true);
    assert.deepEqual(empty, { version: 1, theme: 'dark', widgets: [] });
  });
});

describe('M16 driver and Flow identifier compatibility', () => {
  it('preserves driver folder ids used by Homey Compose', () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'drivers/generic_web_display')),
    );
    assert.ok(
      fs.existsSync(path.join(ROOT, 'drivers/shelly_wall_display')),
    );
  });

  it('preserves Generic notification Flow action ids', () => {
    const flow = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'drivers/generic_web_display/driver.flow.compose.json'),
        'utf8',
      ),
    ) as { actions: Array<{ id: string }> };
    const ids = flow.actions.map((action) => action.id).sort();
    assert.deepEqual(ids, [
      'remove_all_notifications',
      'remove_notification',
      'show_interactive_notification',
      'show_notification',
    ]);
  });

  it('preserves Shelly-prefixed Flow action ids', () => {
    const flow = JSON.parse(
      fs.readFileSync(
        path.join(ROOT, 'drivers/shelly_wall_display/driver.flow.compose.json'),
        'utf8',
      ),
    ) as { actions: Array<{ id: string }> };
    const ids = flow.actions.map((action) => action.id).sort();
    assert.deepEqual(ids, [
      'shelly_reboot_display',
      'shelly_remove_all_notifications',
      'shelly_remove_notification',
      'shelly_show_interactive_notification',
      'shelly_show_notification',
    ]);
  });
});

describe('M16 HTTP client IP trust', () => {
  it('ignores X-Forwarded-For and uses the socket remote address', async () => {
    const sink: HomeyLogSink = { log() {}, error() {} };
    const logger = new AppLogger(sink);
    let seenIp = '';

    const server = new HttpServer({
      host: '127.0.0.1',
      logger,
      requestHandler: (info: RequestInfo): HttpResponse => {
        seenIp = info.clientIp;
        return {
          statusCode: 200,
          contentType: 'text/plain; charset=utf-8',
          body: info.clientIp,
        };
      },
    });

    const port = await new Promise<number>((resolve, reject) => {
      const probe = http.createServer();
      probe.listen(0, '127.0.0.1', () => {
        const address = probe.address();
        if (!address || typeof address === 'string') {
          probe.close();
          reject(new Error('no port'));
          return;
        }
        const { port: freePort } = address;
        probe.close(() => resolve(freePort));
      });
    });

    await server.start(port);

    const response = await fetch(`http://127.0.0.1:${port}/`, {
      headers: { 'X-Forwarded-For': '192.168.99.99' },
    });
    const body = await response.text();

    assert.notEqual(body, '192.168.99.99');
    assert.equal(seenIp, body);
    assert.equal(seenIp, '127.0.0.1');

    await server.stop();
  });
});

describe('M16 notification media lifecycle', () => {
  it('revokes image HTTP access when media is cleared on update', () => {
    const manager = new NotificationManager();
    const published = manager.publishNotification({
      displayIds: ['display-1'],
      message: 'Ring',
      severity: 'info',
      media: {
        type: 'camera',
        sourceId: 'cam-1',
        hasImage: true,
        hasVideo: false,
        videoPlayable: false,
        playback: 'image',
      },
      mediaDeviceId: 'camera-device-1',
    });
    assert.equal(published.ok, true);
    if (!published.ok) {
      return;
    }

    assert.ok(manager.getMediaBinding(published.value.id));
    assert.ok(published.value.media);

    const updated = manager.updateNotification({
      id: published.value.id,
      media: null,
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) {
      return;
    }

    assert.equal(updated.value.media, undefined);
    assert.equal(manager.getMediaBinding(published.value.id), null);
  });
});

describe('M16 Generic pairing session bounds', () => {
  it('rejects direct consumption of an expired pairing code', () => {
    let now = new Date('2026-08-18T10:00:00.000Z');
    const manager = new GenericDisplayPairingManager({
      enableCleanupTimer: false,
      randomCode: () => '483921',
      now: () => now,
    });

    manager.getOrCreateForIp('192.168.1.60');
    now = new Date('2026-08-18T10:09:00.000Z');
    const consumed = manager.consume('483921');
    assert.equal(consumed, false);
    assert.equal(manager.pendingCount(), 0);
    manager.destroy();
  });
});

describe('M16 subscription acquisition cleanup', () => {
  it('creates only one Homey subscription when two displays subscribe concurrently', async () => {
    let subscribeCalls = 0;
    const fakeSubscription: HomeyCapabilitySubscription = {
      destroy() {},
    };

    const manager = new RealtimeSubscriptionManager({
      subscriber: {
        subscribeCapability: async () => {
          subscribeCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 5));
          return fakeSubscription;
        },
      },
      metrics: {
        setActiveSubscriptions() {},
      } as never,
      logger: { info() {}, warn() {}, error() {} },
      onCapabilityValue() {},
      onDeviceRemoved() {},
    });

    await Promise.all([
      manager.setDisplaySubscriptions('display-a', [
        { deviceId: 'lamp-1', capabilityId: 'onoff' },
      ]),
      manager.setDisplaySubscriptions('display-b', [
        { deviceId: 'lamp-1', capabilityId: 'onoff' },
      ]),
    ]);

    assert.equal(subscribeCalls, 1);
    assert.equal(manager.listDiagnostics()[0]?.refCount, 2);
    await manager.destroy();
  });
});

describe('M16 DisplayRegistry routing identity', () => {
  it('matches displays by configured IP without changing data.id semantics', () => {
    const registry = new DisplayRegistry();
    registry.upsert({
      displayId: 'uuid-display-1',
      name: 'Kitchen',
      typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
      ipAddress: '192.168.1.50',
      hardwareId: null,
      layoutId: LAYOUT_IDS.GRID_3X3,
      dashboard: emptyDashboardConfiguration(),
    });

    const match = registry.findByIp('192.168.1.50');
    assert.ok(match);
    assert.equal(match.config.displayId, 'uuid-display-1');
    assert.equal(registry.findByIp('192.168.1.51'), null);
  });
});
