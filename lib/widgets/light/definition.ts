import type { WidgetDefinition, WidgetSpan } from '../types';
import {
  normalizeLightTitle,
  type LightWidgetConfig,
} from './types';

const LIGHT_SPANS: readonly WidgetSpan[] = [{ rowSpan: 1, columnSpan: 1 }];

const DEFAULT_LIGHT_CONFIG: LightWidgetConfig = {
  deviceId: '',
};

export function isLightWidgetConfig(value: unknown): value is LightWidgetConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.deviceId !== 'string' || candidate.deviceId.trim() === '') {
    return false;
  }

  if (candidate.title !== undefined && typeof candidate.title !== 'string') {
    return false;
  }

  return true;
}

/**
 * Build a persisted light config, dropping blank titles.
 */
export function buildLightWidgetConfig(options: {
  readonly deviceId: string;
  readonly title?: string;
}): LightWidgetConfig | null {
  const deviceId = options.deviceId.trim();
  if (deviceId === '') {
    return null;
  }

  const title = normalizeLightTitle(options.title);
  if (title === undefined) {
    return { deviceId };
  }

  return { deviceId, title };
}

export const lightWidgetDefinition: WidgetDefinition<LightWidgetConfig> = {
  type: 'light',
  nameKey: 'widgets.light.name',
  allowedSpans: LIGHT_SPANS,
  defaultConfig: DEFAULT_LIGHT_CONFIG,
  validateConfig: isLightWidgetConfig,
  /**
   * Milestone 7/10: tap → toggle; long-press → open LightControlPanel (local UI).
   * Panel actions map to set-dim / set-temperature / set-color intents.
   */
  interactions: {
    tap: 'toggle',
    'long-press': 'open-control',
  },
};
