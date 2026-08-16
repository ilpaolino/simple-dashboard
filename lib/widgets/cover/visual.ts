import type { CoverVisualState, CoverWidgetRuntimeState } from './types';

export function resolveCoverVisualState(
  runtime: CoverWidgetRuntimeState | undefined,
): CoverVisualState {
  if (
    !runtime ||
    !runtime.available ||
    runtime.positionPercent === null ||
    runtime.error !== null
  ) {
    return 'unavailable';
  }

  return 'available';
}

export function coverVisualStateClass(state: CoverVisualState): string {
  return `widget-cover--state-${state}`;
}

/**
 * Integer percent string for UI (e.g. "62%"). Returns null when unavailable.
 */
export function formatCoverPositionPercent(
  positionPercent: number | null,
): string | null {
  if (
    positionPercent === null ||
    !Number.isFinite(positionPercent) ||
    positionPercent < 0 ||
    positionPercent > 100
  ) {
    return null;
  }

  return `${Math.round(positionPercent)}%`;
}
