import type { WidgetDefinition, WidgetSpan } from '../types';
import type { LightWidgetConfig } from './types';

const LIGHT_SPANS: readonly WidgetSpan[] = [{ rowSpan: 1, columnSpan: 1 }];

const DEFAULT_LIGHT_CONFIG: LightWidgetConfig = {
  deviceId: '',
};

export function isLightWidgetConfig(value: unknown): value is LightWidgetConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.deviceId === 'string' && candidate.deviceId.trim() !== '';
}

export const lightWidgetDefinition: WidgetDefinition<LightWidgetConfig> = {
  type: 'light',
  nameKey: 'widgets.light.name',
  allowedSpans: LIGHT_SPANS,
  defaultConfig: DEFAULT_LIGHT_CONFIG,
  validateConfig: isLightWidgetConfig,
  /** Milestone 7: single tap toggles onoff. Further gestures are reserved. */
  interactions: {
    tap: 'toggle',
  },
};
