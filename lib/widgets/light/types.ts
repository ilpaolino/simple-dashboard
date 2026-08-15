export interface LightWidgetConfig {
  readonly deviceId: string;
}

export type LightVisualState = 'on' | 'off' | 'unavailable';

export type LightRuntimeError =
  | 'missing_device'
  | 'missing_capability'
  | 'invalid_value'
  | 'unavailable'
  | 'api_error';

/**
 * Runtime snapshot for a LightWidget. Distinct from persisted config (`deviceId` only).
 */
export interface LightWidgetRuntimeState {
  readonly type: 'light';
  readonly deviceId: string;
  readonly name: string;
  readonly available: boolean;
  readonly on: boolean | null;
  readonly error: LightRuntimeError | null;
}

export interface LightWidgetDiagnostic {
  readonly widgetId: string;
  readonly deviceId: string;
  readonly resolved: boolean;
  readonly hasOnoff: boolean;
  readonly available: boolean;
  readonly on: boolean | null;
  readonly error: LightRuntimeError | null;
}

export type LightBindingError =
  | 'device_missing'
  | 'device_not_compatible'
  | 'missing_onoff'
  | 'device_api_error';
