import { isLayoutId } from './configuration';
import { parseWallDisplayStore } from './types';
import { parseIpv4 } from '../ip/ipv4';
import {
  DISPLAY_TYPE_IDS,
  type DisplaySnapshot,
  type DisplayTypeId,
} from '../display/types';
import {
  emptyDashboardConfiguration,
  parseDashboardConfiguration,
  type DashboardConfiguration,
} from '../widgets';
import type { SettingsValue } from './settingsValidation';

/** Homey Device Store key for per-display widget configuration. */
export const DASHBOARD_STORE_KEY = 'dashboard';

export interface HomeyDeviceLike {
  getData(): unknown;
  getName(): string;
  getSettings(): unknown;
  getStore(): unknown;
  getStoreValue?(key: string): unknown;
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
  readonly pendingDashboard?: DashboardConfiguration;
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

  const dashboard =
    options.pendingDashboard ??
    readDashboardFromDevice(options.device);

  return {
    displayId: dataRecord.id,
    name: options.device.getName(),
    typeId: options.typeId,
    ipAddress,
    hardwareId,
    layoutId,
    dashboard,
  };
}

export function readDashboardFromDevice(
  device: HomeyDeviceLike,
): DashboardConfiguration {
  const raw =
    typeof device.getStoreValue === 'function'
      ? device.getStoreValue(DASHBOARD_STORE_KEY)
      : readStoreKey(device.getStore(), DASHBOARD_STORE_KEY);

  const parsed = parseDashboardConfiguration(raw);
  if (!parsed.ok) {
    return emptyDashboardConfiguration();
  }
  return parsed.configuration;
}

function readStoreKey(store: unknown, key: string): unknown {
  if (typeof store !== 'object' || store === null) {
    return undefined;
  }
  return (store as Record<string, unknown>)[key];
}
