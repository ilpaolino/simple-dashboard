import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { HomeyDeviceRepository } from '../lib/homey/HomeyDeviceRepository';
import type { HomeyApiDeviceDto, HomeyWebApi } from '../lib/homey/types';
import { isCompatibleWithLightWidget } from '../lib/widgets/light/compatibility';
import {
  resolveLightWidgetRuntime,
  resolveLightWidgetRuntimeFromSnapshot,
  validateLightWidgetBinding,
} from '../lib/widgets/light/runtime';
import { resolveDashboardRuntime } from '../lib/widgets/runtime';
import { resolveLightVisualState } from '../lib/widgets/light/visual';
import type { WidgetInstance } from '../lib/widgets/types';

class MemoryHomeyWebApi implements HomeyWebApi {
  public constructor(
    private readonly devices: readonly HomeyApiDeviceDto[],
    private readonly fail = false,
  ) {}

  public async getDevices(): Promise<readonly HomeyApiDeviceDto[]> {
    if (this.fail) {
      throw new Error('Homey API error');
    }
    return this.devices;
  }

  public async getDevice(id: string): Promise<HomeyApiDeviceDto | null> {
    if (this.fail) {
      throw new Error('Homey API error');
    }
    return this.devices.find((device) => device.id === id) ?? null;
  }

  public async getZones(): Promise<Readonly<Record<string, never>>> {
    return {};
  }

  public async subscribeCapability(): Promise<null> {
    return null;
  }

  public async setCapabilityValue(): Promise<void> {
    // no-op for LightWidget runtime tests
  }
}

function device(
  overrides: Partial<HomeyApiDeviceDto> = {},
): HomeyApiDeviceDto {
  return {
    id: 'light-1',
    name: 'Lampada tavolo',
    zoneId: 'kitchen',
    available: true,
    capabilities: ['onoff'],
    capabilityValues: { onoff: true },
    ...overrides,
  };
}

describe('LightWidget compatibility', () => {
  it('accepts devices with onoff and rejects devices without it', () => {
    assert.equal(isCompatibleWithLightWidget({ capabilities: ['onoff'] }), true);
    assert.equal(
      isCompatibleWithLightWidget({ capabilities: ['onoff', 'dim'] }),
      true,
    );
    assert.equal(
      isCompatibleWithLightWidget({ capabilities: ['measure_temperature'] }),
      false,
    );
    assert.equal(isCompatibleWithLightWidget({ capabilities: [] }), false);
  });
});

describe('LightWidget runtime resolver', () => {
  it('resolves ON and OFF snapshots', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([
        device({ capabilityValues: { onoff: true } }),
        device({
          id: 'light-off',
          name: 'Off lamp',
          capabilityValues: { onoff: false },
        }),
      ]),
    );

    const on = await resolveLightWidgetRuntime({
      widgetId: 'w-on',
      config: { deviceId: 'light-1' },
      repository,
    });
    const off = await resolveLightWidgetRuntime({
      widgetId: 'w-off',
      config: { deviceId: 'light-off' },
      repository,
    });

    assert.equal(on.state.available, true);
    assert.equal(on.state.on, true);
    assert.equal(on.state.name, 'Lampada tavolo');
    assert.equal(on.state.error, null);
    assert.equal(resolveLightVisualState(on.state), 'on');

    assert.equal(off.state.on, false);
    assert.equal(resolveLightVisualState(off.state), 'off');
  });

  it('marks Homey-unavailable devices as unavailable without dropping the widget', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([
        device({ available: false, capabilityValues: { onoff: true } }),
      ]),
    );
    const resolved = await resolveLightWidgetRuntime({
      widgetId: 'w1',
      config: { deviceId: 'light-1' },
      repository,
    });
    assert.equal(resolved.state.available, false);
    assert.equal(resolved.state.error, 'unavailable');
    assert.equal(resolved.state.name, 'Lampada tavolo');
    assert.equal(resolveLightVisualState(resolved.state), 'unavailable');
  });

  it('keeps a removed device reference visible as missing', () => {
    const resolved = resolveLightWidgetRuntimeFromSnapshot({
      widgetId: 'w1',
      deviceId: 'deleted',
      device: null,
    });
    assert.equal(resolved.state.error, 'missing_device');
    assert.equal(resolved.diagnostic.resolved, false);
    assert.equal(resolveLightVisualState(resolved.state), 'unavailable');
  });

  it('treats a missing onoff capability as unavailable', () => {
    const resolved = resolveLightWidgetRuntimeFromSnapshot({
      widgetId: 'w1',
      deviceId: 'sensor-1',
      device: {
        id: 'sensor-1',
        name: 'Sensor',
        zoneId: null,
        zoneName: null,
        available: true,
        capabilities: ['measure_temperature'],
        capabilityValues: {},
      },
    });
    assert.equal(resolved.state.error, 'missing_capability');
    assert.equal(resolved.diagnostic.hasOnoff, false);
    assert.equal(resolveLightVisualState(resolved.state), 'unavailable');
  });

  it('records Homey API errors without throwing', async () => {
    const repository = new HomeyDeviceRepository(new MemoryHomeyWebApi([], true));
    const resolved = await resolveLightWidgetRuntime({
      widgetId: 'w1',
      config: { deviceId: 'light-1' },
      repository,
    });
    assert.equal(resolved.state.error, 'api_error');
    assert.equal(resolved.diagnostic.resolved, false);
  });
});

describe('LightWidget binding validation', () => {
  it('accepts an accessible onoff device and rejects missing or incompatible ones', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([
        device(),
        device({
          id: 'sensor-1',
          name: 'Sensor',
          capabilities: ['measure_humidity'],
          capabilityValues: {},
        }),
      ]),
    );

    const ok = await validateLightWidgetBinding({
      config: { deviceId: 'light-1' },
      repository,
    });
    assert.equal(ok.ok, true);

    const missing = await validateLightWidgetBinding({
      config: { deviceId: 'gone' },
      repository,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, 'device_missing');
    }

    const incompatible = await validateLightWidgetBinding({
      config: { deviceId: 'sensor-1' },
      repository,
    });
    assert.equal(incompatible.ok, false);
    if (!incompatible.ok) {
      assert.equal(incompatible.error, 'missing_onoff');
    }
  });
});

describe('Dashboard runtime snapshot', () => {
  it('resolves lights once from a device list without polling', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([device({ capabilityValues: { onoff: true } })]),
    );
    const widgets: WidgetInstance[] = [
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
        config: { deviceId: 'light-1' },
      },
    ];

    const first = await resolveDashboardRuntime({ widgets, repository });
    const second = await resolveDashboardRuntime({ widgets, repository });

    assert.equal(first.states['light-1']?.type, 'light');
    assert.equal(first.states['light-1'] && first.states['light-1'].type === 'light' ? first.states['light-1'].on : null, true);
    assert.deepEqual(first.states, second.states);
    assert.equal(first.diagnostics.length, 1);
  });

  it('isolates a Homey API failure to LightWidgets', async () => {
    const repository = new HomeyDeviceRepository(new MemoryHomeyWebApi([], true));
    const widgets: WidgetInstance[] = [
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
        config: { deviceId: 'light-1' },
      },
    ];

    const resolved = await resolveDashboardRuntime({ widgets, repository });
    assert.equal(resolved.states['light-1']?.type, 'light');
    if (resolved.states['light-1']?.type === 'light') {
      assert.equal(resolved.states['light-1'].error, 'api_error');
    }
  });
});

describe('LightWidget snapshot semantics', () => {
  it('keeps LightWidget render path free of polling and timers', () => {
    const files = [
      'lib/widgets/light/runtime.ts',
      'lib/widgets/runtime.ts',
      'frontend/widgets/light/LightWidget.ts',
    ];

    for (const relative of files) {
      const source = fs.readFileSync(
        path.join(process.cwd(), relative),
        'utf8',
      );
      assert.doesNotMatch(source, /setInterval/);
      assert.doesNotMatch(source, /setTimeout/);
      assert.doesNotMatch(source, /EventSource/);
    }
  });

  it('uses official makeCapabilityInstance and setCapabilityValue in the Homey Web API client', () => {
    const client = fs.readFileSync(
      path.join(process.cwd(), 'lib/homey/createHomeyWebApi.ts'),
      'utf8',
    );
    assert.match(client, /makeCapabilityInstance/);
    assert.match(client, /setCapabilityValue/);

    const lightRuntime = fs.readFileSync(
      path.join(process.cwd(), 'lib/widgets/light/runtime.ts'),
      'utf8',
    );
    assert.doesNotMatch(lightRuntime, /makeCapabilityInstance/);
    assert.doesNotMatch(lightRuntime, /setCapabilityValue/);
  });
});
