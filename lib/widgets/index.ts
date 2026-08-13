export type {
  DashboardConfiguration,
  DashboardTheme,
  DateTimeMode,
  DateTimeWidgetConfig,
  OccupancyMap,
  PlacementValidationError,
  PlacementValidationResult,
  TextAlignment,
  TitleWidgetConfig,
  WidgetChrome,
  WidgetConfigMap,
  WidgetDefinition,
  WidgetInstance,
  WidgetPlacement,
  WidgetSpan,
  WidgetTypeId,
} from './types';
export {
  emptyDashboardConfiguration,
  isDashboardTheme,
  isWidgetChrome,
  resolveDashboardTheme,
  resolveWidgetChrome,
  spanKey,
} from './types';
export {
  buildOccupancyMap,
  isSameSpan,
  isSpanAllowed,
  occupiedCellIds,
  occupancyWithoutWidget,
  placementsOverlap,
  validatePlacementAgainstWidgets,
  validateWidgetSet,
} from './placement';
export {
  createDefaultWidgetRegistry,
  isWidgetTypeId,
  WidgetRegistry,
} from './registry';
export {
  createWidgetId,
  parseDashboardConfiguration,
  validateDashboardConfiguration,
  widgetTypesInConfiguration,
  type DashboardParseResult,
} from './validation';
export { titleWidgetDefinition, isTitleWidgetConfig } from './title/definition';
export {
  dateTimeWidgetDefinition,
  isDateTimeWidgetConfig,
} from './date-time/definition';
