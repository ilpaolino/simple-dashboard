import type {
  DateTimeWidgetConfig,
  WidgetDefinition,
  WidgetSpan,
} from '../types';
import { isWidgetChrome } from '../types';

const DATE_TIME_SPANS: readonly WidgetSpan[] = [
  { rowSpan: 1, columnSpan: 1 },
  { rowSpan: 1, columnSpan: 2 },
];

const DEFAULT_DATE_TIME_CONFIG: DateTimeWidgetConfig = {
  mode: 'date-time',
  chrome: 'plain',
};

export function isDateTimeMode(
  value: unknown,
): value is DateTimeWidgetConfig['mode'] {
  return value === 'time' || value === 'date' || value === 'date-time';
}

export function isDateTimeWidgetConfig(
  value: unknown,
): value is DateTimeWidgetConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (!isDateTimeMode(candidate.mode)) {
    return false;
  }

  if (candidate.chrome !== undefined && !isWidgetChrome(candidate.chrome)) {
    return false;
  }

  return true;
}

export const dateTimeWidgetDefinition: WidgetDefinition<DateTimeWidgetConfig> =
  {
    type: 'date-time',
    nameKey: 'widgets.dateTime.name',
    allowedSpans: DATE_TIME_SPANS,
    defaultConfig: DEFAULT_DATE_TIME_CONFIG,
    validateConfig: isDateTimeWidgetConfig,
  };
