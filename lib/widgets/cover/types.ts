export interface CoverWidgetConfig {
  readonly deviceId: string;
}

export type CoverVisualState = 'available' | 'unavailable';

export type CoverRuntimeError =
  | 'missing_device'
  | 'missing_capability'
  | 'invalid_value'
  | 'unavailable'
  | 'api_error';

/**
 * Runtime snapshot for a CoverWidget. Distinct from persisted config (`deviceId` only).
 * `positionPercent` is always UX-normalized: 0 = closed, 100 = open.
 */
export interface CoverWidgetRuntimeState {
  readonly type: 'cover';
  readonly deviceId: string;
  readonly name: string;
  readonly available: boolean;
  readonly positionPercent: number | null;
  readonly error: CoverRuntimeError | null;
}

export interface CoverWidgetDiagnostic {
  readonly widgetId: string;
  readonly deviceId: string;
  readonly resolved: boolean;
  readonly hasWindowcoveringsSet: boolean;
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
