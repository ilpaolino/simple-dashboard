import type { DetectedDeviceInfo, DeviceConfiguration, WallDisplayAdapter } from '../adapters/types';
import { resolveDeviceId } from './identity';
import type { HomeyPairingDevice } from './types';

export interface PairingDeviceInput {
  readonly ip: string;
  readonly adapter: WallDisplayAdapter;
  readonly adapterName: string;
  readonly adapterAutoDetected: boolean;
  readonly info?: DetectedDeviceInfo;
  readonly notAvailable: string;
  readonly defaultName: string;
  readonly createId?: () => string;
}

/**
 * Builds the object passed to Homey.createDevice during pairing.
 * `data.id` is the immutable identity; IP lives in settings.
 * @see https://apps.developer.homey.app/advanced/custom-views/custom-pairing-views
 */
export function buildPairingDevice(input: PairingDeviceInput): HomeyPairingDevice {
  const configuration: DeviceConfiguration = input.adapter.createInitialConfiguration();
  const id = resolveDeviceId(input.info, input.createId);
  const name = input.info?.name?.trim() || input.defaultName;

  return {
    name,
    data: { id },
    store: {
      adapterId: input.adapter.id,
      adapterAutoDetected: input.adapterAutoDetected,
      configuration,
    },
    settings: {
      ip: input.ip,
      adapter: input.adapterName,
      layout: configuration.layoutId,
      manufacturer: input.info?.manufacturer?.trim() || input.notAvailable,
      model: input.info?.model?.trim() || input.notAvailable,
      firmware: input.info?.firmware?.trim() || input.notAvailable,
      serial: input.info?.serial?.trim() || input.info?.uniqueId?.trim() || input.notAvailable,
    },
  };
}
