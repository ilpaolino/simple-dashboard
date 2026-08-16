/**
 * Homey light capability normalization.
 *
 * Official Homey ranges (all numbers in [0, 1]):
 * - `dim` — brightness; Flow UI multiplies by 100 for percent labels
 * - `light_temperature` — higher value = warmer color
 * - `light_hue` — hue circle; Flow UI multiplies by 360 for degrees
 * - `light_saturation` — Flow UI multiplies by 100 for percent
 *
 * Frontend always receives integer UX percents 0…100. The browser never
 * interprets Homey’s [0, 1] scale itself.
 *
 * @see https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/dim.json
 * @see https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/light_temperature.json
 * @see https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/light_hue.json
 * @see https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/light_saturation.json
 * @see https://apps.developer.homey.app/the-basics/devices/best-practices/lights
 */

export interface HomeyUnitNormalization {
  /** Homey raw value when it is a finite number; otherwise null. */
  readonly rawValue: number | null;
  /**
   * Integer percent for UI (0…100).
   * Null when the raw value is missing, non-numeric, or outside [0, 1].
   */
  readonly percent: number | null;
}

/**
 * Normalize a Homey unit-interval capability (`dim`, `light_*`) to UX percent.
 */
export function normalizeHomeyUnitInterval(
  value: unknown,
): HomeyUnitNormalization {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { rawValue: null, percent: null };
  }

  if (value < 0 || value > 1) {
    return { rawValue: value, percent: null };
  }

  return {
    rawValue: value,
    percent: Math.round(value * 100),
  };
}

/**
 * Convert a UX integer percent (0–100) to Homey [0, 1].
 * Callers must validate the percent range before invoking.
 */
export function denormalizePercentToHomey(percent: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return clamped / 100;
}

/**
 * True when `value` is an integer in [0, 100].
 */
export function isValidPercent(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100
  );
}

/**
 * Encode hue+saturation UX percents for pending confirmation bookkeeping.
 */
export function encodeLightColorExpected(
  huePercent: number,
  saturationPercent: number,
): string {
  return `${huePercent}:${saturationPercent}`;
}

/**
 * Decode a pending color expected value. Returns null when malformed.
 */
export function decodeLightColorExpected(
  value: unknown,
): { readonly huePercent: number; readonly saturationPercent: number } | null {
  if (typeof value !== 'string') {
    return null;
  }
  const parts = value.split(':');
  if (parts.length !== 2) {
    return null;
  }
  const huePercent = Number(parts[0]);
  const saturationPercent = Number(parts[1]);
  if (!isValidPercent(huePercent) || !isValidPercent(saturationPercent)) {
    return null;
  }
  return { huePercent, saturationPercent };
}
