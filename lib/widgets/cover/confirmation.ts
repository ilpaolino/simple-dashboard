/**
 * Cover set-position confirmation helpers.
 *
 * Confirmation means Homey has acknowledged the command via realtime — either
 * the reported percent is within tolerance of the target, or Homey has emitted
 * a first coherent progress value toward the target. The pending window is NOT
 * the full physical travel time of the shutter.
 */

/**
 * Cover position confirmation tolerance in UX percent points.
 * Homey reports [0,1] with two decimals; 1% matches that resolution.
 */
export const COVER_POSITION_CONFIRM_TOLERANCE_PERCENT = 1;

export type CoverPositionConfirmResult =
  | 'pending'
  | 'confirmed'
  | 'mismatched';

/**
 * Evaluate a Homey-reported cover percent against a pending set-position intent.
 */
export function evaluateCoverPositionConfirmation(options: {
  readonly targetPercent: number;
  readonly baselinePercent: number | null;
  readonly reportedPercent: number;
  readonly tolerancePercent?: number;
}): CoverPositionConfirmResult {
  const tolerance =
    options.tolerancePercent ?? COVER_POSITION_CONFIRM_TOLERANCE_PERCENT;
  const { targetPercent, baselinePercent, reportedPercent } = options;

  if (Math.abs(reportedPercent - targetPercent) <= tolerance) {
    return 'confirmed';
  }

  if (baselinePercent === null) {
    return 'pending';
  }

  if (Math.abs(baselinePercent - targetPercent) <= tolerance) {
    // Already at target when the command was issued — wait for near-target report.
    return 'pending';
  }

  const towardOpen = targetPercent > baselinePercent;
  if (towardOpen && reportedPercent > baselinePercent + Number.EPSILON) {
    return 'confirmed';
  }
  if (!towardOpen && reportedPercent < baselinePercent - Number.EPSILON) {
    return 'confirmed';
  }

  // Moved away from the intended direction — another actor likely intervened.
  if (towardOpen && reportedPercent < baselinePercent - tolerance) {
    return 'mismatched';
  }
  if (!towardOpen && reportedPercent > baselinePercent + tolerance) {
    return 'mismatched';
  }

  return 'pending';
}
