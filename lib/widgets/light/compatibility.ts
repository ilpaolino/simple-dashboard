export const LIGHT_CAPABILITY_ID = 'onoff';

export interface LightCompatibilityInput {
  readonly capabilities: readonly string[];
}

/**
 * Milestone 5: a device is LightWidget-compatible when it exposes `onoff`.
 * Dim / color / temperature are intentionally not required yet.
 */
export function isCompatibleWithLightWidget(
  device: LightCompatibilityInput,
): boolean {
  return device.capabilities.includes(LIGHT_CAPABILITY_ID);
}

export function hasOnoffCapability(device: LightCompatibilityInput): boolean {
  return isCompatibleWithLightWidget(device);
}
