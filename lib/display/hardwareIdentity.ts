import type { DetectedDeviceInfo } from '../adapters/types';
import type { WallDisplayAdapter } from '../adapters/types';

export type HardwareIdentityResult =
  | { readonly kind: 'match'; readonly info: DetectedDeviceInfo }
  | { readonly kind: 'mismatch'; readonly expectedId: string; readonly actualId: string }
  | { readonly kind: 'unavailable' };

/**
 * When a driver stores a hardware id, verify the device currently at `ip`
 * still reports that identity. Generic displays skip this (no hardware id).
 */
export async function verifyHardwareIdentity(options: {
  readonly adapter: WallDisplayAdapter;
  readonly ipAddress: string;
  readonly expectedHardwareId: string | null;
}): Promise<HardwareIdentityResult> {
  if (!options.expectedHardwareId) {
    return { kind: 'unavailable' };
  }

  const info = await options.adapter.tryIdentify(options.ipAddress);
  if (!info) {
    return { kind: 'unavailable' };
  }

  const actualId = info.uniqueId?.trim() || info.serial?.trim() || '';
  if (!actualId) {
    return { kind: 'unavailable' };
  }

  if (actualId !== options.expectedHardwareId) {
    return {
      kind: 'mismatch',
      expectedId: options.expectedHardwareId,
      actualId,
    };
  }

  return { kind: 'match', info };
}
