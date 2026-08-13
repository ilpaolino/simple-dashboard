import {
  calculateGridGeometry,
  createGridCells,
  SAFETY_MARGIN_PX,
  type DashboardBootstrap,
  type GridConfig,
} from '../lib/dashboard/index';

const BOOTSTRAP_ELEMENT_ID = 'dashboard-bootstrap';

function readBootstrap(): DashboardBootstrap {
  const element = document.getElementById(BOOTSTRAP_ELEMENT_ID);
  if (!element || element.textContent === null || element.textContent.trim() === '') {
    throw new Error('Missing dashboard bootstrap payload');
  }

  const parsed: unknown = JSON.parse(element.textContent);
  if (!isDashboardBootstrap(parsed)) {
    throw new Error('Invalid dashboard bootstrap payload');
  }

  return parsed;
}

function isDashboardBootstrap(value: unknown): value is DashboardBootstrap {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.displayId !== 'string' || candidate.displayId.trim() === '') {
    return false;
  }

  if (typeof candidate.layout !== 'object' || candidate.layout === null) {
    return false;
  }

  const layout = candidate.layout as Record<string, unknown>;
  return (
    typeof layout.rows === 'number' &&
    typeof layout.columns === 'number' &&
    Number.isInteger(layout.rows) &&
    Number.isInteger(layout.columns) &&
    layout.rows > 0 &&
    layout.columns > 0
  );
}

function readViewport(): { width: number; height: number } {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Renders the diagnostic grid once. No resize / orientation listeners by design.
 */
function renderGrid(config: GridConfig): void {
  const viewport = readViewport();
  const geometry = calculateGridGeometry(viewport, config, SAFETY_MARGIN_PX);
  const cells = createGridCells(config);

  const root = document.getElementById('dashboard-root');
  if (!root) {
    throw new Error('Missing dashboard root element');
  }

  root.replaceChildren();

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.setProperty('--cell-size', `${geometry.cellSize}px`);
  grid.style.setProperty('--grid-gap', `${geometry.gap}px`);
  grid.style.setProperty('--grid-columns', String(config.columns));
  grid.style.setProperty('--grid-rows', String(config.rows));
  grid.style.left = `${geometry.offsetX}px`;
  grid.style.top = `${geometry.offsetY}px`;
  grid.style.width = `${geometry.gridWidth}px`;
  grid.style.height = `${geometry.gridHeight}px`;
  grid.setAttribute('role', 'grid');
  grid.setAttribute(
    'aria-label',
    `Dashboard grid ${config.columns} by ${config.rows}`,
  );

  for (const cell of cells) {
    const cellElement = document.createElement('div');
    cellElement.className = 'grid-cell';
    cellElement.dataset.cellId = cell.id;
    cellElement.dataset.row = String(cell.row);
    cellElement.dataset.column = String(cell.column);
    cellElement.setAttribute('role', 'gridcell');
    // Diagnostic label only — logical identity remains data-cell-id.
    cellElement.textContent = `${cell.row + 1},${cell.column + 1}`;
    grid.appendChild(cellElement);
  }

  root.appendChild(grid);
}

function main(): void {
  const bootstrap = readBootstrap();
  renderGrid(bootstrap.layout);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : 'Dashboard render failed';
  document.body.replaceChildren();
  const failure = document.createElement('p');
  failure.className = 'dashboard-fatal';
  failure.textContent = message;
  document.body.appendChild(failure);
}
