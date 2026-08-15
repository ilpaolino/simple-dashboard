import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  diffReferencedDeviceIds,
  extractReferencedDeviceIds,
} from '../lib/realtime/extractReferencedDeviceIds';
import { RealtimeSubscriptionManager } from '../lib/realtime/RealtimeSubscriptionManager';
import { RealtimeMetrics } from '../lib/realtime/RealtimeMetrics';
import type { HomeyCapabilitySubscription } from '../lib/homey/types';
import type { DashboardConfiguration } from '../lib/widgets/types';
import type { Logger } from '../lib/types';

function silentLogger(): Logger {
  return {
    info() {},
    warn() {},
    error() {},
  };
}

function lightConfig(
  widgets: readonly {
    readonly id: string;
    readonly deviceId: string;
  }[],
): DashboardConfiguration {
  return {
    version: 1,
    widgets: widgets.map((widget) => ({
      id: widget.id,
      type: 'light' as const,
      placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
      config: { deviceId: widget.deviceId },
    })),
  };
}

describe('extractReferencedDeviceIds', () => {
  it('extracts unique light device ids', () => {
    const ids = extractReferencedDeviceIds(
      lightConfig([
        { id: 'a', deviceId: 'dev-1' },
        { id: 'b', deviceId: 'dev-2' },
        { id: 'c', deviceId: 'dev-1' },
      ]),
    );
    assert.deepEqual(ids, ['dev-1', 'dev-2']);
  });

  it('returns empty for dashboards without devices', () => {
    assert.deepEqual(
      extractReferencedDeviceIds({ version: 1, widgets: [] }),
      [],
    );
  });

  it('diffs added and removed devices', () => {
    const diff = diffReferencedDeviceIds(['a', 'b'], ['b', 'c']);
    assert.deepEqual(diff.added, ['c']);
    assert.deepEqual(diff.removed, ['a']);
    assert.deepEqual(diff.unchanged, ['b']);
  });
});

describe('RealtimeSubscriptionManager', () => {
  it('reference-counts shared Homey subscriptions', async () => {
    const destroys: string[] = [];
    const subscribed: string[] = [];

    const manager = new RealtimeSubscriptionManager({
      logger: silentLogger(),
      metrics: new RealtimeMetrics(),
      onCapabilityValue() {},
      onDeviceRemoved() {},
      subscriber: {
        async subscribeCapability({ deviceId }) {
          subscribed.push(deviceId);
          const handle: HomeyCapabilitySubscription = {
            destroy() {
              destroys.push(deviceId);
            },
          };
          return handle;
        },
      },
    });

    await manager.setDisplayDevices('display-a', ['device-x']);
    assert.equal(manager.getRefCount('device-x'), 1);
    assert.equal(subscribed.length, 1);

    await manager.setDisplayDevices('display-b', ['device-x']);
    assert.equal(manager.getRefCount('device-x'), 2);
    assert.equal(subscribed.length, 1);

    await manager.setDisplayDevices('display-a', []);
    assert.equal(manager.getRefCount('device-x'), 1);
    assert.equal(destroys.length, 0);

    await manager.setDisplayDevices('display-b', []);
    assert.equal(manager.getRefCount('device-x'), 0);
    assert.equal(destroys.length, 1);

    await manager.destroy();
  });

  it('handles multiple devices and config changes', async () => {
    let active = 0;
    const manager = new RealtimeSubscriptionManager({
      logger: silentLogger(),
      metrics: new RealtimeMetrics(),
      onCapabilityValue() {},
      onDeviceRemoved() {},
      subscriber: {
        async subscribeCapability() {
          active += 1;
          return {
            destroy() {
              active -= 1;
            },
          };
        },
      },
    });

    await manager.setDisplayDevices('d1', ['a', 'b']);
    assert.equal(active, 2);

    await manager.setDisplayDevices('d1', ['b', 'c']);
    assert.equal(active, 2);
    assert.equal(manager.getRefCount('a'), 0);
    assert.equal(manager.getRefCount('b'), 1);
    assert.equal(manager.getRefCount('c'), 1);

    await manager.removeDisplay('d1');
    assert.equal(active, 0);
  });

  it('routes capability events only to interested displays', async () => {
    const received: string[] = [];
    const listeners = new Map<string, (value: unknown) => void>();

    const manager = new RealtimeSubscriptionManager({
      logger: silentLogger(),
      metrics: new RealtimeMetrics(),
      onCapabilityValue(event) {
        for (const displayId of manager.getDisplayIdsForDevice(event.deviceId)) {
          received.push(displayId);
        }
      },
      onDeviceRemoved() {},
      subscriber: {
        async subscribeCapability({ deviceId, onValue }) {
          listeners.set(deviceId, onValue);
          return { destroy() {} };
        },
      },
    });

    await manager.setDisplayDevices('kitchen', ['lamp']);
    await manager.setDisplayDevices('hallway', ['other']);

    listeners.get('lamp')?.(true);
    assert.deepEqual(received, ['kitchen']);
  });

  it('notifies when Homey destroys a subscription (device removed)', async () => {
    const removed: string[] = [];
    let destroyCb: (() => void) | null = null;

    const manager = new RealtimeSubscriptionManager({
      logger: silentLogger(),
      metrics: new RealtimeMetrics(),
      onCapabilityValue() {},
      onDeviceRemoved(deviceId) {
        removed.push(deviceId);
      },
      subscriber: {
        async subscribeCapability({ onDestroyed }) {
          destroyCb = onDestroyed ?? null;
          return {
            destroy() {
              onDestroyed?.();
            },
          };
        },
      },
    });

    await manager.setDisplayDevices('kitchen', ['lamp']);
    destroyCb?.();
    assert.deepEqual(removed, ['lamp']);
  });

  it('cleans up on display disconnect without leaking subscriptions', async () => {
    let active = 0;
    const manager = new RealtimeSubscriptionManager({
      logger: silentLogger(),
      metrics: new RealtimeMetrics(),
      onCapabilityValue() {},
      onDeviceRemoved() {},
      subscriber: {
        async subscribeCapability() {
          active += 1;
          return {
            destroy() {
              active -= 1;
            },
          };
        },
      },
    });

    for (let i = 0; i < 5; i += 1) {
      await manager.setDisplayDevices('d1', ['x']);
      await manager.removeDisplay('d1');
    }

    assert.equal(active, 0);
    assert.equal(manager.activeSubscriptionCount(), 0);
  });
});
