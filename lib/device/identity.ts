import { randomUUID } from 'node:crypto';
import type { DetectedDeviceInfo } from '../adapters/types';

/**
 * Device identity is a stable unique id, never the IP address.
 * @see https://apps.developer.homey.app/the-basics/devices/pairing
 */
export function resolveDeviceId(
  info: DetectedDeviceInfo | undefined,
  createId: () => string = randomUUID,
): string {
  const uniqueId = info?.uniqueId?.trim();
  if (uniqueId) {
    return uniqueId;
  }

  const serial = info?.serial?.trim();
  if (serial) {
    return serial;
  }

  return createId();
}
