export const COVER_CAPABILITY_ID = 'windowcoverings_set';

export interface CoverCompatibilityInput {
  readonly capabilities: readonly string[];
}

/**
 * A device is CoverWidget-compatible when it exposes official `windowcoverings_set`.
 * @see https://apps.developer.homey.app/the-basics/devices/best-practices/window-coverings
 */
export function isCompatibleWithCoverWidget(
  device: CoverCompatibilityInput,
): boolean {
  return device.capabilities.includes(COVER_CAPABILITY_ID);
}

export function hasWindowcoveringsSetCapability(
  device: CoverCompatibilityInput,
): boolean {
  return isCompatibleWithCoverWidget(device);
}
