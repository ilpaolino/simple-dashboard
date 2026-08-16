import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DisplayRegistry } from '../lib/display/DisplayRegistry';
import { DISPLAY_TYPE_IDS } from '../lib/display/types';
import type { DisplaySnapshot } from '../lib/display/types';
import { LAYOUT_IDS } from '../lib/adapters/types';
import { HomeyDeviceRepository } from '../lib/homey/HomeyDeviceRepository';
import type { HomeyApiDeviceDto, HomeyWebApi } from '../lib/homey/types';
import { AppLogger } from '../lib/Logger';
import { PendingCommandManager } from '../lib/realtime/PendingCommandManager';
import { RealtimeMetrics } from '../lib/realtime/RealtimeMetrics';
import { WidgetCommandHandler } from '../lib/realtime/WidgetCommandHandler';
import type { HomeyLogSink } from '../lib/types';

function createLogger(): AppLogger {
  const sink: HomeyLogSink = {
    log() {},
    error() {},
  };
  return new AppLogger(sink);
}

function displaySnapshot(
  overrides: Partial<DisplaySnapshot> = {},
): DisplaySnapshot {
  return {
    displayId: 'display-1',
    name: 'Kitchen',
    typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
    ipAddress: '127.0.0.1',
    hardwareId: null,
    layoutId: LAYOUT_IDS.GRID_3X3,
    dashboard: {
      version: 1,
      widgets: [
        {
          id: 'cover-1',
          type: 'cover',
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
          config: { deviceId: 'cover-dev' },
        },
        {
          id: 'light-1',
          type: 'light',
          placement: { row: 0, column: 1, rowSpan: 1, columnSpan: 1 },
          config: { deviceId: 'lamp-1' },
        },
      ],
    },
    ...overrides,
  };
}

function createApi(
  devices: HomeyApiDeviceDto[],
  options: { readonly failSet?: boolean } = {},
): HomeyWebApi & {
  lastSet: {
    deviceId: string;
    capabilityId: string;
    value: unknown;
  } | null;
} {
  const state = {
    lastSet: null as {
      deviceId: string;
      capabilityId: string;
      value: unknown;
    } | null,
  };

  return {
    get lastSet() {
      return state.lastSet;
    },
    async getDevices() {
      return devices;
    },
    async getDevice(id: string) {
      return devices.find((device) => device.id === id) ?? null;
    },
    async getZones() {
      return {};
    },
    async subscribeCapability() {
      return null;
    },
    async setCapabilityValue(opts) {
      if (options.failSet) {
        throw new Error('Homey API error');
      }
      state.lastSet = {
        deviceId: opts.deviceId,
        capabilityId: opts.capabilityId,
        value: opts.value,
      };
    },
  };
}

function coverDevice(
  overrides: Partial<HomeyApiDeviceDto> = {},
): HomeyApiDeviceDto {
  return {
    id: 'cover-dev',
    name: 'Tapparella',
    zoneId: null,
    available: true,
    capabilities: ['windowcoverings_set'],
    capabilityValues: { windowcoverings_set: 0.2 },
    ...overrides,
  };
}

function createHandler(devices: HomeyApiDeviceDto[]) {
  const registry = new DisplayRegistry();
  registry.upsert(displaySnapshot());
  const api = createApi(devices);
  const repository = new HomeyDeviceRepository(api);
  const metrics = new RealtimeMetrics();
  const pending = new PendingCommandManager({
    timeoutMs: 5_000,
    onTimeout() {},
  });
  const handler = new WidgetCommandHandler({
    registry,
    deviceRepository: repository,
    pending,
    metrics,
    logger: createLogger(),
  });
  return { handler, api, pending, metrics, registry };
}

describe('Cover WidgetCommandHandler', () => {
  it('accepts set-position and denormalizes percent for Homey', async () => {
    const { handler, api } = createHandler([coverDevice()]);
    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'set-position',
      requestId: 'c1',
      positionPercent: 80,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.expectedValue, 80);
      assert.equal(result.capabilityId, 'windowcoverings_set');
    }
    assert.deepEqual(api.lastSet, {
      deviceId: 'cover-dev',
      capabilityId: 'windowcoverings_set',
      value: 0.8,
    });
  });

  it('maps Open/Close as 100% and 0%', async () => {
    const { handler, api } = createHandler([coverDevice()]);
    const open = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'set-position',
      requestId: 'open-1',
      positionPercent: 100,
    });
    assert.equal(open.ok, true);
    assert.equal(api.lastSet?.value, 1);

    const { handler: handler2, api: api2 } = createHandler([coverDevice()]);
    const close = await handler2.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'set-position',
      requestId: 'close-1',
      positionPercent: 0,
    });
    assert.equal(close.ok, true);
    assert.equal(api2.lastSet?.value, 0);
  });

  it('rejects out-of-range position', async () => {
    const { handler } = createHandler([coverDevice()]);
    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'set-position',
      requestId: 'bad',
      positionPercent: 150,
    });
    assert.deepEqual(result, { ok: false, reason: 'invalid_position' });
  });

  it('rejects stop when windowcoverings_state is missing', async () => {
    const { handler } = createHandler([coverDevice()]);
    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'stop',
      requestId: 'stop-1',
    });
    assert.deepEqual(result, { ok: false, reason: 'action_not_allowed' });
  });

  it('accepts stop when officially supported', async () => {
    const { handler, api } = createHandler([
      coverDevice({
        capabilities: ['windowcoverings_set', 'windowcoverings_state'],
        capabilityValues: {
          windowcoverings_set: 0.4,
          windowcoverings_state: 'up',
        },
      }),
    ]);
    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'stop',
      requestId: 'stop-2',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(api.lastSet, {
      deviceId: 'cover-dev',
      capabilityId: 'windowcoverings_state',
      value: 'idle',
    });
  });

  it('rejects commanding a cover on another display', async () => {
    const { handler, registry } = createHandler([coverDevice()]);
    registry.upsert(
      displaySnapshot({
        displayId: 'display-2',
        ipAddress: '10.0.0.2',
        dashboard: {
          version: 1,
          widgets: [
            {
              id: 'cover-other',
              type: 'cover',
              placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
              config: { deviceId: 'cover-dev' },
            },
          ],
        },
      }),
    );

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-other',
      action: 'set-position',
      requestId: 'x1',
      positionPercent: 50,
    });
    assert.deepEqual(result, { ok: false, reason: 'widget_not_found' });
  });

  it('rejects concurrent set-position while pending', async () => {
    const { handler } = createHandler([coverDevice()]);
    const first = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'set-position',
      requestId: 'p1',
      positionPercent: 50,
    });
    assert.equal(first.ok, true);

    const second = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'set-position',
      requestId: 'p2',
      positionPercent: 60,
    });
    assert.deepEqual(second, { ok: false, reason: 'already_pending' });
  });

  it('allows stop to replace an in-flight set-position', async () => {
    const { handler, pending } = createHandler([
      coverDevice({
        capabilities: ['windowcoverings_set', 'windowcoverings_state'],
        capabilityValues: {
          windowcoverings_set: 0.2,
          windowcoverings_state: 'up',
        },
      }),
    ]);

    const move = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'set-position',
      requestId: 'move-1',
      positionPercent: 90,
    });
    assert.equal(move.ok, true);
    assert.equal(pending.activeCount(), 1);

    const stop = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'stop',
      requestId: 'stop-3',
    });
    assert.equal(stop.ok, true);
    assert.equal(pending.getByRequestId('move-1'), null);
    assert.ok(pending.getByRequestId('stop-3'));
  });

  it('rejects client-supplied device control via light widget id', async () => {
    const { handler } = createHandler([
      coverDevice(),
      {
        id: 'lamp-1',
        name: 'Lamp',
        zoneId: null,
        available: true,
        capabilities: ['onoff'],
        capabilityValues: { onoff: false },
      },
    ]);
    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'set-position',
      requestId: 'forge',
      positionPercent: 50,
    });
    assert.deepEqual(result, { ok: false, reason: 'action_not_allowed' });
  });
});
