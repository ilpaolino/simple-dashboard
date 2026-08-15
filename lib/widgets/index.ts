export type {
  DashboardConfiguration,
  DashboardTheme,
  DateTimeMode,
  DateTimeWidgetConfig,
  LightWidgetConfig,
  LightWidgetRuntimeState,
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
  WidgetRuntimeState,
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
export {
  lightWidgetDefinition,
  isLightWidgetConfig,
} from './light/definition';
export {
  isCompatibleWithLightWidget,
  LIGHT_CAPABILITY_ID,
} from './light/compatibility';
export { resolveLightVisualState, lightVisualStateClass } from './light/visual';
export {
  resolveDashboardRuntime,
  type DashboardRuntimeResolveResult,
} from './runtime';
