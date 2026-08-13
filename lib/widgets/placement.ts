import type { GridConfig } from '../dashboard/types';
import { cellId, isPlacementWithinGrid } from '../dashboard/cells';
import type {
  OccupancyMap,
  PlacementValidationResult,
  WidgetInstance,
  WidgetPlacement,
  WidgetSpan,
} from './types';

export function isSameSpan(left: WidgetSpan, right: WidgetSpan): boolean {
  return left.rowSpan === right.rowSpan && left.columnSpan === right.columnSpan;
}

export function isSpanAllowed(
  allowed: readonly WidgetSpan[],
  placement: WidgetPlacement,
): boolean {
  return allowed.some(
    (span) =>
      span.rowSpan === placement.rowSpan &&
      span.columnSpan === placement.columnSpan,
  );
}

/**
 * Builds cell-id → widget-id occupancy. Assumes placements are already valid.
 */
export function buildOccupancyMap(
  widgets: readonly WidgetInstance[],
): Map<string, string> {
  const occupancy = new Map<string, string>();

  for (const widget of widgets) {
    for (const id of occupiedCellIds(widget.placement)) {
      occupancy.set(id, widget.id);
    }
  }

  return occupancy;
}

export function occupiedCellIds(
  placement: WidgetPlacement,
): readonly string[] {
  const ids: string[] = [];
  for (
    let row = placement.row;
    row < placement.row + placement.rowSpan;
    row += 1
  ) {
    for (
      let column = placement.column;
      column < placement.column + placement.columnSpan;
      column += 1
    ) {
      ids.push(cellId(row, column));
    }
  }
  return ids;
}

export function placementsOverlap(
  left: WidgetPlacement,
  right: WidgetPlacement,
): boolean {
  const leftRight = left.column + left.columnSpan;
  const leftBottom = left.row + left.rowSpan;
  const rightRight = right.column + right.columnSpan;
  const rightBottom = right.row + right.rowSpan;

  return !(
    leftRight <= right.column ||
    rightRight <= left.column ||
    leftBottom <= right.row ||
    rightBottom <= left.row
  );
}

/**
 * Validates a candidate placement against the grid and existing widgets.
 * `ignoreWidgetId` excludes that instance (used when editing).
 */
export function validatePlacementAgainstWidgets(options: {
  readonly grid: GridConfig;
  readonly placement: WidgetPlacement;
  readonly widgets: readonly WidgetInstance[];
  readonly ignoreWidgetId?: string;
  readonly allowedSpans?: readonly WidgetSpan[];
}): PlacementValidationResult {
  const { grid, placement, widgets, ignoreWidgetId, allowedSpans } = options;

  if (
    !Number.isInteger(placement.row) ||
    !Number.isInteger(placement.column) ||
    !Number.isInteger(placement.rowSpan) ||
    !Number.isInteger(placement.columnSpan) ||
    placement.rowSpan < 1 ||
    placement.columnSpan < 1
  ) {
    return { ok: false, error: 'invalid_placement' };
  }

  if (allowedSpans && !isSpanAllowed(allowedSpans, placement)) {
    return { ok: false, error: 'unsupported_span' };
  }

  if (!isPlacementWithinGrid(grid, placement)) {
    return { ok: false, error: 'out_of_bounds' };
  }

  for (const widget of widgets) {
    if (ignoreWidgetId !== undefined && widget.id === ignoreWidgetId) {
      continue;
    }
    if (placementsOverlap(placement, widget.placement)) {
      return { ok: false, error: 'overlap', widgetId: widget.id };
    }
  }

  return { ok: true };
}

export function validateWidgetSet(options: {
  readonly grid: GridConfig;
  readonly widgets: readonly WidgetInstance[];
  readonly resolveAllowedSpans: (
    type: string,
  ) => readonly WidgetSpan[] | null;
}): PlacementValidationResult {
  const seenIds = new Set<string>();

  for (const widget of options.widgets) {
    if (seenIds.has(widget.id)) {
      return { ok: false, error: 'duplicate_id', widgetId: widget.id };
    }
    seenIds.add(widget.id);

    const allowed = options.resolveAllowedSpans(widget.type);
    if (allowed === null) {
      return { ok: false, error: 'unknown_type', widgetId: widget.id };
    }

    const result = validatePlacementAgainstWidgets({
      grid: options.grid,
      placement: widget.placement,
      widgets: options.widgets,
      ignoreWidgetId: widget.id,
      allowedSpans: allowed,
    });

    if (!result.ok) {
      return { ...result, widgetId: widget.id };
    }
  }

  return { ok: true };
}

export function occupancyWithoutWidget(
  occupancy: OccupancyMap,
  widgetId: string,
): Map<string, string> {
  const next = new Map<string, string>();
  for (const [cell, owner] of occupancy) {
    if (owner !== widgetId) {
      next.set(cell, owner);
    }
  }
  return next;
}
