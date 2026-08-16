import type { DashboardBootstrap } from '../lib/dashboard/index';
import { isWidgetTypeId } from '../lib/widgets/registry';
import { isTitleWidgetConfig } from '../lib/widgets/title/definition';
import { isDateTimeWidgetConfig } from '../lib/widgets/date-time/definition';
import { isLightWidgetConfig } from '../lib/widgets/light/definition';
import { isCoverWidgetConfig } from '../lib/widgets/cover/definition';
import type { WidgetInstance, WidgetPlacement } from '../lib/widgets/types';
import { isDashboardTheme } from '../lib/widgets/types';
import { DashboardRenderer } from './layout/DashboardRenderer';
import { RealtimeClient } from './realtime/RealtimeClient';

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

  if (!isDashboardCopy(candidate.copy)) {
    return false;
  }

  if (!isWidgetRuntimeMap(candidate.widgetRuntime)) {
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

function isDashboardCopy(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.widgetFailed !== 'string') {
    return false;
  }

  if (typeof candidate.light !== 'object' || candidate.light === null) {
    return false;
  }

  const light = candidate.light as Record<string, unknown>;
  if (
    typeof light.on !== 'string' ||
    typeof light.off !== 'string' ||
    typeof light.unavailable !== 'string' ||
    typeof light.commandInProgress !== 'string' ||
    typeof light.commandFailed !== 'string' ||
    typeof light.commandTimeout !== 'string'
  ) {
    return false;
  }

  if (typeof candidate.cover !== 'object' || candidate.cover === null) {
    return false;
  }

  const cover = candidate.cover as Record<string, unknown>;
  if (
    typeof cover.unavailable !== 'string' ||
    typeof cover.invalidPosition !== 'string' ||
    typeof cover.name !== 'string' ||
    typeof cover.open !== 'string' ||
    typeof cover.close !== 'string' ||
    typeof cover.stop !== 'string' ||
    typeof cover.currentPosition !== 'string' ||
    typeof cover.targetPosition !== 'string' ||
    typeof cover.moveToPosition !== 'string' ||
    typeof cover.commandInProgress !== 'string' ||
    typeof cover.commandFailed !== 'string' ||
    typeof cover.commandTimeout !== 'string' ||
    typeof cover.openControl !== 'string' ||
    typeof cover.closeControl !== 'string'
  ) {
    return false;
  }

  if (typeof candidate.realtime !== 'object' || candidate.realtime === null) {
    return false;
  }

  const realtime = candidate.realtime as Record<string, unknown>;
  if (
    !(
      typeof realtime.connectionLost === 'string' &&
      typeof realtime.reconnecting === 'string' &&
      typeof realtime.connectionRestored === 'string' &&
      typeof realtime.realtimeUnavailable === 'string' &&
      typeof realtime.protocolError === 'string' &&
      typeof realtime.displaySessionInvalid === 'string' &&
      typeof realtime.snapshotFailed === 'string' &&
      typeof realtime.homeyConnectionError === 'string'
    )
  ) {
    return false;
  }

  if (
    typeof candidate.notifications !== 'object' ||
    candidate.notifications === null
  ) {
    return false;
  }

  const notifications = candidate.notifications as Record<string, unknown>;
  return (
    typeof notifications.title === 'string' &&
    typeof notifications.openCenter === 'string' &&
    typeof notifications.close === 'string' &&
    typeof notifications.hide === 'string' &&
    typeof notifications.dismiss === 'string' &&
    typeof notifications.previous === 'string' &&
    typeof notifications.next === 'string' &&
    typeof notifications.noNotifications === 'string' &&
    typeof notifications.severityCritical === 'string' &&
    typeof notifications.severityWarning === 'string' &&
    typeof notifications.severitySuccess === 'string' &&
    typeof notifications.severityInfo === 'string' &&
    typeof notifications.position === 'string'
  );
}

function isWidgetRuntimeMap(value: unknown): boolean {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

  if (candidate.type === 'date-time') {
    return isDateTimeWidgetConfig(candidate.config);
  }

  if (candidate.type === 'light') {
    return isLightWidgetConfig(candidate.config);
  }

  return isCoverWidgetConfig(candidate.config);
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

  const realtime = new RealtimeClient({
    renderer,
    copy: bootstrap.copy,
  });
  realtime.start();
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
