import type { GridConfig } from '../dashboard/types';
import { validateWidgetSet } from './placement';
import {
  createDefaultWidgetRegistry,
  isWidgetTypeId,
  type WidgetRegistry,
} from './registry';
import type {
  DashboardConfiguration,
  PlacementValidationError,
  PlacementValidationResult,
  WidgetInstance,
  WidgetPlacement,
  WidgetTypeId,
} from './types';
import {
  emptyDashboardConfiguration,
  isDashboardTheme,
  resolveDashboardTheme,
} from './types';

export type DashboardParseResult =
  | { readonly ok: true; readonly configuration: DashboardConfiguration }
  | { readonly ok: false; readonly error: PlacementValidationError };

export function createWidgetId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseDashboardConfiguration(
  value: unknown,
  options?: {
    readonly registry?: WidgetRegistry;
  },
): DashboardParseResult {
  const registry = options?.registry ?? createDefaultWidgetRegistry();

  if (value === undefined || value === null) {
    return { ok: true, configuration: emptyDashboardConfiguration() };
  }

  if (typeof value !== 'object') {
    return { ok: false, error: 'invalid_config' };
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.version !== 1 || !Array.isArray(candidate.widgets)) {
    return { ok: false, error: 'invalid_config' };
  }

  if (candidate.theme !== undefined && !isDashboardTheme(candidate.theme)) {
    return { ok: false, error: 'invalid_config' };
  }

  const widgets: WidgetInstance[] = [];

  for (const item of candidate.widgets) {
    const parsed = parseWidgetInstance(item, registry);
    if (!parsed.ok) {
      return parsed;
    }
    widgets.push(parsed.widget);
  }

  return {
    ok: true,
    configuration: {
      version: 1,
      theme: resolveDashboardTheme(candidate.theme),
      widgets,
    },
  };
}

export function validateDashboardConfiguration(options: {
  readonly grid: GridConfig;
  readonly configuration: DashboardConfiguration;
  readonly registry?: WidgetRegistry;
}): PlacementValidationResult {
  const registry = options.registry ?? createDefaultWidgetRegistry();

  for (const widget of options.configuration.widgets) {
    if (!registry.validateConfig(widget.type, widget.config)) {
      return { ok: false, error: 'invalid_config', widgetId: widget.id };
    }
  }

  return validateWidgetSet({
    grid: options.grid,
    widgets: options.configuration.widgets,
    resolveAllowedSpans: (type) => registry.allowedSpans(type),
  });
}

function parseWidgetInstance(
  value: unknown,
  registry: WidgetRegistry,
):
  | { readonly ok: true; readonly widget: WidgetInstance }
  | { readonly ok: false; readonly error: PlacementValidationError } {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, error: 'invalid_config' };
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    return { ok: false, error: 'invalid_config' };
  }

  if (!isWidgetTypeId(candidate.type)) {
    return { ok: false, error: 'unknown_type' };
  }

  const placement = parsePlacement(candidate.placement);
  if (!placement) {
    return { ok: false, error: 'invalid_placement' };
  }

  if (!registry.validateConfig(candidate.type, candidate.config)) {
    return { ok: false, error: 'invalid_config' };
  }

  return {
    ok: true,
    widget: {
      id: candidate.id,
      type: candidate.type,
      placement,
      config: candidate.config,
    } as WidgetInstance,
  };
}

function parsePlacement(value: unknown): WidgetPlacement | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.row !== 'number' ||
    typeof candidate.column !== 'number' ||
    typeof candidate.rowSpan !== 'number' ||
    typeof candidate.columnSpan !== 'number'
  ) {
    return null;
  }

  return {
    row: candidate.row,
    column: candidate.column,
    rowSpan: candidate.rowSpan,
    columnSpan: candidate.columnSpan,
  };
}

export function widgetTypesInConfiguration(
  configuration: DashboardConfiguration,
): readonly WidgetTypeId[] {
  const types = new Set<WidgetTypeId>();
  for (const widget of configuration.widgets) {
    types.add(widget.type);
  }
  return [...types];
}
