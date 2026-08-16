export type {
  CoverWidgetConfig,
  CoverWidgetRuntimeState,
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
  coverWidgetDefinition,
  isCoverWidgetConfig,
} from './cover/definition';
export {
  isCompatibleWithLightWidget,
  LIGHT_CAPABILITY_ID,
} from './light/compatibility';
export {
  isCompatibleWithCoverWidget,
  COVER_CAPABILITY_ID,
} from './cover/compatibility';
export { normalizeWindowcoveringsSet } from './cover/normalize';
export { resolveLightVisualState, lightVisualStateClass } from './light/visual';
export {
  resolveCoverVisualState,
  coverVisualStateClass,
  formatCoverPositionPercent,
} from './cover/visual';
export {
  resolveDashboardRuntime,
  type DashboardRuntimeResolveResult,
} from './runtime';
export {
  resolveLightWidgetRuntimeFromSnapshot,
  createLightApiErrorRuntime,
  parseOnoff,
} from './light/runtime';
export {
  resolveCoverWidgetRuntimeFromSnapshot,
  createCoverApiErrorRuntime,
} from './cover/runtime';
export type { HomeyCapabilitySubscription } from '../homey/types';
