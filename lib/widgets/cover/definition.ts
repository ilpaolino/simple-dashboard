import type { WidgetDefinition, WidgetSpan } from '../types';
import type { CoverWidgetConfig } from './types';

const COVER_SPANS: readonly WidgetSpan[] = [{ rowSpan: 1, columnSpan: 1 }];

const DEFAULT_COVER_CONFIG: CoverWidgetConfig = {
  deviceId: '',
};

export function isCoverWidgetConfig(value: unknown): value is CoverWidgetConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.deviceId === 'string' && candidate.deviceId.trim() !== '';
}

export const coverWidgetDefinition: WidgetDefinition<CoverWidgetConfig> = {
  type: 'cover',
  nameKey: 'widgets.cover.name',
  allowedSpans: COVER_SPANS,
  defaultConfig: DEFAULT_COVER_CONFIG,
  validateConfig: isCoverWidgetConfig,
};
