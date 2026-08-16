import { createGridCells } from './cells';
import { calculateGridGeometry } from './layoutGeometry';
import { resolveLayoutId, formatGridSize, isValidGridConfig } from './layoutParse';
import { SAFETY_MARGIN_PX } from './constants';
import type {
  DashboardBootstrap,
  DashboardEmptyStateCopy,
  DashboardUiCopy,
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
  DashboardUiCopy,
  GridConfig,
  GridCell,
  GridGeometry,
  GridPlacement,
  ViewportSize,
  WidgetInstance,
  WidgetPlacement,
  WidgetRuntimeState,
  LayoutResolveResult,
} from './types';

export interface CreateDashboardBootstrapInput {
  readonly displayId: string;
  readonly displayName: string;
  readonly typeLabel: string;
  readonly layoutId: string;
  readonly layout: GridConfig;
  readonly widgets?: DashboardBootstrap['widgets'];
  readonly widgetRuntime?: DashboardBootstrap['widgetRuntime'];
  readonly theme?: DashboardBootstrap['theme'];
  readonly locale?: string;
  readonly emptyState: DashboardEmptyStateCopy;
  readonly copy?: DashboardUiCopy;
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
    widgetRuntime: input.widgetRuntime ?? {},
    theme: resolveDashboardTheme(input.theme),
    locale: input.locale ?? 'en',
    emptyState: input.emptyState,
    copy: input.copy ?? defaultDashboardUiCopy(),
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

export function createDashboardUiCopy(
  translate: (key: string) => string,
): DashboardUiCopy {
  return {
    light: {
      on: translate('widgets.light.on'),
      off: translate('widgets.light.off'),
      unavailable: translate('widgets.light.unavailable'),
      commandInProgress: translate('widgets.light.commandInProgress'),
      commandFailed: translate('widgets.light.commandFailed'),
      commandTimeout: translate('widgets.light.commandTimeout'),
    },
    cover: {
      unavailable: translate('widgets.cover.unavailable'),
      invalidPosition: translate('widgets.cover.invalidPosition'),
    },
    widgetFailed: translate('pages.dashboard.widgetFailed'),
    realtime: {
      connectionLost: translate('pages.realtime.connectionLost'),
      reconnecting: translate('pages.realtime.reconnecting'),
      connectionRestored: translate('pages.realtime.connectionRestored'),
      realtimeUnavailable: translate('pages.realtime.realtimeUnavailable'),
      protocolError: translate('pages.realtime.protocolError'),
      displaySessionInvalid: translate('pages.realtime.displaySessionInvalid'),
      snapshotFailed: translate('pages.realtime.snapshotFailed'),
      homeyConnectionError: translate('pages.realtime.homeyConnectionError'),
    },
  };
}

/**
 * English fallback used by tests and as a last resort if bootstrap copy is omitted.
 * Production always injects Homey translations via {@link createDashboardUiCopy}.
 */
export function defaultDashboardUiCopy(): DashboardUiCopy {
  return {
    light: {
      on: 'On',
      off: 'Off',
      unavailable: 'Device unavailable',
      commandInProgress: 'Command in progress',
      commandFailed: 'Command failed',
      commandTimeout: 'Command timeout',
    },
    cover: {
      unavailable: 'Device unavailable',
      invalidPosition: 'Invalid position',
    },
    widgetFailed: 'Widget failed',
    realtime: {
      connectionLost: 'Connection to Homey lost',
      reconnecting: 'Reconnecting…',
      connectionRestored: 'Connection restored',
      realtimeUnavailable: 'Realtime unavailable',
      protocolError: 'Protocol error',
      displaySessionInvalid: 'Display session invalid',
      snapshotFailed: 'Snapshot failed',
      homeyConnectionError: 'Homey connection error',
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
