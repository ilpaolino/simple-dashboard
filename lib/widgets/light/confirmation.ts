/**
 * Light dim / temperature confirmation helpers.
 *
 * Homey reports unit-interval values with two decimals; 1% UX tolerance matches.
 */

export const LIGHT_VALUE_CONFIRM_TOLERANCE_PERCENT = 1;

export type LightValueConfirmResult = 'pending' | 'confirmed' | 'mismatched';

/**
 * Confirm when Homey-reported UX percent is within tolerance of the target.
 * Unlike cover position, there is no “progress toward target” path — light
 * values typically jump to the commanded level.
 */
export function evaluateLightPercentConfirmation(options: {
  readonly targetPercent: number;
  readonly reportedPercent: number;
  readonly tolerancePercent?: number;
}): LightValueConfirmResult {
  const tolerance =
    options.tolerancePercent ?? LIGHT_VALUE_CONFIRM_TOLERANCE_PERCENT;

  if (Math.abs(options.reportedPercent - options.targetPercent) <= tolerance) {
    return 'confirmed';
  }

  return 'pending';
}

/**
 * Confirm color when both hue and saturation match within tolerance.
 */
export function evaluateLightColorConfirmation(options: {
  readonly targetHuePercent: number;
  readonly targetSaturationPercent: number;
  readonly reportedHuePercent: number | null;
  readonly reportedSaturationPercent: number | null;
  readonly tolerancePercent?: number;
}): LightValueConfirmResult {
  if (
    options.reportedHuePercent === null ||
    options.reportedSaturationPercent === null
  ) {
    return 'pending';
  }

  const hue = evaluateLightPercentConfirmation({
    targetPercent: options.targetHuePercent,
    reportedPercent: options.reportedHuePercent,
    tolerancePercent: options.tolerancePercent,
  });
  const saturation = evaluateLightPercentConfirmation({
    targetPercent: options.targetSaturationPercent,
    reportedPercent: options.reportedSaturationPercent,
    tolerancePercent: options.tolerancePercent,
  });

  if (hue === 'confirmed' && saturation === 'confirmed') {
    return 'confirmed';
  }

  return 'pending';
}
