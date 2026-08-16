import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotificationManager } from '../lib/notifications/NotificationManager';
import type { NotificationChangeEvent } from '../lib/notifications/NotificationManager';

describe('NotificationManager', () => {
  it('publishes, updates, removes, and routes per Display', () => {
    const events: NotificationChangeEvent[] = [];
    const manager = new NotificationManager({
      createId: () => 'n-1',
      now: () => 1000,
      onChange: (event) => {
        events.push(event);
      },
    });

    const published = manager.publishNotification({
      message: 'Hello',
      severity: 'info',
      displayIds: ['display-a', 'display-b'],
      icon: 'bell',
      title: 'Title',
    });
    assert.equal(published.ok, true);
    if (!published.ok) {
      return;
    }
    assert.equal(published.value.id, 'n-1');
    assert.equal(manager.getNotificationsForDisplay('display-a').length, 1);
    assert.equal(manager.getNotificationsForDisplay('display-b').length, 1);
    assert.equal(manager.getNotificationsForDisplay('display-c').length, 0);

    const updated = manager.updateNotification({
      id: 'n-1',
      severity: 'warning',
      message: 'Updated',
    });
    assert.equal(updated.ok, true);
    assert.equal(
      manager.getNotificationsForDisplay('display-a')[0]?.severity,
      'warning',
    );

    const removed = manager.removeNotification('n-1');
    assert.equal(removed.ok, true);
    assert.equal(manager.getNotificationsForDisplay('display-a').length, 0);
    assert.ok(events.some((event) => event.kind === 'added'));
    assert.ok(events.some((event) => event.kind === 'updated'));
    assert.ok(events.some((event) => event.kind === 'removed'));
  });

  it('dismiss is local to one Display and runtime-only', () => {
    const manager = new NotificationManager({
      createId: () => 'shared',
      now: () => 1,
    });

    manager.publishNotification({
      id: 'shared',
      message: 'Shared',
      severity: 'critical',
      displayIds: ['display-a', 'display-b'],
      dismissable: true,
    });

    assert.equal(manager.dismissForDisplay('display-a', 'shared'), true);
    assert.equal(manager.getNotificationsForDisplay('display-a').length, 0);
    assert.equal(manager.getNotificationsForDisplay('display-b').length, 1);
    assert.ok(manager.getActiveNotification('shared'));

    // Same-id update keeps dismiss on display-a.
    manager.updateNotification({
      id: 'shared',
      message: 'Still shared',
      severity: 'warning',
    });
    assert.equal(manager.getNotificationsForDisplay('display-a').length, 0);
    assert.equal(manager.getNotificationsForDisplay('display-b').length, 1);
    assert.equal(
      manager.getNotificationsForDisplay('display-b')[0]?.severity,
      'warning',
    );

    // Remove cleans dismissed sets.
    manager.removeNotification('shared');
    assert.equal(manager.isDismissedOnDisplay('display-a', 'shared'), false);

    manager.publishNotification({
      id: 'other',
      message: 'New',
      severity: 'info',
      displayIds: ['display-a'],
    });
    assert.equal(manager.getNotificationsForDisplay('display-a').length, 1);
  });

  it('reset clears dismiss state (app restart semantics)', () => {
    const manager = new NotificationManager({ createId: () => 'a', now: () => 1 });
    manager.publishNotification({
      id: 'a',
      message: 'A',
      severity: 'info',
      displayIds: ['d1'],
    });
    manager.dismissForDisplay('d1', 'a');
    assert.equal(manager.getNotificationsForDisplay('d1').length, 0);

    manager.reset();
    manager.publishNotification({
      id: 'a',
      message: 'A',
      severity: 'info',
      displayIds: ['d1'],
    });
    assert.equal(manager.getNotificationsForDisplay('d1').length, 1);
  });

  it('rejects non-dismissable local dismiss', () => {
    const manager = new NotificationManager({ createId: () => 'x', now: () => 1 });
    manager.publishNotification({
      id: 'x',
      message: 'Locked',
      severity: 'critical',
      dismissable: false,
      displayIds: ['d1'],
    });
    assert.equal(manager.dismissForDisplay('d1', 'x'), false);
    assert.equal(manager.getNotificationsForDisplay('d1').length, 1);
  });

  it('enforces per-display limit', () => {
    const manager = new NotificationManager({
      maxPerDisplay: 2,
      now: () => 1,
      createId: () => `id-${Math.random()}`,
    });

    assert.equal(
      manager.publishNotification({
        message: '1',
        severity: 'info',
        displayIds: ['d1'],
      }).ok,
      true,
    );
    assert.equal(
      manager.publishNotification({
        message: '2',
        severity: 'info',
        displayIds: ['d1'],
      }).ok,
      true,
    );
    const third = manager.publishNotification({
      message: '3',
      severity: 'info',
      displayIds: ['d1'],
    });
    assert.equal(third.ok, false);
    if (!third.ok) {
      assert.equal(third.code, 'display_limit');
    }
  });

  it('snapshot ordering is severity then publish order', () => {
    let tick = 0;
    const manager = new NotificationManager({
      now: () => {
        tick += 1;
        return tick;
      },
    });

    manager.publishNotification({
      id: 'info-late',
      message: 'info',
      severity: 'info',
      displayIds: ['d1'],
    });
    manager.publishNotification({
      id: 'critical',
      message: 'critical',
      severity: 'critical',
      displayIds: ['d1'],
    });
    manager.publishNotification({
      id: 'info-early',
      message: 'info2',
      severity: 'info',
      displayIds: ['d1'],
    });

    const visible = manager.getNotificationsForDisplay('d1');
    assert.deepEqual(
      visible.map((item) => item.id),
      ['critical', 'info-late', 'info-early'],
    );
  });

  it('rejects unsafe icon keys', () => {
    const manager = new NotificationManager();
    const result = manager.publishNotification({
      message: 'x',
      severity: 'info',
      displayIds: ['d1'],
      icon: '<script>' as unknown as 'info',
    });
    assert.equal(result.ok, false);
  });

  it('removeDisplay cleans routing and dismissed state', () => {
    const manager = new NotificationManager({ createId: () => 'n', now: () => 1 });
    manager.publishNotification({
      id: 'n',
      message: 'm',
      severity: 'info',
      displayIds: ['d1', 'd2'],
    });
    manager.dismissForDisplay('d1', 'n');
    manager.removeDisplay('d1');
    assert.equal(manager.isDismissedOnDisplay('d1', 'n'), false);
    assert.equal(manager.getNotificationsForDisplay('d2').length, 1);

    manager.removeDisplay('d2');
    assert.equal(manager.getActiveNotification('n'), null);
  });
});
