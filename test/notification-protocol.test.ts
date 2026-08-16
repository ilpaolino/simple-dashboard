import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isClientMessage,
  isDisplayNotification,
  isServerMessage,
} from '../lib/realtime/protocol';

describe('notification protocol', () => {
  it('validates DisplayNotification payloads', () => {
    assert.equal(
      isDisplayNotification({
        id: 'n1',
        message: 'Hello',
        severity: 'info',
        dismissable: true,
        highlight: false,
        publishedAt: 1,
      }),
      true,
    );
    assert.equal(
      isDisplayNotification({
        id: 'n1',
        message: 'Hello',
        severity: 'nope',
        dismissable: true,
        highlight: false,
        publishedAt: 1,
      }),
      false,
    );
    assert.equal(
      isDisplayNotification({
        id: 'n1',
        message: 'Hello',
        severity: 'info',
        icon: '<svg>',
        dismissable: true,
        highlight: false,
        publishedAt: 1,
      }),
      false,
    );
  });

  it('accepts notification server and client messages', () => {
    assert.equal(
      isServerMessage({
        type: 'notification-added',
        notification: {
          id: 'n1',
          message: 'Hello',
          severity: 'warning',
          dismissable: true,
          highlight: true,
          publishedAt: 10,
          icon: 'bell',
        },
      }),
      true,
    );
    assert.equal(
      isServerMessage({
        type: 'notification-removed',
        notificationId: 'n1',
      }),
      true,
    );
    assert.equal(
      isServerMessage({
        type: 'notification-snapshot',
        notifications: [],
      }),
      true,
    );
    assert.equal(
      isClientMessage({
        type: 'notification-dismiss',
        notificationId: 'n1',
      }),
      true,
    );
    assert.equal(
      isClientMessage({ type: 'notification-center-opened' }),
      true,
    );
  });
});
