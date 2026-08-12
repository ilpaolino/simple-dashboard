import { isLayoutId } from './configuration';
import { parseWallDisplayStore } from './types';
import { parseIpv4 } from '../ip/ipv4';
import {
  DISPLAY_TYPE_IDS,
  type DisplaySnapshot,
  type DisplayTypeId,
} from '../display/types';
import type { SettingsValue } from './settingsValidation';

export interface HomeyDeviceLike {
  getData(): unknown;
  getName(): string;
  getSettings(): unknown;
  getStore(): unknown;
}

/**
 * Builds a runtime snapshot from Homey device APIs plus optional pending settings
 * (used from Device#onSettings before Homey persists them).
 */
export function buildDisplaySnapshot(options: {
  readonly device: HomeyDeviceLike;
  readonly typeId: DisplayTypeId;
  readonly pendingSettings?: Readonly<Record<string, SettingsValue>>;
  readonly pendingStore?: unknown;
}): DisplaySnapshot | null {
  const data = options.device.getData();
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const dataRecord = data as Record<string, unknown>;
  if (typeof dataRecord.id !== 'string' || dataRecord.id.trim() === '') {
    return null;
  }

  const currentSettings = options.device.getSettings();
  const settings =
    typeof currentSettings === 'object' && currentSettings !== null
      ? {
          ...(currentSettings as Record<string, unknown>),
          ...(options.pendingSettings ?? {}),
        }
      : { ...(options.pendingSettings ?? {}) };

  let ipAddress: string;
  try {
    ipAddress = parseIpv4(settings.ip);
  } catch {
    return null;
  }

  const store = parseWallDisplayStore(
    options.pendingStore ?? options.device.getStore(),
  );
  const layoutFromSettings = settings.layout;
  const layoutId =
    typeof layoutFromSettings === 'string' && isLayoutId(layoutFromSettings)
      ? layoutFromSettings
      : store?.configuration.layoutId;

  if (!layoutId) {
    return null;
  }

  const hardwareId =
    options.typeId === DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY
      ? dataRecord.id
      : null;

  return {
    displayId: dataRecord.id,
    name: options.device.getName(),
    typeId: options.typeId,
    ipAddress,
    hardwareId,
    layoutId,
  };
}
