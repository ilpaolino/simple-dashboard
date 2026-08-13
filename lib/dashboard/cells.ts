import type { GridCell, GridConfig, GridPlacement } from './types';
import { isValidGridConfig } from './layoutParse';

/**
 * Stable cell id derived from zero-based coordinates.
 * Independent from any diagnostic label shown in the UI.
 */
export function cellId(row: number, column: number): string {
  return `r${row}c${column}`;
}

/**
 * Builds the full set of 1x1 cells for a grid.
 * Order is row-major (left-to-right, top-to-bottom).
 */
export function createGridCells(config: GridConfig): readonly GridCell[] {
  if (!isValidGridConfig(config)) {
    throw new Error('Invalid grid configuration');
  }

  const cells: GridCell[] = [];
  for (let row = 0; row < config.rows; row += 1) {
    for (let column = 0; column < config.columns; column += 1) {
      cells.push({
        row,
        column,
        id: cellId(row, column),
      });
    }
  }
  return cells;
}

/**
 * Structural helper for future multi-cell widgets.
 * Validates placement bounds without rendering spans.
 */
export function isPlacementWithinGrid(
  config: GridConfig,
  placement: GridPlacement,
): boolean {
  if (!isValidGridConfig(config)) {
    return false;
  }

  if (
    !Number.isInteger(placement.row) ||
    !Number.isInteger(placement.column) ||
    !Number.isInteger(placement.rowSpan) ||
    !Number.isInteger(placement.columnSpan)
  ) {
    return false;
  }

  if (placement.row < 0 || placement.column < 0) {
    return false;
  }

  if (placement.rowSpan < 1 || placement.columnSpan < 1) {
    return false;
  }

  return (
    placement.row + placement.rowSpan <= config.rows &&
    placement.column + placement.columnSpan <= config.columns
  );
}

/**
 * Factory for future span placements (1x1, 1x2, 2x1, 2x2, …).
 */
export function createPlacement(
  row: number,
  column: number,
  rowSpan: number = 1,
  columnSpan: number = 1,
): GridPlacement {
  return { row, column, rowSpan, columnSpan };
}
