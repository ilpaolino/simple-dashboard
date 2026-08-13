import {
  calculateGridGeometry,
  createGridCells,
  SAFETY_MARGIN_PX,
  type DashboardBootstrap,
  type DashboardEmptyStateCopy,
  type GridConfig,
} from '../../lib/dashboard/index';
import {
  resolveDashboardTheme,
  type DashboardTheme,
  type WidgetInstance,
} from '../../lib/widgets/types';
import {
  createFrontendWidgetRegistry,
  type FrontendWidgetRegistry,
} from '../widgets/registry/WidgetRegistry';
import type { MountedWidget } from '../widgets/types';

export interface DashboardConfigurationView {
  readonly displayId: string;
  readonly displayName: string;
  readonly typeLabel: string;
  readonly layoutId: string;
  readonly layout: GridConfig;
  readonly widgets: readonly WidgetInstance[];
  readonly theme?: DashboardTheme;
  readonly locale: string;
  readonly emptyState: DashboardEmptyStateCopy;
}

/**
 * Configuration-driven dashboard renderer.
 * Call `applyConfiguration` on load today; the same method can be reused for live updates later.
 */
export class DashboardRenderer {
  private readonly registry: FrontendWidgetRegistry;
  private readonly root: HTMLElement;
  private mounted: MountedWidget[] = [];
  private theme: DashboardTheme = 'dark';

  public constructor(
    root: HTMLElement,
    registry: FrontendWidgetRegistry = createFrontendWidgetRegistry(),
  ) {
    this.root = root;
    this.registry = registry;
  }

  public applyConfiguration(config: DashboardConfigurationView): void {
    this.destroyMounted();
    this.root.replaceChildren();
    this.applyTheme(resolveDashboardTheme(config.theme));

    if (config.widgets.length === 0) {
      this.renderEmptyState(config);
      return;
    }

    this.renderWidgets(config);
  }

  public applyBootstrap(bootstrap: DashboardBootstrap): void {
    this.applyConfiguration({
      displayId: bootstrap.displayId,
      displayName: bootstrap.displayName,
      typeLabel: bootstrap.typeLabel,
      layoutId: bootstrap.layoutId,
      layout: bootstrap.layout,
      widgets: bootstrap.widgets,
      theme: bootstrap.theme,
      locale: bootstrap.locale,
      emptyState: bootstrap.emptyState,
    });
  }

  public getMountedCount(): number {
    return this.mounted.length;
  }

  public destroy(): void {
    this.destroyMounted();
    this.root.replaceChildren();
  }

  private renderWidgets(config: DashboardConfigurationView): void {
    const geometry = this.geometryFor(config.layout);
    const grid = this.createGridElement(config.layout, geometry);

    for (const widget of config.widgets) {
      const renderer = this.registry.getRenderer(widget.type);
      if (!renderer) {
        continue;
      }

      const mounted = renderer.mount(widget, {
        locale: config.locale,
        theme: this.theme,
      });
      this.mounted.push(mounted);
      grid.appendChild(mounted.element);
    }

    this.root.appendChild(grid);
  }

  private renderEmptyState(config: DashboardConfigurationView): void {
    const geometry = this.geometryFor(config.layout);
    const grid = this.createGridElement(config.layout, geometry);
    grid.className = `${grid.className} grid--empty`.trim();

    for (const cell of createGridCells(config.layout)) {
      const cellElement = document.createElement('div');
      cellElement.className = 'grid-cell grid-cell--empty';
      cellElement.dataset.cellId = cell.id;
      cellElement.dataset.row = String(cell.row);
      cellElement.dataset.column = String(cell.column);
      cellElement.setAttribute('role', 'gridcell');
      cellElement.textContent = `${cell.row + 1},${cell.column + 1}`;
      grid.appendChild(cellElement);
    }

    const panel = document.createElement('section');
    panel.className = 'dashboard-empty';
    panel.setAttribute('role', 'status');

    const heading = document.createElement('h1');
    heading.className = 'dashboard-empty__heading';
    heading.textContent = config.emptyState.heading;

    const lead = document.createElement('p');
    lead.className = 'dashboard-empty__lead';
    lead.textContent = config.emptyState.lead;

    const list = document.createElement('dl');
    list.className = 'dashboard-empty__meta';

    const rows: readonly { label: string; value: string }[] = [
      { label: config.emptyState.nameLabel, value: config.displayName },
      { label: config.emptyState.typeLabel, value: config.typeLabel },
      { label: config.emptyState.idLabel, value: config.displayId },
      { label: config.emptyState.layoutLabel, value: config.layoutId },
      {
        label: config.emptyState.gridLabel,
        value: `${config.layout.columns}×${config.layout.rows}`,
      },
    ];

    for (const row of rows) {
      const dt = document.createElement('dt');
      dt.textContent = row.label;
      const dd = document.createElement('dd');
      dd.textContent = row.value;
      list.appendChild(dt);
      list.appendChild(dd);
    }

    panel.appendChild(heading);
    panel.appendChild(lead);
    panel.appendChild(list);

    this.root.appendChild(grid);
    this.root.appendChild(panel);
  }

  private applyTheme(theme: DashboardTheme): void {
    this.theme = theme;
    this.root.dataset.theme = theme;

    const documentElement = document.documentElement;
    if (documentElement?.dataset) {
      documentElement.dataset.theme = theme;
      if (documentElement.style) {
        documentElement.style.colorScheme = theme;
      }
    }

    if (document.body?.dataset) {
      document.body.dataset.theme = theme;
    }

    const colorSchemeMeta = document.querySelector?.('meta[name="color-scheme"]');
    if (colorSchemeMeta) {
      colorSchemeMeta.setAttribute('content', theme);
    }
  }

  private geometryFor(layout: GridConfig) {
    return calculateGridGeometry(
      {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      layout,
      SAFETY_MARGIN_PX,
    );
  }

  private createGridElement(
    layout: GridConfig,
    geometry: ReturnType<typeof calculateGridGeometry>,
  ): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.dataset.theme = this.theme;
    grid.style.setProperty('--cell-size', `${geometry.cellSize}px`);
    grid.style.setProperty('--grid-gap', `${geometry.gap}px`);
    grid.style.setProperty('--grid-columns', String(layout.columns));
    grid.style.setProperty('--grid-rows', String(layout.rows));
    grid.style.left = `${geometry.offsetX}px`;
    grid.style.top = `${geometry.offsetY}px`;
    grid.style.width = `${geometry.gridWidth}px`;
    grid.style.height = `${geometry.gridHeight}px`;
    grid.setAttribute('role', 'grid');
    grid.setAttribute(
      'aria-label',
      `Dashboard grid ${layout.columns} by ${layout.rows}`,
    );
    return grid;
  }

  private destroyMounted(): void {
    for (const item of this.mounted) {
      item.destroy();
    }
    this.mounted = [];
  }
}
