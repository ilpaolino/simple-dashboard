import { SHELLY_RPC_METHODS } from './rpcMethods';
import type { HardwareFeatureStatus, ShellyHardwareFeatures } from './types';

/**
 * Maps discovered RPC method names to normalized hardware features.
 * Keep all RPC → feature logic in this module.
 */
export function mapMethodsToFeatures(
  methods: readonly string[],
  discoverySucceeded: boolean,
): ShellyHardwareFeatures {
  if (!discoverySucceeded) {
    return unknownFeatures();
  }

  return {
    reboot: methodToFeatureStatus(methods, SHELLY_RPC_METHODS.REBOOT),
  };
}

export function unknownFeatures(): ShellyHardwareFeatures {
  return {
    reboot: 'unknown',
  };
}

function methodToFeatureStatus(
  methods: readonly string[],
  methodName: string,
): HardwareFeatureStatus {
  return methods.includes(methodName) ? 'supported' : 'unsupported';
}

export function featureChanges(
  previous: ShellyHardwareFeatures | null,
  next: ShellyHardwareFeatures,
): readonly { readonly feature: keyof ShellyHardwareFeatures; readonly from: HardwareFeatureStatus; readonly to: HardwareFeatureStatus }[] {
  if (!previous) {
    return [];
  }

  const changes: {
    readonly feature: keyof ShellyHardwareFeatures;
    readonly from: HardwareFeatureStatus;
    readonly to: HardwareFeatureStatus;
  }[] = [];

  for (const feature of Object.keys(next) as (keyof ShellyHardwareFeatures)[]) {
    if (previous[feature] !== next[feature]) {
      changes.push({
        feature,
        from: previous[feature],
        to: next[feature],
      });
    }
  }

  return changes;
}
