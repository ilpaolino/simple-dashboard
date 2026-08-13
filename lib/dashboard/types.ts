/**
 * Dashboard grid contracts shared by Homey backend and vanilla frontend.
 */

import type {
  DashboardConfiguration,
  DashboardTheme,
  WidgetInstance,
  WidgetPlacement,
} from '../widgets/types';

export interface GridConfig {
  readonly rows: number;
  readonly columns: number;
}

/**
 * Logical cell identity. Used for occupancy and diagnostics.
 */
export interface GridCell {
  readonly row: number;
  readonly column: number;
  readonly id: string;
}

/**
 * Alias kept for geometry helpers. Prefer {@link WidgetPlacement} for widgets.
 */
export type GridPlacement = WidgetPlacement;

/**
 * Localized copy for the empty-dashboard state (no widgets configured).
 * Resolved on Homey so the browser does not embed locale files.
 */
export interface DashboardEmptyStateCopy {
  readonly heading: string;
  readonly lead: string;
  readonly nameLabel: string;
  readonly typeLabel: string;
  readonly idLabel: string;
  readonly layoutLabel: string;
  readonly gridLabel: string;
}

/**
 * Minimal DTO sent to the frontend. No Homey API surface.
 * `applyConfiguration` on the client can re-apply this shape later (reload-only today).
 */
export interface DashboardBootstrap {
  readonly displayId: string;
  readonly displayName: string;
  readonly typeLabel: string;
  readonly layoutId: string;
  readonly layout: GridConfig;
  readonly widgets: readonly WidgetInstance[];
  readonly theme: DashboardTheme;
  readonly locale: string;
  readonly emptyState: DashboardEmptyStateCopy;
}

export type { DashboardConfiguration, DashboardTheme, WidgetInstance, WidgetPlacement };

export interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface GridGeometry {
  readonly cellSize: number;
  readonly gap: number;
  readonly gridWidth: number;
  readonly gridHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly safetyMargin: number;
}

export type LayoutResolveResult =
  | { readonly ok: true; readonly config: GridConfig }
  | { readonly ok: false; readonly reason: 'invalid_layout' };
