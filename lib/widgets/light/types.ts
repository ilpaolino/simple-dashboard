import type { LightWidgetCapabilities } from './compatibility';
import { EMPTY_LIGHT_CAPABILITIES } from './compatibility';

export interface LightWidgetConfig {
  readonly deviceId: string;
  /**
   * Optional tile/panel label. When omitted or blank, the Homey device name is used.
   */
  readonly title?: string;
}

export const LIGHT_TITLE_MAX_LENGTH = 40;

export type LightVisualState = 'on' | 'off' | 'unavailable';

export type LightRuntimeError =
  | 'missing_device'
  | 'missing_capability'
  | 'invalid_value'
  | 'unavailable'
  | 'api_error';

/**
 * Runtime snapshot for a LightWidget. Distinct from persisted config (`deviceId` only).
 *
 * Normalized UX fields (backend-owned):
 * - `dimPercent` 0…100 brightness
 * - `temperaturePercent` 0 = cool … 100 = warm (matches Homey higher = warmer)
 * - `huePercent` / `saturationPercent` 0…100 for the color picker
 *
 * `name` is the display label (custom title override or Homey device name).
 * Capability flags are backend-derived — the frontend never inspects Homey raw ids.
 */
export interface LightWidgetRuntimeState {
  readonly type: 'light';
  readonly deviceId: string;
  readonly name: string;
  readonly available: boolean;
  readonly on: boolean | null;
  readonly dimPercent: number | null;
  readonly temperaturePercent: number | null;
  readonly huePercent: number | null;
  readonly saturationPercent: number | null;
  readonly capabilities: LightWidgetCapabilities;
  readonly error: LightRuntimeError | null;
}

export interface LightWidgetDiagnostic {
  readonly widgetId: string;
  readonly deviceId: string;
  readonly resolved: boolean;
  readonly hasOnoff: boolean;
  readonly canDim: boolean;
  readonly canSetTemperature: boolean;
  readonly canSetColor: boolean;
  readonly available: boolean;
  readonly on: boolean | null;
  readonly dimPercent: number | null;
  readonly temperaturePercent: number | null;
  readonly huePercent: number | null;
  readonly saturationPercent: number | null;
  readonly error: LightRuntimeError | null;
}

export type LightBindingError =
  | 'device_missing'
  | 'device_not_compatible'
  | 'missing_onoff'
  | 'device_api_error';

/**
 * Normalize an optional custom title for persistence.
 * Returns `undefined` when blank so configs stay minimal.
 */
export function normalizeLightTitle(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().slice(0, LIGHT_TITLE_MAX_LENGTH);
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Display name for tile and control panel.
 * Custom title wins when present; otherwise Homey device name.
 */
export function resolveLightDisplayName(
  title: string | undefined,
  deviceName: string,
): string {
  const custom = title?.trim();
  if (custom && custom.length > 0) {
    return custom;
  }
  return deviceName;
}

export { EMPTY_LIGHT_CAPABILITIES };
