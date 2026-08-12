import type { AdapterId, DetectedDeviceInfo, DeviceConfiguration, LayoutId } from '../adapters/types';
import { isDeviceConfiguration } from './configuration';

export interface WallDisplayData {
  readonly id: string;
}

export interface WallDisplaySettings {
  readonly ip: string;
  readonly adapter: string;
  readonly layout: LayoutId;
  readonly manufacturer: string;
  readonly model: string;
  readonly firmware: string;
  readonly serial: string;
}

export interface WallDisplayStore {
  readonly adapterId: AdapterId;
  readonly adapterAutoDetected: boolean;
  readonly configuration: DeviceConfiguration;
}

export interface HomeyPairingDevice {
  readonly name: string;
  readonly data: WallDisplayData;
  readonly store: WallDisplayStore;
  readonly settings: WallDisplaySettings;
}

export interface PairingDetectedInfoView {
  readonly manufacturer: string;
  readonly model: string;
  readonly firmware: string;
  readonly serial: string;
  readonly adapterName: string;
}

export interface AdapterChoice {
  readonly id: AdapterId;
  readonly name: string;
}

export function isAdapterId(value: unknown): value is AdapterId {
  return value === 'shelly_wall_display' || value === 'generic_web_display';
}

export function parseWallDisplayStore(value: unknown): WallDisplayStore | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (!isAdapterId(candidate.adapterId)) {
    return null;
  }

  if (typeof candidate.adapterAutoDetected !== 'boolean') {
    return null;
  }

  if (!isDeviceConfiguration(candidate.configuration)) {
    return null;
  }

  return {
    adapterId: candidate.adapterId,
    adapterAutoDetected: candidate.adapterAutoDetected,
    configuration: candidate.configuration,
  };
}

export function toDetectedInfoView(
  info: DetectedDeviceInfo | undefined,
  adapterName: string,
  notAvailable: string,
): PairingDetectedInfoView {
  return {
    manufacturer: info?.manufacturer?.trim() || notAvailable,
    model: info?.model?.trim() || notAvailable,
    firmware: info?.firmware?.trim() || notAvailable,
    serial: info?.serial?.trim() || info?.uniqueId?.trim() || notAvailable,
    adapterName,
  };
}
