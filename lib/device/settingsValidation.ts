import { parseIpv4 } from '../ip/ipv4';
import {
  isLayoutId,
  isLayoutSupported,
  withExpandedSupportedLayouts,
  withLayout,
} from './configuration';
import {
  canonicalLayoutIdsForAdapter,
  type DeviceConfiguration,
} from '../adapters/types';
import type { WallDisplayStore } from './types';

export type SettingsValue = boolean | string | number | undefined | null;

export interface SettingsChangeInput {
  readonly changedKeys: readonly string[];
  readonly newSettings: Readonly<Record<string, SettingsValue>>;
  readonly store: WallDisplayStore | null;
  /** When set, rejects IP changes that collide with another display. */
  readonly isIpTaken?: (ip: string) => boolean;
}

export type SettingsChangeResult =
  | { readonly ok: true; readonly updatedConfiguration?: DeviceConfiguration }
  | { readonly ok: false; readonly errorKey: string };

/**
 * Pure validation for Homey Device#onSettings.
 * Throws are left to the Device so messages can be localized with Homey.__.
 * @see https://apps.developer.homey.app/the-basics/devices/settings
 */
export function validateDeviceSettingsChange(
  input: SettingsChangeInput,
): SettingsChangeResult {
  if (input.changedKeys.includes('ip')) {
    try {
      const ip = parseIpv4(input.newSettings.ip);
      if (input.isIpTaken?.(ip)) {
        return { ok: false, errorKey: 'errors.pairingIpTaken' };
      }
    } catch {
      return { ok: false, errorKey: 'errors.invalidIp' };
    }
  }

  if (input.changedKeys.includes('adapter')) {
    return { ok: false, errorKey: 'errors.adapterReadOnly' };
  }

  if (!input.changedKeys.includes('layout')) {
    return { ok: true };
  }

  if (!input.store) {
    return { ok: false, errorKey: 'errors.invalidConfiguration' };
  }

  const layout = input.newSettings.layout;
  if (typeof layout !== 'string' || !isLayoutId(layout)) {
    return { ok: false, errorKey: 'errors.unsupportedLayout' };
  }

  const expanded = withExpandedSupportedLayouts(
    input.store.configuration,
    canonicalLayoutIdsForAdapter(input.store.adapterId),
  );

  if (!isLayoutSupported(expanded, layout)) {
    return { ok: false, errorKey: 'errors.unsupportedLayout' };
  }

  return {
    ok: true,
    updatedConfiguration: withLayout(expanded, layout),
  };
}
