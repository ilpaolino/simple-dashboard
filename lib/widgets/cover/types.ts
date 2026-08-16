import type { CoverWidgetCapabilities } from './compatibility';

export interface CoverWidgetConfig {
  readonly deviceId: string;
  /**
   * Optional tile/panel label. When omitted or blank, the Homey device name is used.
   */
  readonly title?: string;
}

export const COVER_TITLE_MAX_LENGTH = 40;

export type CoverVisualState = 'available' | 'unavailable';

export type CoverRuntimeError =
  | 'missing_device'
  | 'missing_capability'
  | 'invalid_value'
  | 'unavailable'
  | 'api_error';

/**
 * Runtime snapshot for a CoverWidget. Distinct from persisted config.
 * `positionPercent` is always UX-normalized: 0 = closed, 100 = open.
 * `name` is the display label (custom title override or Homey device name).
 * Capability flags are backend-derived — the frontend never inspects Homey raw ids.
 */
export interface CoverWidgetRuntimeState {
  readonly type: 'cover';
  readonly deviceId: string;
  readonly name: string;
  readonly available: boolean;
  readonly positionPercent: number | null;
  readonly capabilities: CoverWidgetCapabilities;
  readonly error: CoverRuntimeError | null;
}

export interface CoverWidgetDiagnostic {
  readonly widgetId: string;
  readonly deviceId: string;
  readonly resolved: boolean;
  readonly hasWindowcoveringsSet: boolean;
  readonly hasWindowcoveringsState: boolean;
  readonly canStop: boolean;
  readonly available: boolean;
  /** Raw Homey `windowcoverings_set` value in [0, 1], when readable. */
  readonly rawValue: number | null;
  /** Normalized integer percent for UI (0 closed … 100 open). */
  readonly positionPercent: number | null;
  readonly error: CoverRuntimeError | null;
}

export type CoverBindingError =
  | 'device_missing'
  | 'device_not_compatible'
  | 'missing_windowcoverings_set'
  | 'device_api_error';

/**
 * Normalize an optional custom title for persistence.
 * Returns `undefined` when blank so configs stay minimal.
 */
export function normalizeCoverTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().slice(0, COVER_TITLE_MAX_LENGTH);
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Display name for tile and control panel.
 * Custom title wins when present; otherwise Homey device name.
 */
export function resolveCoverDisplayName(
  title: string | undefined,
  deviceName: string,
): string {
  const custom = title?.trim();
  if (custom && custom.length > 0) {
    return custom;
  }
  return deviceName;
}
