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
          id: 'light-1',
          type: 'light',
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
          config: { deviceId: 'lamp-1' },
        },
        {
          id: 'title-1',
          type: 'title',
          placement: { row: 0, column: 1, rowSpan: 1, columnSpan: 1 },
          config: { text: 'Hello', alignment: 'left' },
        },
      ],
    },
    ...overrides,
  };
}

function createApi(
  devices: HomeyApiDeviceDto[],
  options: {
    readonly failSet?: boolean;
  } = {},
): HomeyWebApi & { lastSet: { deviceId: string; value: unknown } | null } {
  const state = {
    lastSet: null as { deviceId: string; value: unknown } | null,
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
      state.lastSet = { deviceId: opts.deviceId, value: opts.value };
      const device = devices.find((item) => item.id === opts.deviceId);
      if (device && opts.capabilityId === 'onoff') {
        device.capabilityValues = { ...device.capabilityValues, onoff: opts.value };
      }
    },
  };
}

function lamp(overrides: Partial<HomeyApiDeviceDto> = {}): HomeyApiDeviceDto {
  return {
    id: 'lamp-1',
    name: 'Lamp',
    zoneId: null,
    available: true,
    capabilities: ['onoff'],
    capabilityValues: { onoff: false },
    ...overrides,
  };
}

function createHandler(api: HomeyWebApi, registry: DisplayRegistry) {
  const pending = new PendingCommandManager({
    onTimeout() {},
    timeoutMs: 50,
  });
  const metrics = new RealtimeMetrics();
  const handler = new WidgetCommandHandler({
    registry,
    deviceRepository: new HomeyDeviceRepository(api),
    pending,
    metrics,
    logger: createLogger(),
  });
  return { handler, pending, metrics };
}

describe('WidgetCommandHandler validation', () => {
  it('accepts a valid toggle and derives OFF → ON server-side', async () => {
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const api = createApi([lamp({ capabilityValues: { onoff: false } })]);
    const { handler } = createHandler(api, registry);

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'toggle',
      requestId: 'r1',
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.expectedValue, true);
    }
    assert.equal(api.lastSet?.value, true);
  });

  it('derives ON → OFF and ignores any client-declared target', async () => {
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const api = createApi([lamp({ capabilityValues: { onoff: true } })]);
    const { handler } = createHandler(api, registry);

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'toggle',
      requestId: 'r2',
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.expectedValue, false);
    }
    assert.equal(api.lastSet?.value, false);
  });

  it('rejects invalid display session', async () => {
    const registry = new DisplayRegistry();
    const api = createApi([lamp()]);
    const { handler } = createHandler(api, registry);

    const result = await handler.handle({
      displayId: 'missing',
      widgetId: 'light-1',
      action: 'toggle',
      requestId: 'r3',
    });
    assert.deepEqual(result, { ok: false, reason: 'display_session_invalid' });
  });

  it('rejects missing widget', async () => {
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const { handler } = createHandler(createApi([lamp()]), registry);

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'nope',
      action: 'toggle',
      requestId: 'r4',
    });
    assert.deepEqual(result, { ok: false, reason: 'widget_not_found' });
  });

  it('rejects widget belonging to another display', async () => {
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    registry.upsert(
      displaySnapshot({
        displayId: 'display-2',
        ipAddress: '10.0.0.2',
        dashboard: {
          version: 1,
          widgets: [
            {
              id: 'other-light',
              type: 'light',
              placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
              config: { deviceId: 'lamp-1' },
            },
          ],
        },
      }),
    );
    const { handler } = createHandler(createApi([lamp()]), registry);

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'other-light',
      action: 'toggle',
      requestId: 'r5',
    });
    assert.deepEqual(result, { ok: false, reason: 'widget_not_found' });
  });

  it('rejects non-light widget types', async () => {
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const { handler } = createHandler(createApi([lamp()]), registry);

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'title-1',
      action: 'toggle',
      requestId: 'r6',
    });
    assert.deepEqual(result, { ok: false, reason: 'widget_type_unsupported' });
  });

  it('rejects missing Homey device', async () => {
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const { handler } = createHandler(createApi([]), registry);

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'toggle',
      requestId: 'r7',
    });
    assert.deepEqual(result, { ok: false, reason: 'device_missing' });
  });

  it('rejects missing onoff capability', async () => {
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const { handler } = createHandler(
      createApi([
        lamp({
          capabilities: ['dim'],
          capabilityValues: { dim: 0.5 },
        }),
      ]),
      registry,
    );

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'toggle',
      requestId: 'r8',
    });
    assert.deepEqual(result, { ok: false, reason: 'capability_missing' });
  });

  it('rejects unavailable devices', async () => {
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const { handler } = createHandler(
      createApi([lamp({ available: false })]),
      registry,
    );

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'toggle',
      requestId: 'r9',
    });
    assert.deepEqual(result, { ok: false, reason: 'device_unavailable' });
  });

  it('rejects when Homey API set fails', async () => {
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const { handler, pending } = createHandler(
      createApi([lamp()], { failSet: true }),
      registry,
    );

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'toggle',
      requestId: 'r10',
    });
    assert.deepEqual(result, { ok: false, reason: 'homey_api_error' });
    assert.equal(pending.activeCount(), 0);
  });

  it('rejects concurrent pending for the same widget', async () => {
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const api = createApi([lamp()]);
    const { handler, pending } = createHandler(api, registry);

    const first = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'toggle',
      requestId: 'r11',
    });
    assert.equal(first.ok, true);

    const second = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'toggle',
      requestId: 'r12',
    });
    assert.deepEqual(second, { ok: false, reason: 'already_pending' });
    assert.equal(pending.activeCount(), 1);
    pending.destroy();
  });
});

describe('PendingCommandManager', () => {
  it('times out and cleans up timers', async () => {
    let timedOut = false;
    const pending = new PendingCommandManager({
      timeoutMs: 20,
      onTimeout: () => {
        timedOut = true;
      },
    });

    assert.equal(
      pending.register({
        requestId: 't1',
        displayId: 'd1',
        widgetId: 'w1',
        deviceId: 'lamp',
        action: 'toggle',
        expectedValue: true,
      }),
      true,
    );

    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(timedOut, true);
    assert.equal(pending.activeCount(), 0);
    pending.destroy();
  });

  it('does not leak across many success cycles', () => {
    const pending = new PendingCommandManager({
      timeoutMs: 5_000,
      onTimeout() {},
    });

    for (let i = 0; i < 50; i += 1) {
      const requestId = `cycle-${i}`;
      assert.equal(
        pending.register({
          requestId,
          displayId: 'd1',
          widgetId: 'w1',
          deviceId: 'lamp',
          action: 'toggle',
          expectedValue: true,
        }),
        true,
      );
      assert.ok(pending.resolveSuccess(requestId));
    }

    assert.equal(pending.activeCount(), 0);
    assert.ok(pending.listRecent().length <= 20);
    pending.destroy();
  });
});
