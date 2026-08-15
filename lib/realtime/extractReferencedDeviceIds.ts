import type { DashboardConfiguration } from '../widgets/types';

/**
 * Device ids referenced by LightWidget (and future Homey-bound widgets).
 * Only these ids participate in Homey realtime subscriptions.
 */
export function extractReferencedDeviceIds(
  configuration: DashboardConfiguration,
): readonly string[] {
  const ids = new Set<string>();

  for (const widget of configuration.widgets) {
    if (widget.type === 'light') {
      const deviceId = widget.config.deviceId.trim();
      if (deviceId.length > 0) {
        ids.add(deviceId);
      }
    }
  }

  return [...ids].sort();
}

/**
 * Diff old vs new referenced devices for selective subscribe/unsubscribe.
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
