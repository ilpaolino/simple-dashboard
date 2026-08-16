import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotificationManager } from '../lib/notifications/NotificationManager';
import { normalizeNotificationKey } from '../lib/notifications/keys';

describe('notification key validation', () => {
  it('accepts simple keys and rejects empty or invalid', () => {
    assert.equal(normalizeNotificationKey('lavatrice').ok, true);
    assert.equal(normalizeNotificationKey('raccolta-rifiuti').ok, true);
    assert.equal(normalizeNotificationKey('a_b.c-1').ok, true);
    assert.equal(normalizeNotificationKey('').ok, false);
    assert.equal(normalizeNotificationKey('  ').ok, false);
    assert.equal(normalizeNotificationKey('has space').ok, false);
    assert.equal(normalizeNotificationKey('bad/key').ok, false);
  });
});

describe('NotificationManager Flow upsert / remove by key', () => {
  it('upserts by displayId + key without duplicates', () => {
    const manager = new NotificationManager({
      createId: () => 'id-1',
      now: () => 10,
    });

    const first = manager.upsertForDisplay({
      displayId: 'cucina',
      notificationKey: 'lavatrice',
      message: 'one',
      severity: 'info',
    });
    assert.equal(first.ok, true);
    if (!first.ok) {
      return;
    }
    assert.equal(first.created, true);
    assert.equal(first.value.id, 'id-1');

    const second = manager.upsertForDisplay({
      displayId: 'cucina',
      notificationKey: 'lavatrice',
      message: 'two',
      severity: 'warning',
      highlight: true,
    });
    assert.equal(second.ok, true);
    if (!second.ok) {
      return;
    }
    assert.equal(second.created, false);
    assert.equal(second.value.id, 'id-1');
    assert.equal(second.value.message, 'two');
    assert.equal(second.value.severity, 'warning');
    assert.equal(manager.getActiveCountForDisplay('cucina'), 1);
  });

  it('allows same key on different Displays as distinct instances', () => {
    let n = 0;
    const manager = new NotificationManager({
      createId: () => `id-${(n += 1)}`,
      now: () => n,
    });

    manager.upsertForDisplay({
      displayId: 'cucina',
      notificationKey: 'raccolta-rifiuti',
      message: 'cucina',
      severity: 'info',
    });
    manager.upsertForDisplay({
      displayId: 'ingresso',
      notificationKey: 'raccolta-rifiuti',
      message: 'ingresso',
      severity: 'warning',
    });

    assert.equal(manager.getActiveCountForDisplay('cucina'), 1);
    assert.equal(manager.getActiveCountForDisplay('ingresso'), 1);
    assert.notEqual(
      manager.getNotificationIdByKey('cucina', 'raccolta-rifiuti'),
      manager.getNotificationIdByKey('ingresso', 'raccolta-rifiuti'),
    );
  });

  it('Flow upsert clears local dismiss so Show can re-surface', () => {
    const manager = new NotificationManager({
      createId: () => 'same',
      now: () => 1,
    });
    manager.upsertForDisplay({
      displayId: 'd1',
      notificationKey: 'a',
      message: 'hi',
      severity: 'info',
      dismissable: true,
    });
    assert.equal(manager.dismissForDisplay('d1', 'same'), true);
    assert.equal(manager.getNotificationsForDisplay('d1').length, 0);

    manager.upsertForDisplay({
      displayId: 'd1',
      notificationKey: 'a',
      message: 'updated',
      severity: 'critical',
    });
    assert.equal(manager.getNotificationsForDisplay('d1').length, 1);
    assert.equal(manager.getActiveCountForDisplay('d1'), 1);
    assert.equal(manager.isDismissedOnDisplay('d1', 'same'), false);
  });

  it('remove by key is idempotent and republish becomes visible', () => {
    let n = 0;
    const manager = new NotificationManager({
      createId: () => `n-${(n += 1)}`,
      now: () => n,
    });

    manager.upsertForDisplay({
      displayId: 'd1',
      notificationKey: 'a',
      message: 'hi',
      severity: 'info',
    });
    manager.dismissForDisplay('d1', 'n-1');

    const removed = manager.removeByKey('d1', 'a');
    assert.equal(removed.ok, true);
    if (removed.ok) {
      assert.equal(removed.value.removed, true);
    }
    const missing = manager.removeByKey('d1', 'a');
    assert.equal(missing.ok, true);
    if (missing.ok) {
      assert.equal(missing.value.removed, false);
    }

    manager.upsertForDisplay({
      displayId: 'd1',
      notificationKey: 'a',
      message: 'again',
      severity: 'info',
    });
    assert.equal(manager.getNotificationsForDisplay('d1').length, 1);
  });

  it('removeAllForDisplay only clears the target Display', () => {
    let n = 0;
    const manager = new NotificationManager({
      createId: () => `n-${(n += 1)}`,
      now: () => n,
    });

    manager.upsertForDisplay({
      displayId: 'cucina',
      notificationKey: 'a',
      message: 'a',
      severity: 'info',
    });
    manager.upsertForDisplay({
      displayId: 'cucina',
      notificationKey: 'b',
      message: 'b',
      severity: 'warning',
    });
    manager.upsertForDisplay({
      displayId: 'ingresso',
      notificationKey: 'a',
      message: 'c',
      severity: 'critical',
    });

    const result = manager.removeAllForDisplay('cucina');
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.removedCount, 2);
    }
    assert.equal(manager.getActiveCountForDisplay('cucina'), 0);
    assert.equal(manager.getActiveCountForDisplay('ingresso'), 1);
  });

  it('aggregate severity ignores local dismiss', () => {
    const manager = new NotificationManager({
      createId: () => 'id',
      now: () => 1,
    });
    manager.upsertForDisplay({
      displayId: 'd1',
      notificationKey: 'a',
      message: 'a',
      severity: 'critical',
      dismissable: true,
    });
    assert.equal(manager.getHighestActiveSeverityForDisplay('d1'), 'critical');
    assert.equal(manager.getActiveCountForDisplay('d1'), 1);
    manager.dismissForDisplay('d1', 'id');
    assert.equal(manager.getHighestActiveSeverityForDisplay('d1'), 'critical');
    assert.equal(manager.getActiveCountForDisplay('d1'), 1);
    assert.equal(manager.getNotificationsForDisplay('d1').length, 0);
  });
});
