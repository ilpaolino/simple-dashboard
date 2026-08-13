import {
  GAP_MAX_PX,
  GAP_MIN_PX,
  GAP_RATIO,
  SAFETY_MARGIN_PX,
} from './constants';
import type { GridConfig, GridGeometry, ViewportSize } from './types';
import { isValidGridConfig } from './layoutParse';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Gap scales with cell size, bounded so small displays stay readable
 * and large displays do not waste space.
 */
export function gapForCellSize(cellSize: number): number {
  if (!Number.isFinite(cellSize) || cellSize <= 0) {
    return GAP_MIN_PX;
  }

  return clamp(cellSize * GAP_RATIO, GAP_MIN_PX, GAP_MAX_PX);
}

function extentsForCellSize(
  cellSize: number,
  config: GridConfig,
): { readonly width: number; readonly height: number; readonly gap: number } {
  const gap = gapForCellSize(cellSize);
  const width =
    config.columns * cellSize + Math.max(0, config.columns - 1) * gap;
  const height = config.rows * cellSize + Math.max(0, config.rows - 1) * gap;
  return { width, height, gap };
}

function fits(
  cellSize: number,
  config: GridConfig,
  availableWidth: number,
  availableHeight: number,
): boolean {
  const { width, height } = extentsForCellSize(cellSize, config);
  return width <= availableWidth + 1e-9 && height <= availableHeight + 1e-9;
}

/**
 * Computes the largest square cell size that fits the viewport with margin + gap.
 * Pure math — no DOM. Layout is intended to be evaluated once at page load.
 */
export function calculateGridGeometry(
  viewport: ViewportSize,
  config: GridConfig,
  safetyMargin: number = SAFETY_MARGIN_PX,
): GridGeometry {
  if (
    !isValidGridConfig(config) ||
    !Number.isFinite(viewport.width) ||
    !Number.isFinite(viewport.height) ||
    viewport.width <= 0 ||
    viewport.height <= 0 ||
    !Number.isFinite(safetyMargin) ||
    safetyMargin < 0
  ) {
    throw new Error('Invalid grid geometry inputs');
  }

  const availableWidth = Math.max(0, viewport.width - 2 * safetyMargin);
  const availableHeight = Math.max(0, viewport.height - 2 * safetyMargin);

  if (availableWidth <= 0 || availableHeight <= 0) {
    throw new Error('Viewport too small for safety margin');
  }

  let low = 0;
  let high = Math.min(
    availableWidth / config.columns,
    availableHeight / config.rows,
  );

  for (let i = 0; i < 40; i += 1) {
    const mid = (low + high) / 2;
    if (fits(mid, config, availableWidth, availableHeight)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const cellSize = Math.floor(low * 1000) / 1000;
  if (cellSize <= 0 || !fits(cellSize, config, availableWidth, availableHeight)) {
    throw new Error('Unable to fit square grid into viewport');
  }

  const { width: gridWidth, height: gridHeight, gap } = extentsForCellSize(
    cellSize,
    config,
  );

  const offsetX = safetyMargin + (availableWidth - gridWidth) / 2;
  const offsetY = safetyMargin + (availableHeight - gridHeight) / 2;

  return {
    cellSize,
    gap,
    gridWidth,
    gridHeight,
    offsetX,
    offsetY,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    safetyMargin,
  };
}
