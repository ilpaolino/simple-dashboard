import type { DashboardBootstrap } from '../lib/dashboard/index';
import { isWidgetTypeId } from '../lib/widgets/registry';
import { isTitleWidgetConfig } from '../lib/widgets/title/definition';
import { isDateTimeWidgetConfig } from '../lib/widgets/date-time/definition';
import type { WidgetInstance, WidgetPlacement } from '../lib/widgets/types';
import { isDashboardTheme } from '../lib/widgets/types';
import { DashboardRenderer } from './layout/DashboardRenderer';

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

  if (typeof candidate.displayName !== 'string' || candidate.displayName.trim() === '') {
    return false;
  }

  if (typeof candidate.typeLabel !== 'string' || candidate.typeLabel.trim() === '') {
    return false;
  }

  if (typeof candidate.layoutId !== 'string' || candidate.layoutId.trim() === '') {
    return false;
  }

  if (typeof candidate.locale !== 'string' || candidate.locale.trim() === '') {
    return false;
  }

  if (typeof candidate.layout !== 'object' || candidate.layout === null) {
    return false;
  }

  const layout = candidate.layout as Record<string, unknown>;
  if (
    typeof layout.rows !== 'number' ||
    typeof layout.columns !== 'number' ||
    !Number.isInteger(layout.rows) ||
    !Number.isInteger(layout.columns) ||
    layout.rows <= 0 ||
    layout.columns <= 0
  ) {
    return false;
  }

  if (!Array.isArray(candidate.widgets)) {
    return false;
  }

  if (!isEmptyStateCopy(candidate.emptyState)) {
    return false;
  }

  if (!isDashboardTheme(candidate.theme)) {
    return false;
  }

  return candidate.widgets.every(isWidgetInstance);
}

function isEmptyStateCopy(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.heading === 'string' &&
    typeof candidate.lead === 'string' &&
    typeof candidate.nameLabel === 'string' &&
    typeof candidate.typeLabel === 'string' &&
    typeof candidate.idLabel === 'string' &&
    typeof candidate.layoutLabel === 'string' &&
    typeof candidate.gridLabel === 'string'
  );
}

function isWidgetInstance(value: unknown): value is WidgetInstance {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    return false;
  }

  if (!isWidgetTypeId(candidate.type)) {
    return false;
  }

  if (!isPlacement(candidate.placement)) {
    return false;
  }

  if (candidate.type === 'title') {
    return isTitleWidgetConfig(candidate.config);
  }

  return isDateTimeWidgetConfig(candidate.config);
}

function isPlacement(value: unknown): value is WidgetPlacement {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.row === 'number' &&
    typeof candidate.column === 'number' &&
    typeof candidate.rowSpan === 'number' &&
    typeof candidate.columnSpan === 'number'
  );
}

function main(): void {
  const bootstrap = readBootstrap();
  const root = document.getElementById('dashboard-root');
  if (!root) {
    throw new Error('Missing dashboard root element');
  }

  const renderer = new DashboardRenderer(root);
  renderer.applyBootstrap(bootstrap);
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
