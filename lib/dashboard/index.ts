import { createGridCells } from './cells';
import { calculateGridGeometry } from './layoutGeometry';
import { resolveLayoutId, formatGridSize, isValidGridConfig } from './layoutParse';
import { SAFETY_MARGIN_PX } from './constants';
import type {
  DashboardBootstrap,
  DashboardEmptyStateCopy,
  GridConfig,
  GridCell,
  GridGeometry,
  ViewportSize,
} from './types';
import { emptyDashboardConfiguration, resolveDashboardTheme } from '../widgets/types';

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
  DashboardConfiguration,
  DashboardEmptyStateCopy,
  DashboardTheme,
  GridConfig,
  GridCell,
  GridGeometry,
  GridPlacement,
  ViewportSize,
  WidgetInstance,
  WidgetPlacement,
  LayoutResolveResult,
} from './types';

export interface CreateDashboardBootstrapInput {
  readonly displayId: string;
  readonly displayName: string;
  readonly typeLabel: string;
  readonly layoutId: string;
  readonly layout: GridConfig;
  readonly widgets?: DashboardBootstrap['widgets'];
  readonly theme?: DashboardBootstrap['theme'];
  readonly locale?: string;
  readonly emptyState: DashboardEmptyStateCopy;
}

export function createDashboardBootstrap(
  input: CreateDashboardBootstrapInput,
): DashboardBootstrap {
  if (!isValidGridConfig(input.layout)) {
    throw new Error('Invalid grid configuration for bootstrap');
  }

  return {
    displayId: input.displayId,
    displayName: input.displayName,
    typeLabel: input.typeLabel,
    layoutId: input.layoutId,
    layout: {
      rows: input.layout.rows,
      columns: input.layout.columns,
    },
    widgets: input.widgets ?? [],
    theme: resolveDashboardTheme(input.theme),
    locale: input.locale ?? 'en',
    emptyState: input.emptyState,
  };
}

export function createEmptyStateCopy(
  translate: (key: string) => string,
): DashboardEmptyStateCopy {
  return {
    heading: translate('pages.dashboardEmpty.heading'),
    lead: translate('pages.dashboardEmpty.lead'),
    nameLabel: translate('pages.recognized.name'),
    typeLabel: translate('pages.recognized.type'),
    idLabel: translate('pages.recognized.hardwareId'),
    layoutLabel: translate('pages.recognized.layout'),
    gridLabel: translate('pages.diagnostics.gridSize'),
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
    bootstrap: createDashboardBootstrap({
      displayId: 'preview',
      displayName: 'Preview',
      typeLabel: 'Preview',
      layoutId,
      layout: resolved.config,
      widgets: emptyDashboardConfiguration().widgets,
      locale: 'en',
      emptyState: {
        heading: 'No widgets configured',
        lead: 'Configure this display from the Wall Display app settings.',
        nameLabel: 'Name',
        typeLabel: 'Type',
        idLabel: 'ID',
        layoutLabel: 'Layout',
        gridLabel: 'Grid size',
      },
    }),
    gridSizeLabel: formatGridSize(resolved.config),
  };
}
