/**
 * Dashboard grid contracts shared by Homey backend and vanilla frontend.
 * Widget multi-cell spans are modeled but not rendered in this milestone.
 */

export interface GridConfig {
  readonly rows: number;
  readonly columns: number;
}

/**
 * Logical cell identity. Display labels are diagnostics only.
 */
export interface GridCell {
  readonly row: number;
  readonly column: number;
  readonly id: string;
}

/**
 * Future placement for widgets that may span multiple cells.
 * Rendering of spans is intentionally not implemented yet.
 */
export interface GridPlacement {
  readonly row: number;
  readonly column: number;
  readonly rowSpan: number;
  readonly columnSpan: number;
}

/**
 * Minimal DTO sent to the frontend. No Homey API surface.
 */
export interface DashboardBootstrap {
  readonly displayId: string;
  readonly layout: GridConfig;
}

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
