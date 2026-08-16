import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HomeyDeviceRepository } from '../lib/homey/HomeyDeviceRepository';
import type { HomeyApiDeviceDto, HomeyWebApi } from '../lib/homey/types';
import { isCompatibleWithCoverWidget } from '../lib/widgets/cover/compatibility';
import { normalizeWindowcoveringsSet } from '../lib/widgets/cover/normalize';
import {
  resolveCoverWidgetRuntime,
  resolveCoverWidgetRuntimeFromSnapshot,
  validateCoverWidgetBinding,
} from '../lib/widgets/cover/runtime';
import {
  formatCoverPositionPercent,
  resolveCoverVisualState,
} from '../lib/widgets/cover/visual';
import { resolveDashboardRuntime } from '../lib/widgets/runtime';
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
    // CoverWidget is read-only in Milestone 8
  }
}

function coverDevice(
  overrides: Partial<HomeyApiDeviceDto> = {},
): HomeyApiDeviceDto {
  return {
    id: 'cover-1',
    name: 'Tapparella cucina',
    zoneId: 'kitchen',
    available: true,
    capabilities: ['windowcoverings_set'],
    capabilityValues: { windowcoverings_set: 0.62 },
    ...overrides,
  };
}

describe('CoverWidget compatibility', () => {
  it('accepts devices with windowcoverings_set and rejects others', () => {
    assert.equal(
      isCompatibleWithCoverWidget({ capabilities: ['windowcoverings_set'] }),
      true,
    );
    assert.equal(
      isCompatibleWithCoverWidget({
        capabilities: ['windowcoverings_set', 'windowcoverings_state'],
      }),
      true,
    );
    assert.equal(
      isCompatibleWithCoverWidget({ capabilities: ['onoff'] }),
      false,
    );
    assert.equal(isCompatibleWithCoverWidget({ capabilities: [] }), false);
  });
});

describe('CoverWidget normalization', () => {
  it('maps Homey 0→0%, 1→100%, midpoint→correct percent', () => {
    assert.deepEqual(normalizeWindowcoveringsSet(0), {
      rawValue: 0,
      positionPercent: 0,
    });
    assert.deepEqual(normalizeWindowcoveringsSet(1), {
      rawValue: 1,
      positionPercent: 100,
    });
    assert.deepEqual(normalizeWindowcoveringsSet(0.5), {
      rawValue: 0.5,
      positionPercent: 50,
    });
    assert.deepEqual(normalizeWindowcoveringsSet(0.62), {
      rawValue: 0.62,
      positionPercent: 62,
    });
  });

  it('rejects out-of-range, null, undefined, and wrong types', () => {
    assert.equal(normalizeWindowcoveringsSet(-0.1).positionPercent, null);
    assert.equal(normalizeWindowcoveringsSet(1.1).positionPercent, null);
    assert.equal(normalizeWindowcoveringsSet(null).positionPercent, null);
    assert.equal(normalizeWindowcoveringsSet(undefined).positionPercent, null);
    assert.equal(normalizeWindowcoveringsSet('0.5').positionPercent, null);
    assert.equal(normalizeWindowcoveringsSet(true).positionPercent, null);
    assert.equal(normalizeWindowcoveringsSet(Number.NaN).positionPercent, null);
  });
});

describe('CoverWidget runtime resolver', () => {
  it('resolves normalized position and keeps Homey name', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([coverDevice()]),
    );
    const resolved = await resolveCoverWidgetRuntime({
      widgetId: 'w1',
      config: { deviceId: 'cover-1' },
      repository,
    });

    assert.equal(resolved.state.available, true);
    assert.equal(resolved.state.positionPercent, 62);
    assert.equal(resolved.state.name, 'Tapparella cucina');
    assert.equal(resolved.state.error, null);
    assert.deepEqual(resolved.state.capabilities, {
      canSetPosition: true,
      canStop: false,
    });
    assert.equal(resolved.diagnostic.rawValue, 0.62);
    assert.equal(resolveCoverVisualState(resolved.state), 'available');
    assert.equal(formatCoverPositionPercent(62), '62%');
  });

  it('uses optional custom title instead of Homey device name', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([coverDevice()]),
    );
    const resolved = await resolveCoverWidgetRuntime({
      widgetId: 'w1',
      config: { deviceId: 'cover-1', title: '  Cucina  ' },
      repository,
    });
    assert.equal(resolved.state.name, 'Cucina');

    const fromSnapshot = resolveCoverWidgetRuntimeFromSnapshot({
      widgetId: 'w1',
      deviceId: 'cover-1',
      device: coverDevice(),
      title: 'Soggiorno',
    });
    assert.equal(fromSnapshot.state.name, 'Soggiorno');
  });

  it('marks unavailable and removed devices without dropping the widget', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([
        coverDevice({ available: false, capabilityValues: { windowcoverings_set: 0 } }),
      ]),
    );
    const unavailable = await resolveCoverWidgetRuntime({
      widgetId: 'w1',
      config: { deviceId: 'cover-1' },
      repository,
    });
    assert.equal(unavailable.state.available, false);
    assert.equal(unavailable.state.error, 'unavailable');
    assert.equal(resolveCoverVisualState(unavailable.state), 'unavailable');

    const removed = resolveCoverWidgetRuntimeFromSnapshot({
      widgetId: 'w2',
      deviceId: 'deleted',
      device: null,
    });
    assert.equal(removed.state.error, 'missing_device');
    assert.equal(resolveCoverVisualState(removed.state), 'unavailable');
  });

  it('treats missing capability and invalid values as unavailable', () => {
    const missing = resolveCoverWidgetRuntimeFromSnapshot({
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
    assert.equal(missing.state.error, 'missing_capability');
    assert.equal(missing.diagnostic.hasWindowcoveringsSet, false);

    const invalid = resolveCoverWidgetRuntimeFromSnapshot({
      widgetId: 'w2',
      deviceId: 'cover-1',
      device: {
        id: 'cover-1',
        name: 'Cover',
        zoneId: null,
        zoneName: null,
        available: true,
        capabilities: ['windowcoverings_set'],
        capabilityValues: { windowcoverings_set: 2 },
      },
    });
    assert.equal(invalid.state.error, 'invalid_value');
    assert.equal(invalid.state.positionPercent, null);
    assert.equal(invalid.diagnostic.rawValue, 2);
  });

  it('validates bindings for the editor', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([coverDevice()]),
    );
    const ok = await validateCoverWidgetBinding({
      config: { deviceId: 'cover-1' },
      repository,
    });
    assert.equal(ok.ok, true);

    const missing = await validateCoverWidgetBinding({
      config: { deviceId: 'missing' },
      repository,
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.error, 'device_missing');
    }
  });
});

describe('CoverWidget dashboard isolation', () => {
  it('does not break light widgets when a cover fails', async () => {
    const repository = new HomeyDeviceRepository(
      new MemoryHomeyWebApi([
        {
          id: 'light-1',
          name: 'Lamp',
          zoneId: null,
          available: true,
          capabilities: ['onoff'],
          capabilityValues: { onoff: true },
        },
      ]),
    );

    const widgets: WidgetInstance[] = [
      {
        id: 'light-1',
        type: 'light',
        placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
        config: { deviceId: 'light-1' },
      },
      {
        id: 'cover-1',
        type: 'cover',
        placement: { row: 0, column: 1, rowSpan: 1, columnSpan: 1 },
        config: { deviceId: 'missing-cover' },
      },
    ];

    const resolved = await resolveDashboardRuntime({ widgets, repository });
    assert.equal(resolved.states['light-1']?.type, 'light');
    if (resolved.states['light-1']?.type === 'light') {
      assert.equal(resolved.states['light-1'].on, true);
    }
    assert.equal(resolved.states['cover-1']?.type, 'cover');
    if (resolved.states['cover-1']?.type === 'cover') {
      assert.equal(resolved.states['cover-1'].error, 'missing_device');
    }
    assert.equal(resolved.lightDiagnostics.length, 1);
    assert.equal(resolved.coverDiagnostics.length, 1);
  });
});
