import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotificationController } from '../frontend/notifications/NotificationController';
import type { DisplayNotification } from '../lib/notifications/types';

function note(
  partial: Partial<DisplayNotification> &
    Pick<DisplayNotification, 'id' | 'message' | 'severity'>,
): DisplayNotification {
  return {
    dismissable: true,
    highlight: false,
    publishedAt: 1,
    ...partial,
  };
}

describe('NotificationController', () => {
  it('hides indicator severity when empty and tracks max severity', () => {
    const controller = new NotificationController();
    assert.equal(controller.getMaxSeverity(), null);
    assert.equal(controller.getVisibleCount(), 0);

    controller.addNotification(note({ id: 'i', message: 'i', severity: 'info' }));
    assert.equal(controller.getMaxSeverity(), 'info');

    controller.addNotification(
      note({ id: 'w', message: 'w', severity: 'warning', publishedAt: 2 }),
    );
    assert.equal(controller.getMaxSeverity(), 'warning');

    controller.addNotification(
      note({ id: 'c', message: 'c', severity: 'critical', publishedAt: 3 }),
    );
    assert.equal(controller.getMaxSeverity(), 'critical');

    controller.removeNotification('c');
    assert.equal(controller.getMaxSeverity(), 'warning');
  });

  it('opens on highest severity and navigates without looping', () => {
    const controller = new NotificationController();
    controller.applySnapshot([
      note({ id: 'info', message: 'info', severity: 'info', publishedAt: 1 }),
      note({
        id: 'critical',
        message: 'critical',
        severity: 'critical',
        publishedAt: 2,
      }),
      note({
        id: 'warning',
        message: 'warning',
        severity: 'warning',
        publishedAt: 3,
      }),
    ]);

    assert.equal(controller.openCenter(true), true);
    assert.equal(controller.getCurrent()?.id, 'critical');
    assert.equal(controller.canGoPrevious(), false);
    assert.equal(controller.goPrevious(), false);

    assert.equal(controller.goNext(), true);
    assert.equal(controller.getCurrent()?.severity, 'warning');
    assert.equal(controller.goNext(), true);
    assert.equal(controller.getCurrent()?.severity, 'info');
    assert.equal(controller.goNext(), false);
  });

  it('dismiss closes center when last notification is removed', () => {
    const controller = new NotificationController();
    controller.applySnapshot([
      note({ id: 'only', message: 'only', severity: 'info' }),
    ]);
    controller.openCenter();
    assert.equal(controller.isCenterOpen(), true);
    controller.dismissLocal('only');
    assert.equal(controller.isCenterOpen(), false);
    assert.equal(controller.getVisibleCount(), 0);
  });

  it('realtime remove of current advances to next', () => {
    const controller = new NotificationController();
    controller.applySnapshot([
      note({ id: 'a', message: 'a', severity: 'critical', publishedAt: 1 }),
      note({ id: 'b', message: 'b', severity: 'info', publishedAt: 2 }),
    ]);
    controller.openCenter(true);
    assert.equal(controller.getCurrent()?.id, 'a');
    controller.removeNotification('a');
    assert.equal(controller.getCurrent()?.id, 'b');
    assert.equal(controller.isCenterOpen(), true);
  });

  it('does not dismiss non-dismissable', () => {
    const controller = new NotificationController();
    controller.applySnapshot([
      note({
        id: 'locked',
        message: 'locked',
        severity: 'critical',
        dismissable: false,
      }),
    ]);
    assert.equal(controller.dismissLocal('locked'), null);
    assert.equal(controller.getVisibleCount(), 1);
  });

  it('applySnapshot reconciles after reconnect', () => {
    const controller = new NotificationController();
    controller.applySnapshot([
      note({ id: 'a', message: 'a', severity: 'info' }),
      note({ id: 'b', message: 'b', severity: 'warning', publishedAt: 2 }),
    ]);
    controller.dismissLocal('a');
    controller.applySnapshot([
      note({ id: 'b', message: 'b2', severity: 'success', publishedAt: 2 }),
      note({ id: 'c', message: 'c', severity: 'info', publishedAt: 3 }),
    ]);
    assert.deepEqual(
      controller.getNotifications().map((item) => item.id),
      ['b', 'c'],
    );
    assert.equal(controller.getNotifications()[0]?.message, 'b2');
  });
});
