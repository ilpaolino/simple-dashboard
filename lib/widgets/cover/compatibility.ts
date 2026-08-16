export const COVER_CAPABILITY_ID = 'windowcoverings_set';

/**
 * Official Homey capability for up / idle / down (stop = idle).
 * @see https://apps.developer.homey.app/the-basics/devices/best-practices/window-coverings
 * @see https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/windowcoverings_state.json
 */
export const COVER_STATE_CAPABILITY_ID = 'windowcoverings_state';

/** Homey enum value that stops window covering movement. */
export const COVER_STOP_STATE_VALUE = 'idle' as const;

export type CoverWindowcoveringsState = 'up' | 'idle' | 'down';

export interface CoverCompatibilityInput {
  readonly capabilities: readonly string[];
}

export interface CoverWidgetCapabilities {
  readonly canSetPosition: boolean;
  readonly canStop: boolean;
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

/**
 * Stop is exposed only when Homey documents `windowcoverings_state` on the device.
 * Never emulate stop by rewriting the current position.
 */
export function hasWindowcoveringsStateCapability(
  device: CoverCompatibilityInput,
): boolean {
  return device.capabilities.includes(COVER_STATE_CAPABILITY_ID);
}

/**
 * Backend-owned capability flags for the frontend. The browser must not parse
 * Homey capability ids itself.
 */
export function resolveCoverWidgetCapabilities(
  device: CoverCompatibilityInput | null,
  available: boolean,
): CoverWidgetCapabilities {
  if (!device || !available) {
    return { canSetPosition: false, canStop: false };
  }

  const canSetPosition = hasWindowcoveringsSetCapability(device);
  return {
    canSetPosition,
    canStop: canSetPosition && hasWindowcoveringsStateCapability(device),
  };
}

export function isCoverWindowcoveringsState(
  value: unknown,
): value is CoverWindowcoveringsState {
  return value === 'up' || value === 'idle' || value === 'down';
}
