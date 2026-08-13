/**
 * Shared widget contracts for Homey backend validation and vanilla frontend.
 */

/**
 * Explicit widget placement. `(row, column)` is the top-left cell (0-based).
 * The widget extends right and down by its spans.
 */
export interface WidgetPlacement {
  readonly row: number;
  readonly column: number;
  readonly rowSpan: number;
  readonly columnSpan: number;
}

export interface WidgetSpan {
  readonly rowSpan: number;
  readonly columnSpan: number;
}

export type WidgetTypeId = 'title' | 'date-time';

export type TextAlignment = 'left' | 'center' | 'right';

/**
 * Visual chrome around a widget. Omitted `chrome` is treated as `plain`
 * so existing dashboards keep the borderless look.
 */
export type WidgetChrome = 'plain' | 'card';

export interface TitleWidgetConfig {
  readonly text: string;
  readonly alignment: TextAlignment;
  readonly chrome?: WidgetChrome;
}

export type DateTimeMode = 'time' | 'date' | 'date-time';

export interface DateTimeWidgetConfig {
  readonly mode: DateTimeMode;
  readonly chrome?: WidgetChrome;
}

export function isWidgetChrome(value: unknown): value is WidgetChrome {
  return value === 'plain' || value === 'card';
}

export function resolveWidgetChrome(config: {
  readonly chrome?: unknown;
}): WidgetChrome {
  return isWidgetChrome(config.chrome) ? config.chrome : 'plain';
}

export type WidgetConfigMap = {
  readonly title: TitleWidgetConfig;
  readonly 'date-time': DateTimeWidgetConfig;
};

/**
 * Stable instance identity is independent from placement.
 */
export type WidgetInstance =
  | {
      readonly id: string;
      readonly type: 'title';
      readonly placement: WidgetPlacement;
      readonly config: TitleWidgetConfig;
    }
  | {
      readonly id: string;
      readonly type: 'date-time';
      readonly placement: WidgetPlacement;
      readonly config: DateTimeWidgetConfig;
    };

export type DashboardTheme = 'dark' | 'light';

/**
 * Appearance for the whole dashboard of one display. Widgets inherit this
 * via CSS tokens; they do not store a theme of their own. Omitted `theme`
 * is treated as `dark` so existing dashboards keep the current look.
 */
export function isDashboardTheme(value: unknown): value is DashboardTheme {
  return value === 'dark' || value === 'light';
}

export function resolveDashboardTheme(value: unknown): DashboardTheme {
  return isDashboardTheme(value) ? value : 'dark';
}

export interface DashboardConfiguration {
  readonly version: 1;
  readonly theme?: DashboardTheme;
  readonly widgets: readonly WidgetInstance[];
}

export interface WidgetDefinition<TConfig> {
  readonly type: WidgetTypeId;
  readonly nameKey: string;
  readonly allowedSpans: readonly WidgetSpan[];
  readonly defaultConfig: TConfig;
  readonly validateConfig: (config: unknown) => config is TConfig;
}

export type PlacementValidationError =
  | 'out_of_bounds'
  | 'overlap'
  | 'unsupported_span'
  | 'invalid_placement'
  | 'unknown_type'
  | 'invalid_config'
  | 'duplicate_id';

export type PlacementValidationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: PlacementValidationError;
      readonly widgetId?: string;
    };

export type OccupancyMap = ReadonlyMap<string, string>;

export function spanKey(span: WidgetSpan): string {
  return `${span.columnSpan}x${span.rowSpan}`;
}

export function emptyDashboardConfiguration(): DashboardConfiguration {
  return {
    version: 1,
    theme: 'dark',
    widgets: [],
  };
}
