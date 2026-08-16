import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateCoverPositionConfirmation } from '../lib/widgets/cover/confirmation';
import {
  denormalizePositionPercent,
  isValidPositionPercent,
} from '../lib/widgets/cover/normalize';
import {
  hasWindowcoveringsStateCapability,
  resolveCoverWidgetCapabilities,
} from '../lib/widgets/cover/compatibility';
import {
  isClientMessage,
  parseClientMessage,
} from '../lib/realtime/protocol';

describe('Cover position confirmation', () => {
  it('confirms when reported percent is within tolerance of target', () => {
    assert.equal(
      evaluateCoverPositionConfirmation({
        targetPercent: 80,
        baselinePercent: 20,
        reportedPercent: 80,
      }),
      'confirmed',
    );
    assert.equal(
      evaluateCoverPositionConfirmation({
        targetPercent: 80,
        baselinePercent: 20,
        reportedPercent: 81,
      }),
      'confirmed',
    );
  });

  it('confirms on first coherent progress toward target', () => {
    assert.equal(
      evaluateCoverPositionConfirmation({
        targetPercent: 80,
        baselinePercent: 20,
        reportedPercent: 30,
      }),
      'confirmed',
    );
    assert.equal(
      evaluateCoverPositionConfirmation({
        targetPercent: 10,
        baselinePercent: 60,
        reportedPercent: 55,
      }),
      'confirmed',
    );
  });

  it('stays pending when value is unchanged', () => {
    assert.equal(
      evaluateCoverPositionConfirmation({
        targetPercent: 80,
        baselinePercent: 20,
        reportedPercent: 20,
      }),
      'pending',
    );
  });

  it('mismatches when Homey moves away from the target direction', () => {
    assert.equal(
      evaluateCoverPositionConfirmation({
        targetPercent: 80,
        baselinePercent: 40,
        reportedPercent: 30,
      }),
      'mismatched',
    );
  });
});

describe('Cover normalization write path', () => {
  it('denormalizes UX percent to Homey [0,1]', () => {
    assert.equal(denormalizePositionPercent(0), 0);
    assert.equal(denormalizePositionPercent(50), 0.5);
    assert.equal(denormalizePositionPercent(100), 1);
    assert.equal(denormalizePositionPercent(62), 0.62);
  });

  it('validates integer percent range', () => {
    assert.equal(isValidPositionPercent(0), true);
    assert.equal(isValidPositionPercent(100), true);
    assert.equal(isValidPositionPercent(50.5), false);
    assert.equal(isValidPositionPercent(-1), false);
    assert.equal(isValidPositionPercent(101), false);
  });
});

describe('Cover stop capability metadata', () => {
  it('exposes canStop only when windowcoverings_state is present', () => {
    assert.equal(
      hasWindowcoveringsStateCapability({
        capabilities: ['windowcoverings_set', 'windowcoverings_state'],
      }),
      true,
    );
    assert.deepEqual(
      resolveCoverWidgetCapabilities(
        { capabilities: ['windowcoverings_set'] },
        true,
      ),
      { canSetPosition: true, canStop: false },
    );
    assert.equal(
      resolveCoverWidgetCapabilities(
        {
          capabilities: ['windowcoverings_set', 'windowcoverings_state'],
        },
        true,
      ).canStop,
      true,
    );
    assert.equal(
      resolveCoverWidgetCapabilities(
        {
          capabilities: ['windowcoverings_set', 'windowcoverings_state'],
        },
        false,
      ).canStop,
      false,
    );
  });
});

describe('Cover widget-action protocol', () => {
  it('accepts set-position with integer percent', () => {
    const message = parseClientMessage(
      JSON.stringify({
        type: 'widget-action',
        widgetId: 'cover-1',
        action: 'set-position',
        requestId: 'r1',
        positionPercent: 75,
      }),
    );
    assert.ok(message);
    assert.equal(message?.type, 'widget-action');
    if (message?.type === 'widget-action' && message.action === 'set-position') {
      assert.equal(message.positionPercent, 75);
    }
  });

  it('rejects set-position outside 0–100', () => {
    assert.equal(
      isClientMessage({
        type: 'widget-action',
        widgetId: 'cover-1',
        action: 'set-position',
        requestId: 'r1',
        positionPercent: 150,
      }),
      false,
    );
  });

  it('accepts stop without position', () => {
    assert.equal(
      isClientMessage({
        type: 'widget-action',
        widgetId: 'cover-1',
        action: 'stop',
        requestId: 'r1',
      }),
      true,
    );
  });

  it('rejects stop with position payload', () => {
    assert.equal(
      isClientMessage({
        type: 'widget-action',
        widgetId: 'cover-1',
        action: 'stop',
        requestId: 'r1',
        positionPercent: 50,
      }),
      false,
    );
  });
});
