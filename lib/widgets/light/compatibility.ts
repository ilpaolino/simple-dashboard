/**
 * Official Homey light capabilities used by LightWidget.
 *
 * Compatibility for the editor still requires only `onoff`. Advanced controls
 * are capability-driven at runtime and never configured manually.
 *
 * @see https://apps.developer.homey.app/the-basics/devices/best-practices/lights
 * @see https://apps.developer.homey.app/the-basics/devices/capabilities
 */

export const LIGHT_CAPABILITY_ID = 'onoff' as const;
export const LIGHT_DIM_CAPABILITY_ID = 'dim' as const;
export const LIGHT_TEMPERATURE_CAPABILITY_ID = 'light_temperature' as const;
export const LIGHT_HUE_CAPABILITY_ID = 'light_hue' as const;
export const LIGHT_SATURATION_CAPABILITY_ID = 'light_saturation' as const;
export const LIGHT_MODE_CAPABILITY_ID = 'light_mode' as const;

/** Homey `light_mode` enum values. */
export type LightModeValue = 'color' | 'temperature';

export const LIGHT_MODE_COLOR = 'color' as const;
export const LIGHT_MODE_TEMPERATURE = 'temperature' as const;

/**
 * Optional Homey capabilities that LightWidget may subscribe to when present.
 */
export const LIGHT_OPTIONAL_CAPABILITY_IDS = [
  LIGHT_DIM_CAPABILITY_ID,
  LIGHT_TEMPERATURE_CAPABILITY_ID,
  LIGHT_HUE_CAPABILITY_ID,
  LIGHT_SATURATION_CAPABILITY_ID,
  LIGHT_MODE_CAPABILITY_ID,
] as const;

export type LightOptionalCapabilityId =
  (typeof LIGHT_OPTIONAL_CAPABILITY_IDS)[number];

export interface LightCompatibilityInput {
  readonly capabilities: readonly string[];
}

/**
 * Backend-owned capability flags for the frontend.
 * The browser must not parse Homey capability ids itself.
 */
export interface LightWidgetCapabilities {
  readonly canToggle: boolean;
  readonly canDim: boolean;
  readonly canSetTemperature: boolean;
  /** True only when both `light_hue` and `light_saturation` are present. */
  readonly canSetColor: boolean;
}

export const EMPTY_LIGHT_CAPABILITIES: LightWidgetCapabilities = {
  canToggle: false,
  canDim: false,
  canSetTemperature: false,
  canSetColor: false,
};

/**
 * A device is LightWidget-compatible when it exposes official `onoff`.
 * Dim / color / temperature are optional and detected at runtime.
 */
export function isCompatibleWithLightWidget(
  device: LightCompatibilityInput,
): boolean {
  return device.capabilities.includes(LIGHT_CAPABILITY_ID);
}

export function hasOnoffCapability(device: LightCompatibilityInput): boolean {
  return isCompatibleWithLightWidget(device);
}

export function hasDimCapability(device: LightCompatibilityInput): boolean {
  return device.capabilities.includes(LIGHT_DIM_CAPABILITY_ID);
}

export function hasLightTemperatureCapability(
  device: LightCompatibilityInput,
): boolean {
  return device.capabilities.includes(LIGHT_TEMPERATURE_CAPABILITY_ID);
}

export function hasLightHueCapability(
  device: LightCompatibilityInput,
): boolean {
  return device.capabilities.includes(LIGHT_HUE_CAPABILITY_ID);
}

export function hasLightSaturationCapability(
  device: LightCompatibilityInput,
): boolean {
  return device.capabilities.includes(LIGHT_SATURATION_CAPABILITY_ID);
}

export function hasLightModeCapability(
  device: LightCompatibilityInput,
): boolean {
  return device.capabilities.includes(LIGHT_MODE_CAPABILITY_ID);
}

/**
 * Color control requires both hue and saturation (Homey color UI component).
 */
export function hasLightColorCapabilities(
  device: LightCompatibilityInput,
): boolean {
  return hasLightHueCapability(device) && hasLightSaturationCapability(device);
}

/**
 * Resolve runtime capability flags. Unavailable / missing onoff → no controls.
 */
export function resolveLightWidgetCapabilities(
  device: LightCompatibilityInput | null,
  available: boolean,
): LightWidgetCapabilities {
  if (!device || !available || !hasOnoffCapability(device)) {
    return EMPTY_LIGHT_CAPABILITIES;
  }

  return {
    canToggle: true,
    canDim: hasDimCapability(device),
    canSetTemperature: hasLightTemperatureCapability(device),
    canSetColor: hasLightColorCapabilities(device),
  };
}

/**
 * Optional light capability ids present on the device (for selective subscribe).
 */
export function listPresentLightOptionalCapabilities(
  device: LightCompatibilityInput,
): readonly LightOptionalCapabilityId[] {
  return LIGHT_OPTIONAL_CAPABILITY_IDS.filter((id) =>
    device.capabilities.includes(id),
  );
}

export function isLightModeValue(value: unknown): value is LightModeValue {
  return value === LIGHT_MODE_COLOR || value === LIGHT_MODE_TEMPERATURE;
}
