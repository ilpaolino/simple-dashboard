/**
 * Milestone 12 notification lifecycle, auto-open defaults, and action validation.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WebSocket, WebSocketServer } from 'ws';
import {
  NotificationManager,
  normalizeNotificationAction,
  normalizePublishInput,
  normalizeAutoCloseSeconds,
} from '../lib/notifications';
import { DisplayRealtimeSession } from '../lib/realtime/DisplayRealtimeSession';
import { RealtimeMetrics } from '../lib/realtime/RealtimeMetrics';
import {
  isClientMessage,
  isDisplayNotification,
  coerceDisplayNotification,
  parseClientMessage,
  type ClientMessage,
} from '../lib/realtime/protocol';
import { parseShowAction } from '../lib/flow/registerNotificationFlowCards';
import { NotificationController } from '../frontend/notifications/NotificationController';
import { shouldAutoOpenFromPush } from '../frontend/notifications/autoOpenFromPush';
import type { DisplayNotification } from '../lib/notifications/types';

function baseNotification(
  overrides: Partial<DisplayNotification> = {},
): DisplayNotification {
  return {
    id: 'n1',
    message: 'Hello',
    severity: 'info',
    dismissable: true,
    highlight: false,
    publishedAt: 1,
    autoOpen: true,
    ...overrides,
  };
}

describe('M12 backward compatibility defaults', () => {
  it('publish without new fields defaults autoOpen=true, no autoClose, no action', () => {
    const normalized = normalizePublishInput({
      message: 'Laundry done',
      severity: 'success',
      displayIds: ['display-a'],
    });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) {
      return;
    }
    assert.equal(normalized.value.autoOpen, true);
    assert.equal(normalized.value.autoCloseSeconds, undefined);
    assert.equal(normalized.value.action, undefined);
  });

  it('M11B-shaped wire payload coerces autoOpen true', () => {
    const legacy = {
      id: 'legacy',
      message: 'Hi',
      severity: 'info' as const,
      dismissable: true,
      highlight: false,
      publishedAt: 10,
    };
    assert.equal(isDisplayNotification(legacy), true);
    const coerced = coerceDisplayNotification(legacy as DisplayNotification);
    assert.equal(coerced.autoOpen, true);
  });

  it('NotificationManager publish applies M12 defaults', () => {
    const manager = new NotificationManager({
      createId: () => 'id-1',
      now: () => 100,
    });
    const published = manager.publishNotification({
      message: 'Ping',
      severity: 'warning',
      displayIds: ['d1'],
    });
    assert.equal(published.ok, true);
    if (!published.ok) {
      return;
    }
    assert.equal(published.value.autoOpen, true);
    assert.equal(published.value.autoCloseSeconds, undefined);
    assert.equal(published.value.action, undefined);
  });
});

describe('M12 auto-close normalization', () => {
  it('treats 0 / absent as disabled and clamps to 300', () => {
    assert.deepEqual(normalizeAutoCloseSeconds(undefined), {
      ok: true,
      value: undefined,
    });
    assert.deepEqual(normalizeAutoCloseSeconds(0), {
      ok: true,
      value: undefined,
    });
    assert.deepEqual(normalizeAutoCloseSeconds(15), { ok: true, value: 15 });
    assert.deepEqual(normalizeAutoCloseSeconds(999), { ok: true, value: 300 });
  });
});

describe('M12 notification action model', () => {
  it('validates actionId / label / optional text', () => {
    const ok = normalizeNotificationAction({
      actionId: 'open-gate',
      label: 'Open gate',
      text: 'Press to open',
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) {
      return;
    }
    assert.equal(ok.value.actionId, 'open-gate');
    assert.equal(ok.value.label, 'Open gate');
    assert.equal(ok.value.text, 'Press to open');

    assert.equal(
      normalizeNotificationAction({ actionId: '', label: 'x' }).ok,
      false,
    );
    assert.equal(
      normalizeNotificationAction({ actionId: 'ok', label: '' }).ok,
      false,
    );
  });

  it('upsert can add, replace, and clear action', () => {
    const manager = new NotificationManager({
      createId: () => 'flow-1',
      now: () => 1,
    });

    const created = manager.upsertForDisplay({
      displayId: 'kitchen',
      notificationKey: 'doorbell',
      message: 'Ring',
      severity: 'warning',
      action: {
        actionId: 'open-gate',
        label: 'Open gate',
      },
      autoOpen: true,
      autoCloseSeconds: 15,
    });
    assert.equal(created.ok, true);
    if (!created.ok) {
      return;
    }
    assert.equal(created.value.action?.actionId, 'open-gate');
    assert.equal(created.value.autoCloseSeconds, 15);
    assert.equal(created.value.notificationKey, 'doorbell');

    const updated = manager.upsertForDisplay({
      displayId: 'kitchen',
      notificationKey: 'doorbell',
      message: 'Ring again',
      severity: 'warning',
      action: {
        actionId: 'call-owner',
        label: 'Call',
      },
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) {
      return;
    }
    assert.equal(updated.value.id, created.value.id);
    assert.equal(updated.value.action?.actionId, 'call-owner');

    const cleared = manager.upsertForDisplay({
      displayId: 'kitchen',
      notificationKey: 'doorbell',
      message: 'Ring',
      severity: 'info',
      action: null,
      autoCloseSeconds: 0,
    });
    assert.equal(cleared.ok, true);
    if (!cleared.ok) {
      return;
    }
    assert.equal(cleared.value.action, undefined);
    assert.equal(cleared.value.autoCloseSeconds, undefined);
  });
});

describe('M12 action backend validation', () => {
  it('accepts matching action and rejects forged / wrong / missing', () => {
    let seq = 0;
    const manager = new NotificationManager({
      createId: () => `n-action-${(seq += 1)}`,
      now: () => seq,
    });
    manager.upsertForDisplay({
      displayId: 'kitchen',
      notificationKey: 'doorbell',
      message: 'Ring',
      severity: 'warning',
      action: { actionId: 'open-gate', label: 'Open' },
    });
    manager.upsertForDisplay({
      displayId: 'entrance',
      notificationKey: 'doorbell',
      message: 'Ring',
      severity: 'warning',
      action: { actionId: 'open-main-door', label: 'Open door' },
    });

    const kitchenId = manager.getNotificationIdByKey('kitchen', 'doorbell');
    assert.ok(kitchenId);

    const ok = manager.resolveNotificationAction({
      displayId: 'kitchen',
      notificationId: kitchenId!,
      actionId: 'open-gate',
      notificationKey: 'doorbell',
    });
    assert.ok(ok);
    assert.equal(ok?.action?.actionId, 'open-gate');

    assert.equal(
      manager.resolveNotificationAction({
        displayId: 'kitchen',
        notificationId: kitchenId!,
        actionId: 'forged',
        notificationKey: 'doorbell',
      }),
      null,
    );
    assert.equal(
      manager.resolveNotificationAction({
        displayId: 'kitchen',
        notificationId: kitchenId!,
        actionId: 'open-gate',
        notificationKey: 'wrong-key',
      }),
      null,
    );
    assert.equal(
      manager.resolveNotificationAction({
        displayId: 'entrance',
        notificationId: kitchenId!,
        actionId: 'open-gate',
        notificationKey: 'doorbell',
      }),
      null,
    );
    assert.equal(
      manager.resolveNotificationAction({
        displayId: 'kitchen',
        notificationId: 'missing',
        actionId: 'open-gate',
        notificationKey: 'doorbell',
      }),
      null,
    );
  });

  it('isolates same key across Displays', () => {
    let seq = 0;
    const manager = new NotificationManager({
      createId: () => `id-${(seq += 1)}`,
      now: () => seq,
    });
    manager.upsertForDisplay({
      displayId: 'kitchen',
      notificationKey: 'doorbell',
      message: 'A',
      severity: 'info',
      action: { actionId: 'open-gate', label: 'Gate' },
    });
    manager.upsertForDisplay({
      displayId: 'entrance',
      notificationKey: 'doorbell',
      message: 'B',
      severity: 'info',
      action: { actionId: 'open-main-door', label: 'Door' },
    });

    const kitchen = manager.getNotificationsForDisplay('kitchen')[0];
    const entrance = manager.getNotificationsForDisplay('entrance')[0];
    assert.ok(kitchen && entrance);
    assert.notEqual(kitchen.id, entrance.id);
    assert.equal(kitchen.action?.actionId, 'open-gate');
    assert.equal(entrance.action?.actionId, 'open-main-door');
  });
});

describe('M12 WebSocket notification-action protocol', () => {
  it('accepts typed notification-action client messages', () => {
    const message = {
      type: 'notification-action',
      notificationId: 'n1',
      notificationKey: 'doorbell',
      actionId: 'open-gate',
      requestId: 'req-1',
    };
    assert.equal(isClientMessage(message), true);
    assert.equal(
      parseClientMessage(JSON.stringify(message))?.type,
      'notification-action',
    );
  });

  it('rejects incomplete action payloads', () => {
    assert.equal(
      isClientMessage({
        type: 'notification-action',
        notificationId: 'n1',
        notificationKey: 'doorbell',
        actionId: '',
        requestId: 'req-1',
      }),
      false,
    );
  });
});

describe('M12 frontend auto-open controller semantics', () => {
  it('autoOpen=false still stores notification without requiring center open', () => {
    const controller = new NotificationController();
    controller.addNotification(
      baseNotification({ id: 'quiet', autoOpen: false, severity: 'warning' }),
    );
    assert.equal(controller.getVisibleCount(), 1);
    assert.equal(controller.isCenterOpen(), false);
    assert.equal(controller.getMaxSeverity(), 'warning');
    assert.equal(controller.openCenter(true), true);
    assert.equal(controller.isCenterOpen(), true);
  });

  it('update of already-visible notification keeps center state', () => {
    const controller = new NotificationController();
    controller.addNotification(baseNotification({ id: 'a', message: 'one' }));
    controller.openCenter(true);
    assert.equal(controller.isCenterOpen(), true);
    controller.updateNotification(
      baseNotification({ id: 'a', message: 'two', autoOpen: true }),
    );
    assert.equal(controller.isCenterOpen(), true);
    assert.equal(controller.getCurrent()?.message, 'two');
  });
});

describe('M12 auto-open from Flow Show upsert', () => {
  it('re-presents after auto-close of the same already-visible notification', () => {
    assert.equal(shouldAutoOpenFromPush(true, 'added'), true);
    assert.equal(shouldAutoOpenFromPush(true, 'updated'), true);
    assert.equal(shouldAutoOpenFromPush(true, 'restored'), true);
    assert.equal(shouldAutoOpenFromPush(undefined, 'updated'), true);
    assert.equal(shouldAutoOpenFromPush(false, 'updated'), false);
    assert.equal(shouldAutoOpenFromPush(true, 'snapshot'), false);
  });
});

describe('M12 Flow interactive action args', () => {
  const translate = (key: string): string => key;

  it('attaches action when ID and label are filled even if enable_action is false', () => {
    const parsed = parseShowAction(
      {
        enable_action: false,
        action_id: 'open-gate',
        action_label: 'Apri cancello',
        action_text: 'Premi per aprire',
      },
      translate,
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.action?.actionId, 'open-gate');
    assert.equal(parsed.action?.label, 'Apri cancello');
  });

  it('leaves action empty when checkbox is off and fields are empty', () => {
    const parsed = parseShowAction({ enable_action: false }, translate);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) {
      return;
    }
    assert.equal(parsed.action, null);
  });
});

describe('M12 DisplayRealtimeSession forwards notification client messages', () => {
  async function createListeningServer(): Promise<{
    readonly wss: WebSocketServer;
    readonly port: number;
  }> {
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    await new Promise<void>((resolve) => wss.once('listening', () => resolve()));
    const address = wss.address();
    assert.ok(address && typeof address === 'object');
    return { wss, port: address.port };
  }

  async function openPair(
    wss: WebSocketServer,
    port: number,
  ): Promise<{ readonly server: WebSocket; readonly client: WebSocket }> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('connection timeout')), 2000);
      const client = new WebSocket(`ws://127.0.0.1:${port}`);
      wss.once('connection', (server) => {
        clearTimeout(timer);
        resolve({ server, client });
      });
    });
  }

  async function waitUntilOpen(client: WebSocket): Promise<void> {
    if (client.readyState === WebSocket.OPEN) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('client not open')), 2000);
      client.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  async function waitUntil(
    isDone: () => boolean,
    label: string,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(label)), 2000);
      const poll = setInterval(() => {
        if (isDone()) {
          clearInterval(poll);
          clearTimeout(timer);
          resolve();
        }
      }, 10);
    });
  }

  it('forwards notification-action instead of treating it as unknown', async () => {
    const { wss, port } = await createListeningServer();
    const received: ClientMessage[] = [];
    const protocolErrors: string[] = [];
    const { server, client } = await openPair(wss, port);
    const session = new DisplayRealtimeSession({
      displayId: 'd1',
      remoteAddress: '127.0.0.1',
      socket: server,
      metrics: new RealtimeMetrics(),
      heartbeatIntervalMs: 60_000,
      heartbeatTimeoutMs: 120_000,
      onClose() {},
      onClientMessage(_session, message) {
        received.push(message);
      },
      onProtocolError(_session, reason) {
        protocolErrors.push(reason);
      },
    });

    await waitUntilOpen(client);
    client.send(
      JSON.stringify({
        type: 'notification-action',
        notificationId: 'n1',
        notificationKey: 'doorbell',
        actionId: 'open-gate',
        requestId: 'req-1',
      }),
    );
    await waitUntil(
      () => received.length > 0 || protocolErrors.length > 0,
      'notification-action was not forwarded',
    );

    assert.deepEqual(protocolErrors, []);
    assert.equal(received[0]?.type, 'notification-action');
    if (received[0]?.type === 'notification-action') {
      assert.equal(received[0].notificationId, 'n1');
      assert.equal(received[0].notificationKey, 'doorbell');
      assert.equal(received[0].actionId, 'open-gate');
      assert.equal(received[0].requestId, 'req-1');
    }

    session.close();
    client.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  it('forwards auto-open and auto-close client messages', async () => {
    const { wss, port } = await createListeningServer();
    const received: ClientMessage[] = [];
    const { server, client } = await openPair(wss, port);
    const session = new DisplayRealtimeSession({
      displayId: 'd1',
      remoteAddress: '127.0.0.1',
      socket: server,
      metrics: new RealtimeMetrics(),
      heartbeatIntervalMs: 60_000,
      heartbeatTimeoutMs: 120_000,
      onClose() {},
      onClientMessage(_session, message) {
        received.push(message);
      },
      onProtocolError() {},
    });

    await waitUntilOpen(client);
    client.send(JSON.stringify({ type: 'notification-auto-opened' }));
    client.send(JSON.stringify({ type: 'notification-auto-closed' }));
    await waitUntil(
      () => received.length >= 2,
      'auto-open/close messages were not forwarded',
    );

    assert.equal(received[0]?.type, 'notification-auto-opened');
    assert.equal(received[1]?.type, 'notification-auto-closed');

    session.close();
    client.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  it('rejects incomplete notification-action payloads as protocol errors', async () => {
    const { wss, port } = await createListeningServer();
    const received: ClientMessage[] = [];
    const protocolErrors: string[] = [];
    const { server, client } = await openPair(wss, port);
    const session = new DisplayRealtimeSession({
      displayId: 'd1',
      remoteAddress: '127.0.0.1',
      socket: server,
      metrics: new RealtimeMetrics(),
      heartbeatIntervalMs: 60_000,
      heartbeatTimeoutMs: 120_000,
      onClose() {},
      onClientMessage(_session, message) {
        received.push(message);
      },
      onProtocolError(_session, reason) {
        protocolErrors.push(reason);
      },
    });

    await waitUntilOpen(client);
    client.send(
      JSON.stringify({
        type: 'notification-action',
        notificationId: 'n1',
        notificationKey: 'doorbell',
        actionId: '',
        requestId: 'req-1',
      }),
    );
    await waitUntil(
      () => protocolErrors.length > 0 || received.length > 0,
      'invalid notification-action was not rejected',
    );

    assert.deepEqual(received, []);
    assert.deepEqual(protocolErrors, ['invalid_notification_action']);

    session.close();
    client.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });
});
