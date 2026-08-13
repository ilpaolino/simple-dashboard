import { createGridCells } from './cells';
import { calculateGridGeometry } from './layoutGeometry';
import { resolveLayoutId, formatGridSize, isValidGridConfig } from './layoutParse';
import { SAFETY_MARGIN_PX } from './constants';
import type {
  DashboardBootstrap,
  GridConfig,
  GridCell,
  GridGeometry,
  ViewportSize,
} from './types';

export {
  createGridCells,
  cellId,
  isPlacementWithinGrid,
  createPlacement,
} from './cells';
export { calculateGridGeometry, gapForCellSize } from './layoutGeometry';
export {
  resolveLayoutId,
  formatGridSize,
  isValidGridConfig,
} from './layoutParse';
export {
  SAFETY_MARGIN_PX,
  GAP_RATIO,
  GAP_MIN_PX,
  GAP_MAX_PX,
} from './constants';
export type {
  DashboardBootstrap,
  GridConfig,
  GridCell,
  GridGeometry,
  GridPlacement,
  ViewportSize,
  LayoutResolveResult,
} from './types';

export function createDashboardBootstrap(
  displayId: string,
  config: GridConfig,
): DashboardBootstrap {
  if (!isValidGridConfig(config)) {
    throw new Error('Invalid grid configuration for bootstrap');
  }

  return {
    displayId,
    layout: {
      rows: config.rows,
      columns: config.columns,
    },
  };
}

export function buildDashboardModel(
  layoutId: string,
  viewport: ViewportSize,
): {
  readonly config: GridConfig;
  readonly cells: readonly GridCell[];
  readonly geometry: GridGeometry;
  readonly bootstrap: DashboardBootstrap;
  readonly gridSizeLabel: string;
} {
  const resolved = resolveLayoutId(layoutId);
  if (!resolved.ok) {
    throw new Error('Invalid layout');
  }

  const cells = createGridCells(resolved.config);
  const geometry = calculateGridGeometry(
    viewport,
    resolved.config,
    SAFETY_MARGIN_PX,
  );

  return {
    config: resolved.config,
    cells,
    geometry,
    bootstrap: createDashboardBootstrap('preview', resolved.config),
    gridSizeLabel: formatGridSize(resolved.config),
  };
}
