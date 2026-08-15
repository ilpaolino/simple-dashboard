import type { Logger } from '../types';
import type { HomeyCapabilitySubscription } from '../homey/types';
import { REALTIME_LIGHT_CAPABILITY_ID } from './constants';
import { diffReferencedDeviceIds } from './extractReferencedDeviceIds';
import type { RealtimeMetrics } from './RealtimeMetrics';

export interface HomeyCapabilitySubscriber {
  subscribeCapability(options: {
    readonly deviceId: string;
    readonly capabilityId: string;
    readonly onValue: (value: unknown) => void;
    readonly onDestroyed?: () => void;
  }): Promise<HomeyCapabilitySubscription | null>;
}

export interface SubscriptionDiagnostic {
  readonly deviceId: string;
  readonly capabilityId: string;
  readonly refCount: number;
  readonly displayIds: readonly string[];
  readonly subscribed: boolean;
}

export interface RealtimeSubscriptionManagerOptions {
  readonly subscriber: HomeyCapabilitySubscriber;
  readonly metrics: RealtimeMetrics;
  readonly logger: Logger;
  readonly onCapabilityValue: (event: {
    readonly deviceId: string;
    readonly capabilityId: string;
    readonly value: unknown;
  }) => void;
  readonly onDeviceRemoved: (deviceId: string) => void;
}

interface DeviceSubscriptionEntry {
  refCount: number;
  readonly displayIds: Set<string>;
  subscription: HomeyCapabilitySubscription | null;
  readonly capabilityId: string;
}

/**
 * Reference-counted Homey capability subscriptions shared across displays.
 */
export class RealtimeSubscriptionManager {
  private readonly byDeviceId = new Map<string, DeviceSubscriptionEntry>();
  private readonly devicesByDisplay = new Map<string, ReadonlySet<string>>();
  private readonly subscriber: HomeyCapabilitySubscriber;
  private readonly metrics: RealtimeMetrics;
  private readonly logger: Logger;
  private readonly onCapabilityValue: RealtimeSubscriptionManagerOptions['onCapabilityValue'];
  private readonly onDeviceRemoved: RealtimeSubscriptionManagerOptions['onDeviceRemoved'];

  public constructor(options: RealtimeSubscriptionManagerOptions) {
    this.subscriber = options.subscriber;
    this.metrics = options.metrics;
    this.logger = options.logger;
    this.onCapabilityValue = options.onCapabilityValue;
    this.onDeviceRemoved = options.onDeviceRemoved;
  }

  /**
   * Replace the set of Homey devices a display cares about.
   * Applies a diff — does not tear down unchanged shared subscriptions.
   */
  public async setDisplayDevices(
    displayId: string,
    deviceIds: readonly string[],
  ): Promise<void> {
    const unique = [...new Set(deviceIds.map((id) => id.trim()).filter(Boolean))];
    const previous = [...(this.devicesByDisplay.get(displayId) ?? [])];
    const { added, removed } = diffReferencedDeviceIds(previous, unique);

    for (const deviceId of removed) {
      await this.release(displayId, deviceId);
    }

    for (const deviceId of added) {
      await this.acquire(displayId, deviceId);
    }

    this.devicesByDisplay.set(displayId, new Set(unique));
    this.syncMetrics();
  }

  public async removeDisplay(displayId: string): Promise<void> {
    const devices = this.devicesByDisplay.get(displayId);
    if (!devices) {
      return;
    }

    for (const deviceId of [...devices]) {
      await this.release(displayId, deviceId);
    }

    this.devicesByDisplay.delete(displayId);
    this.syncMetrics();
  }

  public getDisplayIdsForDevice(deviceId: string): readonly string[] {
    const entry = this.byDeviceId.get(deviceId);
    if (!entry) {
      return [];
    }
    return [...entry.displayIds].sort();
  }

  public getRefCount(deviceId: string): number {
    return this.byDeviceId.get(deviceId)?.refCount ?? 0;
  }

  public activeSubscriptionCount(): number {
    let count = 0;
    for (const entry of this.byDeviceId.values()) {
      if (entry.subscription) {
        count += 1;
      }
    }
    return count;
  }

  public listDiagnostics(): readonly SubscriptionDiagnostic[] {
    return [...this.byDeviceId.entries()]
      .map(([deviceId, entry]) => ({
        deviceId,
        capabilityId: entry.capabilityId,
        refCount: entry.refCount,
        displayIds: [...entry.displayIds].sort(),
        subscribed: entry.subscription !== null,
      }))
      .sort((left, right) => left.deviceId.localeCompare(right.deviceId));
  }

  public async destroy(): Promise<void> {
    for (const displayId of [...this.devicesByDisplay.keys()]) {
      await this.removeDisplay(displayId);
    }

    for (const [deviceId, entry] of [...this.byDeviceId.entries()]) {
      entry.subscription?.destroy();
      this.byDeviceId.delete(deviceId);
    }

    this.syncMetrics();
  }

  private async acquire(displayId: string, deviceId: string): Promise<void> {
    let entry = this.byDeviceId.get(deviceId);
    if (!entry) {
      entry = {
        refCount: 0,
        displayIds: new Set(),
        subscription: null,
        capabilityId: REALTIME_LIGHT_CAPABILITY_ID,
      };
      this.byDeviceId.set(deviceId, entry);
    }

    entry.displayIds.add(displayId);
    entry.refCount = entry.displayIds.size;

    if (entry.subscription) {
      return;
    }

    try {
      const subscription = await this.subscriber.subscribeCapability({
        deviceId,
        capabilityId: REALTIME_LIGHT_CAPABILITY_ID,
        onValue: (value) => {
          try {
            this.onCapabilityValue({
              deviceId,
              capabilityId: REALTIME_LIGHT_CAPABILITY_ID,
              value,
            });
          } catch (error) {
            this.logger.error('Realtime capability handler failed', {
              deviceId,
              error,
            });
          }
        },
        onDestroyed: () => {
          const current = this.byDeviceId.get(deviceId);
          if (!current) {
            return;
          }
          current.subscription = null;
          this.onDeviceRemoved(deviceId);
          this.syncMetrics();
        },
      });

      if (!subscription) {
        this.logger.warn('Homey device unavailable for realtime subscription', {
          deviceId,
        });
        this.onDeviceRemoved(deviceId);
        return;
      }

      entry.subscription = subscription;
      this.logger.info('Homey capability subscribed', {
        deviceId,
        capabilityId: REALTIME_LIGHT_CAPABILITY_ID,
        refCount: entry.refCount,
      });
    } catch (error) {
      this.logger.error('Failed to subscribe Homey capability', {
        deviceId,
        error,
      });
      this.onDeviceRemoved(deviceId);
    }
  }

  private async release(displayId: string, deviceId: string): Promise<void> {
    const entry = this.byDeviceId.get(deviceId);
    if (!entry) {
      return;
    }

    entry.displayIds.delete(displayId);
    entry.refCount = entry.displayIds.size;

    if (entry.refCount > 0) {
      return;
    }

    const subscription = entry.subscription;
    entry.subscription = null;
    this.byDeviceId.delete(deviceId);
    // Destroy after map removal so onDestroyed does not treat this as a Homey delete.
    subscription?.destroy();

    this.logger.info('Homey capability unsubscribed', {
      deviceId,
      capabilityId: REALTIME_LIGHT_CAPABILITY_ID,
    });
  }

  private syncMetrics(): void {
    this.metrics.setActiveSubscriptions(this.activeSubscriptionCount());
  }
}
