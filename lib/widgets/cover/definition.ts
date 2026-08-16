import type { WidgetDefinition, WidgetSpan } from '../types';
import { normalizeCoverTitle, type CoverWidgetConfig } from './types';

const COVER_SPANS: readonly WidgetSpan[] = [{ rowSpan: 1, columnSpan: 1 }];

const DEFAULT_COVER_CONFIG: CoverWidgetConfig = {
  deviceId: '',
};

export function isCoverWidgetConfig(value: unknown): value is CoverWidgetConfig {
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
 * Build a persisted cover config, dropping blank titles.
 */
export function buildCoverWidgetConfig(options: {
  readonly deviceId: string;
  readonly title?: string;
}): CoverWidgetConfig | null {
  const deviceId = options.deviceId.trim();
  if (deviceId === '') {
    return null;
  }

  const title = normalizeCoverTitle(options.title);
  if (title === undefined) {
    return { deviceId };
  }

  return { deviceId, title };
}

export const coverWidgetDefinition: WidgetDefinition<CoverWidgetConfig> = {
  type: 'cover',
  nameKey: 'widgets.cover.name',
  allowedSpans: COVER_SPANS,
  defaultConfig: DEFAULT_COVER_CONFIG,
  validateConfig: isCoverWidgetConfig,
  /**
   * Tap opens the control overlay locally — it is not a Homey command.
   * Position / stop intents are dispatched from CoverControlPanel.
   */
  interactions: {
    tap: 'open-control',
  },
};
