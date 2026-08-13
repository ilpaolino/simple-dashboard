import type { TitleWidgetConfig, WidgetDefinition, WidgetSpan } from '../types';
import { isWidgetChrome } from '../types';

const TITLE_SPANS: readonly WidgetSpan[] = [
  { rowSpan: 1, columnSpan: 2 },
  { rowSpan: 1, columnSpan: 3 },
];

const DEFAULT_TITLE_CONFIG: TitleWidgetConfig = {
  text: 'Title',
  alignment: 'left',
  chrome: 'plain',
};

export function isTextAlignment(value: unknown): value is TitleWidgetConfig['alignment'] {
  return value === 'left' || value === 'center' || value === 'right';
}

export function isTitleWidgetConfig(value: unknown): value is TitleWidgetConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.text !== 'string') {
    return false;
  }

  if (candidate.text.trim() === '') {
    return false;
  }

  if (candidate.chrome !== undefined && !isWidgetChrome(candidate.chrome)) {
    return false;
  }

  return isTextAlignment(candidate.alignment);
}

export const titleWidgetDefinition: WidgetDefinition<TitleWidgetConfig> = {
  type: 'title',
  nameKey: 'widgets.title.name',
  allowedSpans: TITLE_SPANS,
  defaultConfig: DEFAULT_TITLE_CONFIG,
  validateConfig: isTitleWidgetConfig,
};
