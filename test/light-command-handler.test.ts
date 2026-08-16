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

function displaySnapshot(): DisplaySnapshot {
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
          id: 'cover-1',
          type: 'cover',
          placement: { row: 0, column: 1, rowSpan: 1, columnSpan: 1 },
          config: { deviceId: 'cover-dev' },
        },
      ],
    },
  };
}

function createApi(
  devices: HomeyApiDeviceDto[],
): HomeyWebApi & {
  writes: Array<{ deviceId: string; capabilityId: string; value: unknown }>;
} {
  const writes: Array<{
    deviceId: string;
    capabilityId: string;
    value: unknown;
  }> = [];

  return {
    writes,
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
      writes.push({
        deviceId: opts.deviceId,
        capabilityId: opts.capabilityId,
        value: opts.value,
      });
    },
  };
}

function lamp(capabilities: string[], values: Record<string, unknown>) {
  return {
    id: 'lamp-1',
    name: 'Lamp',
    zoneId: 'z1',
    available: true,
    capabilities,
    capabilityValues: values,
  } satisfies HomeyApiDeviceDto;
}

describe('LightWidget advanced commands', () => {
  it('accepts set-dim and denormalizes to Homey [0,1]', async () => {
    const api = createApi([
      lamp(['onoff', 'dim'], { onoff: true, dim: 0.2 }),
    ]);
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const handler = new WidgetCommandHandler({
      registry,
      deviceRepository: new HomeyDeviceRepository(api),
      pending: new PendingCommandManager({ onTimeout() {} }),
      metrics: new RealtimeMetrics(),
      logger: createLogger(),
    });

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'set-dim',
      requestId: 'r1',
      valuePercent: 75,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(api.writes, [
      { deviceId: 'lamp-1', capabilityId: 'dim', value: 0.75 },
    ]);
  });

  it('rejects set-dim when capability missing', async () => {
    const api = createApi([lamp(['onoff'], { onoff: true })]);
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const handler = new WidgetCommandHandler({
      registry,
      deviceRepository: new HomeyDeviceRepository(api),
      pending: new PendingCommandManager({ onTimeout() {} }),
      metrics: new RealtimeMetrics(),
      logger: createLogger(),
    });

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'set-dim',
      requestId: 'r1',
      valuePercent: 50,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, 'capability_missing');
    }
  });

  it('rejects out-of-range dim percent', async () => {
    const api = createApi([
      lamp(['onoff', 'dim'], { onoff: true, dim: 0.5 }),
    ]);
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const handler = new WidgetCommandHandler({
      registry,
      deviceRepository: new HomeyDeviceRepository(api),
      pending: new PendingCommandManager({ onTimeout() {} }),
      metrics: new RealtimeMetrics(),
      logger: createLogger(),
    });

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'set-dim',
      requestId: 'r1',
      valuePercent: 150,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, 'invalid_value');
    }
  });

  it('sets temperature and light_mode when present', async () => {
    const api = createApi([
      lamp(['onoff', 'light_temperature', 'light_mode'], {
        onoff: true,
        light_temperature: 0.2,
        light_mode: 'color',
      }),
    ]);
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const handler = new WidgetCommandHandler({
      registry,
      deviceRepository: new HomeyDeviceRepository(api),
      pending: new PendingCommandManager({ onTimeout() {} }),
      metrics: new RealtimeMetrics(),
      logger: createLogger(),
    });

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'set-temperature',
      requestId: 'r1',
      valuePercent: 0,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(api.writes, [
      { deviceId: 'lamp-1', capabilityId: 'light_mode', value: 'temperature' },
      { deviceId: 'lamp-1', capabilityId: 'light_temperature', value: 0 },
    ]);
  });

  it('sets color hue+saturation and mode', async () => {
    const api = createApi([
      lamp(
        ['onoff', 'light_hue', 'light_saturation', 'light_mode'],
        {
          onoff: true,
          light_hue: 0,
          light_saturation: 1,
          light_mode: 'temperature',
        },
      ),
    ]);
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const handler = new WidgetCommandHandler({
      registry,
      deviceRepository: new HomeyDeviceRepository(api),
      pending: new PendingCommandManager({ onTimeout() {} }),
      metrics: new RealtimeMetrics(),
      logger: createLogger(),
    });

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'set-color',
      requestId: 'r1',
      huePercent: 50,
      saturationPercent: 100,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(api.writes, [
      { deviceId: 'lamp-1', capabilityId: 'light_mode', value: 'color' },
      { deviceId: 'lamp-1', capabilityId: 'light_hue', value: 0.5 },
      { deviceId: 'lamp-1', capabilityId: 'light_saturation', value: 1 },
    ]);
  });

  it('rejects set-color when only hue is present', async () => {
    const api = createApi([
      lamp(['onoff', 'light_hue'], { onoff: true, light_hue: 0.1 }),
    ]);
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const handler = new WidgetCommandHandler({
      registry,
      deviceRepository: new HomeyDeviceRepository(api),
      pending: new PendingCommandManager({ onTimeout() {} }),
      metrics: new RealtimeMetrics(),
      logger: createLogger(),
    });

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'set-color',
      requestId: 'r1',
      huePercent: 10,
      saturationPercent: 50,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, 'capability_missing');
    }
  });

  it('rejects light action on cover widget', async () => {
    const api = createApi([
      lamp(['onoff', 'dim'], { onoff: true, dim: 0.5 }),
      {
        id: 'cover-dev',
        name: 'Cover',
        zoneId: 'z1',
        available: true,
        capabilities: ['windowcoverings_set'],
        capabilityValues: { windowcoverings_set: 0.5 },
      } satisfies HomeyApiDeviceDto,
    ]);
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const handler = new WidgetCommandHandler({
      registry,
      deviceRepository: new HomeyDeviceRepository(api),
      pending: new PendingCommandManager({ onTimeout() {} }),
      metrics: new RealtimeMetrics(),
      logger: createLogger(),
    });

    const result = await handler.handle({
      displayId: 'display-1',
      widgetId: 'cover-1',
      action: 'set-dim',
      requestId: 'r1',
      valuePercent: 40,
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, 'action_not_allowed');
    }
  });

  it('rejects concurrent light commands for the same widget', async () => {
    const api = createApi([
      lamp(['onoff', 'dim'], { onoff: true, dim: 0.2 }),
    ]);
    const registry = new DisplayRegistry();
    registry.upsert(displaySnapshot());
    const pending = new PendingCommandManager({ onTimeout() {} });
    const handler = new WidgetCommandHandler({
      registry,
      deviceRepository: new HomeyDeviceRepository(api),
      pending,
      metrics: new RealtimeMetrics(),
      logger: createLogger(),
    });

    const first = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'set-dim',
      requestId: 'r1',
      valuePercent: 10,
    });
    assert.equal(first.ok, true);

    const second = await handler.handle({
      displayId: 'display-1',
      widgetId: 'light-1',
      action: 'toggle',
      requestId: 'r2',
    });
    assert.equal(second.ok, false);
    if (!second.ok) {
      assert.equal(second.reason, 'already_pending');
    }
  });
});
