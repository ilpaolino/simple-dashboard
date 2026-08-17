import type { Logger } from '../types';
import type { HomeyCapabilitySubscription } from '../homey/types';
import {
  diffReferencedCapabilitySubscriptions,
  subscriptionKey,
  type HomeyCapabilityRef,
} from './extractReferencedDeviceIds';
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
  readonly onDeviceRemoved: (deviceId: string, capabilityId: string) => void;
}

interface CapabilitySubscriptionEntry {
  refCount: number;
  readonly displayIds: Set<string>;
  subscription: HomeyCapabilitySubscription | null;
  readonly deviceId: string;
  readonly capabilityId: string;
}

/**
 * Reference-counted Homey capability subscriptions shared across displays.
 * Keys are (deviceId, capabilityId) so LightWidget and CoverWidget can share
 * the same manager without duplicate listeners for the same capability.
 */
export class RealtimeSubscriptionManager {
  private readonly byKey = new Map<string, CapabilitySubscriptionEntry>();
  private readonly refsByDisplay = new Map<
    string,
    readonly HomeyCapabilityRef[]
  >();
  private readonly subscriber: HomeyCapabilitySubscriber;
  private readonly metrics: RealtimeMetrics;
  private readonly logger: Logger;
  private readonly onCapabilityValue: RealtimeSubscriptionManagerOptions['onCapabilityValue'];
  private readonly onDeviceRemoved: RealtimeSubscriptionManagerOptions['onDeviceRemoved'];
  private readonly acquiringByKey = new Map<string, Promise<void>>();

  public constructor(options: RealtimeSubscriptionManagerOptions) {
    this.subscriber = options.subscriber;
    this.metrics = options.metrics;
    this.logger = options.logger;
    this.onCapabilityValue = options.onCapabilityValue;
    this.onDeviceRemoved = options.onDeviceRemoved;
  }

  /**
   * Replace the Homey capability subscriptions a display cares about.
   * Applies a diff — does not tear down unchanged shared subscriptions.
   */
  public async setDisplaySubscriptions(
    displayId: string,
    refs: readonly HomeyCapabilityRef[],
  ): Promise<void> {
    const unique = dedupeRefs(refs);
    const previous = this.refsByDisplay.get(displayId) ?? [];
    const { added, removed } = diffReferencedCapabilitySubscriptions(
      previous,
      unique,
    );

    for (const ref of removed) {
      await this.release(displayId, ref);
    }

    for (const ref of added) {
      await this.acquire(displayId, ref);
    }

    this.refsByDisplay.set(displayId, unique);
    this.syncMetrics();
  }

  /**
   * @deprecated Prefer {@link setDisplaySubscriptions}. Kept for tests that
   * pass device ids with an implicit capability.
   */
  public async setDisplayDevices(
    displayId: string,
    deviceIds: readonly string[],
    capabilityId = 'onoff',
  ): Promise<void> {
    await this.setDisplaySubscriptions(
      displayId,
      deviceIds.map((deviceId) => ({
        deviceId,
        capabilityId,
      })),
    );
  }

  public async removeDisplay(displayId: string): Promise<void> {
    const refs = this.refsByDisplay.get(displayId);
    if (!refs) {
      return;
    }

    for (const ref of refs) {
      await this.release(displayId, ref);
    }

    this.refsByDisplay.delete(displayId);
    this.syncMetrics();
  }

  public getDisplayIdsForDevice(
    deviceId: string,
    capabilityId?: string,
  ): readonly string[] {
    if (capabilityId !== undefined) {
      const entry = this.byKey.get(subscriptionKey(deviceId, capabilityId));
      if (!entry) {
        return [];
      }
      return [...entry.displayIds].sort();
    }

    const displayIds = new Set<string>();
    for (const entry of this.byKey.values()) {
      if (entry.deviceId === deviceId) {
        for (const id of entry.displayIds) {
          displayIds.add(id);
        }
      }
    }
    return [...displayIds].sort();
  }

  public getRefCount(deviceId: string, capabilityId = 'onoff'): number {
    return this.byKey.get(subscriptionKey(deviceId, capabilityId))?.refCount ?? 0;
  }

  public activeSubscriptionCount(): number {
    let count = 0;
    for (const entry of this.byKey.values()) {
      if (entry.subscription) {
        count += 1;
      }
    }
    return count;
  }

  public listDiagnostics(): readonly SubscriptionDiagnostic[] {
    return [...this.byKey.values()]
      .map((entry) => ({
        deviceId: entry.deviceId,
        capabilityId: entry.capabilityId,
        refCount: entry.refCount,
        displayIds: [...entry.displayIds].sort(),
        subscribed: entry.subscription !== null,
      }))
      .sort((left, right) => {
        const byDevice = left.deviceId.localeCompare(right.deviceId);
        if (byDevice !== 0) {
          return byDevice;
        }
        return left.capabilityId.localeCompare(right.capabilityId);
      });
  }

  public async destroy(): Promise<void> {
    for (const displayId of [...this.refsByDisplay.keys()]) {
      await this.removeDisplay(displayId);
    }

    for (const [key, entry] of [...this.byKey.entries()]) {
      entry.subscription?.destroy();
      this.byKey.delete(key);
    }

    this.syncMetrics();
  }

  private async acquire(
    displayId: string,
    ref: HomeyCapabilityRef,
  ): Promise<void> {
    const key = subscriptionKey(ref.deviceId, ref.capabilityId);

    const inFlight = this.acquiringByKey.get(key);
    if (inFlight) {
      await inFlight;
    }

    let entry = this.byKey.get(key);
    if (!entry) {
      entry = {
        refCount: 0,
        displayIds: new Set(),
        subscription: null,
        deviceId: ref.deviceId,
        capabilityId: ref.capabilityId,
      };
      this.byKey.set(key, entry);
    }

    entry.displayIds.add(displayId);
    entry.refCount = entry.displayIds.size;

    if (entry.subscription) {
      return;
    }

    const acquireTask = this.createSubscription(key, ref);
    this.acquiringByKey.set(key, acquireTask);
    try {
      await acquireTask;
    } finally {
      if (this.acquiringByKey.get(key) === acquireTask) {
        this.acquiringByKey.delete(key);
      }
    }
  }

  private async createSubscription(
    key: string,
    ref: HomeyCapabilityRef,
  ): Promise<void> {
    const entry = this.byKey.get(key);
    if (!entry || entry.subscription) {
      return;
    }

    try {
      const subscription = await this.subscriber.subscribeCapability({
        deviceId: ref.deviceId,
        capabilityId: ref.capabilityId,
        onValue: (value) => {
          try {
            this.onCapabilityValue({
              deviceId: ref.deviceId,
              capabilityId: ref.capabilityId,
              value,
            });
          } catch (error) {
            this.logger.error('Realtime capability handler failed', {
              deviceId: ref.deviceId,
              capabilityId: ref.capabilityId,
              error,
            });
          }
        },
        onDestroyed: () => {
          const current = this.byKey.get(key);
          if (!current) {
            return;
          }
          current.subscription = null;
          this.onDeviceRemoved(ref.deviceId, ref.capabilityId);
          this.syncMetrics();
        },
      });

      const current = this.byKey.get(key);
      if (!current || current.refCount === 0) {
        subscription?.destroy();
        if (current && current.refCount === 0) {
          this.byKey.delete(key);
        }
        return;
      }

      if (!subscription) {
        this.logger.warn('Homey device unavailable for realtime subscription', {
          deviceId: ref.deviceId,
          capabilityId: ref.capabilityId,
        });
        this.onDeviceRemoved(ref.deviceId, ref.capabilityId);
        return;
      }

      current.subscription = subscription;
      this.logger.info('Homey capability subscribed', {
        deviceId: ref.deviceId,
        capabilityId: ref.capabilityId,
        refCount: current.refCount,
      });
    } catch (error) {
      this.logger.error('Failed to subscribe Homey capability', {
        deviceId: ref.deviceId,
        capabilityId: ref.capabilityId,
        error,
      });
      this.onDeviceRemoved(ref.deviceId, ref.capabilityId);
    }
  }

  private async release(
    displayId: string,
    ref: HomeyCapabilityRef,
  ): Promise<void> {
    const key = subscriptionKey(ref.deviceId, ref.capabilityId);
    const entry = this.byKey.get(key);
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
    this.byKey.delete(key);
    // Destroy after map removal so onDestroyed does not treat this as a Homey delete.
    subscription?.destroy();

    this.logger.info('Homey capability unsubscribed', {
      deviceId: ref.deviceId,
      capabilityId: ref.capabilityId,
    });
  }

  private syncMetrics(): void {
    this.metrics.setActiveSubscriptions(this.activeSubscriptionCount());
  }
}

function dedupeRefs(
  refs: readonly HomeyCapabilityRef[],
): readonly HomeyCapabilityRef[] {
  const keys = new Set<string>();
  const unique: HomeyCapabilityRef[] = [];
  for (const ref of refs) {
    const deviceId = ref.deviceId.trim();
    const capabilityId = ref.capabilityId.trim();
    if (!deviceId || !capabilityId) {
      continue;
    }
    const key = subscriptionKey(deviceId, capabilityId);
    if (keys.has(key)) {
      continue;
    }
    keys.add(key);
    unique.push({ deviceId, capabilityId });
  }
  return unique;
}
