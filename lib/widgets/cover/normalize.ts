/**
 * Official Homey `windowcoverings_set` is a number in [0, 1]:
 * 0 = closed (0%), 1 = open (100%).
 *
 * @see https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/windowcoverings_set.json
 * @see https://apps.developer.homey.app/the-basics/devices/best-practices/window-coverings
 */
export interface CoverPositionNormalization {
  /** Homey raw value when it is a finite number; otherwise null. */
  readonly rawValue: number | null;
  /**
   * Integer percent for UI: 0 = closed, 100 = open.
   * Null when the raw value is missing, non-numeric, or outside [0, 1].
   */
  readonly positionPercent: number | null;
}

/**
 * Normalize Homey `windowcoverings_set` for the dashboard frontend.
 * Frontend must never interpret Homey’s internal scale itself.
 */
export function normalizeWindowcoveringsSet(
  value: unknown,
): CoverPositionNormalization {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return { rawValue: null, positionPercent: null };
  }

  if (value < 0 || value > 1) {
    return { rawValue: value, positionPercent: null };
  }

  return {
    rawValue: value,
    positionPercent: Math.round(value * 100),
  };
}

/**
 * Convert a UX integer percent (0–100) to Homey `windowcoverings_set` [0, 1].
 * Callers must validate the percent range before invoking.
 */
export function denormalizePositionPercent(positionPercent: number): number {
  const clamped = Math.max(0, Math.min(100, Math.round(positionPercent)));
  return clamped / 100;
}

/**
 * True when `positionPercent` is an integer in [0, 100].
 */
export function isValidPositionPercent(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100
  );
}
