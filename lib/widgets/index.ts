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
  buildCoverWidgetConfig,
} from './cover/definition';
export {
  isCompatibleWithLightWidget,
  LIGHT_CAPABILITY_ID,
} from './light/compatibility';
export {
  isCompatibleWithCoverWidget,
  hasWindowcoveringsStateCapability,
  resolveCoverWidgetCapabilities,
  COVER_CAPABILITY_ID,
  COVER_STATE_CAPABILITY_ID,
  COVER_STOP_STATE_VALUE,
} from './cover/compatibility';
export {
  normalizeWindowcoveringsSet,
  denormalizePositionPercent,
  isValidPositionPercent,
} from './cover/normalize';
export {
  evaluateCoverPositionConfirmation,
  COVER_POSITION_CONFIRM_TOLERANCE_PERCENT,
} from './cover/confirmation';
export {
  normalizeCoverTitle,
  resolveCoverDisplayName,
  COVER_TITLE_MAX_LENGTH,
} from './cover/types';
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
