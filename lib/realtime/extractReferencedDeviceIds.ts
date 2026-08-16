import type { DashboardConfiguration } from '../widgets/types';
import { COVER_CAPABILITY_ID } from '../widgets/cover/compatibility';
import { LIGHT_CAPABILITY_ID } from '../widgets/light/compatibility';

/**
 * A Homey capability subscription required by the dashboard.
 * LightWidget → onoff; CoverWidget → windowcoverings_set.
 */
export interface HomeyCapabilityRef {
  readonly deviceId: string;
  readonly capabilityId: string;
}

/**
 * Capability subscriptions referenced by Homey-bound widgets.
 * Only these (deviceId, capabilityId) pairs participate in realtime.
 */
export function extractReferencedCapabilitySubscriptions(
  configuration: DashboardConfiguration,
): readonly HomeyCapabilityRef[] {
  const keys = new Set<string>();
  const refs: HomeyCapabilityRef[] = [];

  for (const widget of configuration.widgets) {
    if (widget.type === 'light') {
      const deviceId = widget.config.deviceId.trim();
      if (deviceId.length === 0) {
        continue;
      }
      const key = subscriptionKey(deviceId, LIGHT_CAPABILITY_ID);
      if (!keys.has(key)) {
        keys.add(key);
        refs.push({ deviceId, capabilityId: LIGHT_CAPABILITY_ID });
      }
      continue;
    }

    if (widget.type === 'cover') {
      const deviceId = widget.config.deviceId.trim();
      if (deviceId.length === 0) {
        continue;
      }
      const key = subscriptionKey(deviceId, COVER_CAPABILITY_ID);
      if (!keys.has(key)) {
        keys.add(key);
        refs.push({ deviceId, capabilityId: COVER_CAPABILITY_ID });
      }
    }
  }

  refs.sort((left, right) => {
    const byDevice = left.deviceId.localeCompare(right.deviceId);
    if (byDevice !== 0) {
      return byDevice;
    }
    return left.capabilityId.localeCompare(right.capabilityId);
  });

  return refs;
}

/**
 * Unique Homey device ids referenced by LightWidget / CoverWidget.
 */
export function extractReferencedDeviceIds(
  configuration: DashboardConfiguration,
): readonly string[] {
  const ids = new Set(
    extractReferencedCapabilitySubscriptions(configuration).map(
      (ref) => ref.deviceId,
    ),
  );
  return [...ids].sort();
}

/**
 * Diff old vs new referenced capability subscriptions.
 */
export function diffReferencedCapabilitySubscriptions(
  previous: readonly HomeyCapabilityRef[],
  next: readonly HomeyCapabilityRef[],
): {
  readonly added: readonly HomeyCapabilityRef[];
  readonly removed: readonly HomeyCapabilityRef[];
  readonly unchanged: readonly HomeyCapabilityRef[];
} {
  const previousKeys = new Map(
    previous.map((ref) => [subscriptionKey(ref.deviceId, ref.capabilityId), ref]),
  );
  const nextKeys = new Map(
    next.map((ref) => [subscriptionKey(ref.deviceId, ref.capabilityId), ref]),
  );

  const added: HomeyCapabilityRef[] = [];
  const removed: HomeyCapabilityRef[] = [];
  const unchanged: HomeyCapabilityRef[] = [];

  for (const [key, ref] of nextKeys) {
    if (previousKeys.has(key)) {
      unchanged.push(ref);
    } else {
      added.push(ref);
    }
  }

  for (const [key, ref] of previousKeys) {
    if (!nextKeys.has(key)) {
      removed.push(ref);
    }
  }

  const byKey = (left: HomeyCapabilityRef, right: HomeyCapabilityRef): number =>
    subscriptionKey(left.deviceId, left.capabilityId).localeCompare(
      subscriptionKey(right.deviceId, right.capabilityId),
    );

  added.sort(byKey);
  removed.sort(byKey);
  unchanged.sort(byKey);

  return { added, removed, unchanged };
}

/**
 * Diff old vs new referenced devices for selective subscribe/unsubscribe.
 * @deprecated Prefer {@link diffReferencedCapabilitySubscriptions}.
 */
export function diffReferencedDeviceIds(
  previous: readonly string[],
  next: readonly string[],
): {
  readonly added: readonly string[];
  readonly removed: readonly string[];
  readonly unchanged: readonly string[];
} {
  const previousSet = new Set(previous);
  const nextSet = new Set(next);

  const added: string[] = [];
  const removed: string[] = [];
  const unchanged: string[] = [];

  for (const id of nextSet) {
    if (previousSet.has(id)) {
      unchanged.push(id);
    } else {
      added.push(id);
    }
  }

  for (const id of previousSet) {
    if (!nextSet.has(id)) {
      removed.push(id);
    }
  }

  added.sort();
  removed.sort();
  unchanged.sort();

  return { added, removed, unchanged };
}

export function subscriptionKey(
  deviceId: string,
  capabilityId: string,
): string {
  return `${deviceId}\u0000${capabilityId}`;
}
