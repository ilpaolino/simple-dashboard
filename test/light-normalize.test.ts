import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decodeLightColorExpected,
  denormalizePercentToHomey,
  encodeLightColorExpected,
  isValidPercent,
  normalizeHomeyUnitInterval,
} from '../lib/widgets/light/normalize';
import {
  evaluateLightColorConfirmation,
  evaluateLightPercentConfirmation,
} from '../lib/widgets/light/confirmation';
import {
  hasDimCapability,
  hasLightColorCapabilities,
  hasLightTemperatureCapability,
  resolveLightWidgetCapabilities,
} from '../lib/widgets/light/compatibility';
import { resolveLightWidgetRuntimeFromSnapshot } from '../lib/widgets/light/runtime';
import type { HomeyDeviceSnapshot } from '../lib/homey/types';

function device(
  capabilities: string[],
  values: Record<string, unknown> = {},
  available = true,
): HomeyDeviceSnapshot {
  return {
    id: 'lamp-1',
    name: 'Lamp',
    zoneId: 'zone-1',
    zoneName: 'Kitchen',
    available,
    capabilities,
    capabilityValues: values,
  };
}

describe('light normalize', () => {
  it('normalizes Homey [0,1] to UX percent', () => {
    assert.deepEqual(normalizeHomeyUnitInterval(0), {
      rawValue: 0,
      percent: 0,
    });
    assert.deepEqual(normalizeHomeyUnitInterval(0.5), {
      rawValue: 0.5,
      percent: 50,
    });
    assert.deepEqual(normalizeHomeyUnitInterval(1), {
      rawValue: 1,
      percent: 100,
    });
  });

  it('rejects out-of-range Homey values', () => {
    assert.equal(normalizeHomeyUnitInterval(1.2).percent, null);
    assert.equal(normalizeHomeyUnitInterval(-0.1).percent, null);
    assert.equal(normalizeHomeyUnitInterval('x').percent, null);
  });

  it('denormalizes UX percent to Homey [0,1]', () => {
    assert.equal(denormalizePercentToHomey(0), 0);
    assert.equal(denormalizePercentToHomey(50), 0.5);
    assert.equal(denormalizePercentToHomey(100), 1);
  });

  it('validates percent integers', () => {
    assert.equal(isValidPercent(0), true);
    assert.equal(isValidPercent(100), true);
    assert.equal(isValidPercent(50.5), false);
    assert.equal(isValidPercent(-1), false);
    assert.equal(isValidPercent(101), false);
  });

  it('encodes and decodes color expected values', () => {
    const encoded = encodeLightColorExpected(25, 80);
    assert.equal(encoded, '25:80');
    assert.deepEqual(decodeLightColorExpected(encoded), {
      huePercent: 25,
      saturationPercent: 80,
    });
    assert.equal(decodeLightColorExpected('bad'), null);
  });
});

describe('light confirmation', () => {
  it('confirms within 1% tolerance', () => {
    assert.equal(
      evaluateLightPercentConfirmation({
        targetPercent: 50,
        reportedPercent: 50,
      }),
      'confirmed',
    );
    assert.equal(
      evaluateLightPercentConfirmation({
        targetPercent: 50,
        reportedPercent: 51,
      }),
      'confirmed',
    );
    assert.equal(
      evaluateLightPercentConfirmation({
        targetPercent: 50,
        reportedPercent: 53,
      }),
      'pending',
    );
  });

  it('confirms color only when both hue and saturation match', () => {
    assert.equal(
      evaluateLightColorConfirmation({
        targetHuePercent: 10,
        targetSaturationPercent: 90,
        reportedHuePercent: 10,
        reportedSaturationPercent: 90,
      }),
      'confirmed',
    );
    assert.equal(
      evaluateLightColorConfirmation({
        targetHuePercent: 10,
        targetSaturationPercent: 90,
        reportedHuePercent: 10,
        reportedSaturationPercent: 50,
      }),
      'pending',
    );
    assert.equal(
      evaluateLightColorConfirmation({
        targetHuePercent: 10,
        targetSaturationPercent: 90,
        reportedHuePercent: null,
        reportedSaturationPercent: 90,
      }),
      'pending',
    );
  });
});

describe('light capability flags', () => {
  it('requires onoff for toggle; optional dims/color', () => {
    assert.deepEqual(
      resolveLightWidgetCapabilities(device(['onoff']), true),
      {
        canToggle: true,
        canDim: false,
        canSetTemperature: false,
        canSetColor: false,
      },
    );

    assert.equal(hasDimCapability(device(['onoff', 'dim'])), true);
    assert.equal(
      hasLightTemperatureCapability(device(['onoff', 'light_temperature'])),
      true,
    );
    assert.equal(
      hasLightColorCapabilities(
        device(['onoff', 'light_hue', 'light_saturation']),
      ),
      true,
    );
    assert.equal(
      hasLightColorCapabilities(device(['onoff', 'light_hue'])),
      false,
    );
  });

  it('resolves full light runtime with normalized values', () => {
    const resolved = resolveLightWidgetRuntimeFromSnapshot({
      widgetId: 'w1',
      deviceId: 'lamp-1',
      device: device(
        [
          'onoff',
          'dim',
          'light_temperature',
          'light_hue',
          'light_saturation',
          'light_mode',
        ],
        {
          onoff: true,
          dim: 0.4,
          light_temperature: 0.8,
          light_hue: 0.25,
          light_saturation: 1,
          light_mode: 'color',
        },
      ),
    });

    assert.equal(resolved.state.on, true);
    assert.equal(resolved.state.dimPercent, 40);
    assert.equal(resolved.state.temperaturePercent, 80);
    assert.equal(resolved.state.huePercent, 25);
    assert.equal(resolved.state.saturationPercent, 100);
    assert.equal(resolved.state.capabilities.canDim, true);
    assert.equal(resolved.state.capabilities.canSetTemperature, true);
    assert.equal(resolved.state.capabilities.canSetColor, true);
    assert.equal(resolved.diagnostic.canDim, true);
  });
});
