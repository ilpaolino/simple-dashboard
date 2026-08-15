import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  WidgetInteractionController,
  type CommandStatus,
} from '../frontend/realtime/WidgetInteractionController';
import type { WidgetActionDispatch } from '../frontend/realtime/WidgetInteractionController';

describe('WidgetInteractionController', () => {
  it('tap generates a toggle action with a unique requestId', () => {
    const sent: WidgetActionDispatch[] = [];
    const controller = new WidgetInteractionController({
      sendAction: (message) => {
        sent.push(message);
        return true;
      },
      createRequestId: () => 'req-1',
    });

    const statuses: CommandStatus[] = [];
    controller.onStatus('w1', (feedback) => {
      statuses.push(feedback.status);
    });

    const ok = controller.handleGesture({
      widgetId: 'w1',
      gesture: 'tap',
      action: 'toggle',
      interactive: true,
    });

    assert.equal(ok, true);
    assert.deepEqual(sent, [
      { widgetId: 'w1', action: 'toggle', requestId: 'req-1' },
    ]);
    assert.deepEqual(statuses, ['pending']);
    assert.equal(controller.isPending('w1'), true);
  });

  it('ignores further taps while pending', () => {
    let requestCounter = 0;
    const sent: WidgetActionDispatch[] = [];
    const controller = new WidgetInteractionController({
      sendAction: (message) => {
        sent.push(message);
        return true;
      },
      createRequestId: () => `req-${(requestCounter += 1)}`,
    });

    assert.equal(
      controller.handleGesture({
        widgetId: 'w1',
        gesture: 'tap',
        action: 'toggle',
        interactive: true,
      }),
      true,
    );
    assert.equal(
      controller.handleGesture({
        widgetId: 'w1',
        gesture: 'tap',
        action: 'toggle',
        interactive: true,
      }),
      false,
    );
    assert.equal(sent.length, 1);
  });

  it('does not send commands when not interactive (unavailable)', () => {
    const sent: WidgetActionDispatch[] = [];
    const controller = new WidgetInteractionController({
      sendAction: (message) => {
        sent.push(message);
        return true;
      },
    });

    assert.equal(
      controller.handleGesture({
        widgetId: 'w1',
        gesture: 'tap',
        action: 'toggle',
        interactive: false,
      }),
      false,
    );
    assert.equal(sent.length, 0);
  });

  it('clears pending on success confirmation', () => {
    const controller = new WidgetInteractionController({
      sendAction: () => true,
      createRequestId: () => 'req-ok',
    });
    const statuses: CommandStatus[] = [];
    controller.onStatus('w1', (feedback) => statuses.push(feedback.status));

    controller.handleGesture({
      widgetId: 'w1',
      gesture: 'tap',
      action: 'toggle',
      interactive: true,
    });
    controller.handleWidgetStateConfirmed('w1');

    assert.equal(controller.isPending('w1'), false);
    assert.deepEqual(statuses, ['pending', 'success']);
  });

  it('clears pending on timeout', () => {
    const controller = new WidgetInteractionController({
      sendAction: () => true,
      createRequestId: () => 'req-timeout',
      errorFeedbackMs: 10_000,
    });
    const statuses: CommandStatus[] = [];
    controller.onStatus('w1', (feedback) => statuses.push(feedback.status));

    controller.handleGesture({
      widgetId: 'w1',
      gesture: 'tap',
      action: 'toggle',
      interactive: true,
    });
    controller.handleCommandTimeout('req-timeout');

    assert.equal(controller.isPending('w1'), false);
    assert.deepEqual(statuses, ['pending', 'timeout']);
  });

  it('clears pending on error', () => {
    const controller = new WidgetInteractionController({
      sendAction: () => true,
      createRequestId: () => 'req-err',
      errorFeedbackMs: 10_000,
    });
    const statuses: CommandStatus[] = [];
    controller.onStatus('w1', (feedback) => statuses.push(feedback.status));

    controller.handleGesture({
      widgetId: 'w1',
      gesture: 'tap',
      action: 'toggle',
      interactive: true,
    });
    controller.handleCommandRejected('req-err', 'homey_api_error');

    assert.equal(controller.isPending('w1'), false);
    assert.deepEqual(statuses, ['pending', 'error']);
  });

  it('clears all pending on disconnect without assuming success', () => {
    const controller = new WidgetInteractionController({
      sendAction: () => true,
      createRequestId: () => 'req-disc',
    });
    controller.handleGesture({
      widgetId: 'w1',
      gesture: 'tap',
      action: 'toggle',
      interactive: true,
    });
    controller.handleDisconnect();
    assert.equal(controller.isPending('w1'), false);
  });
});
