import type { DisplayRegistry } from '../../display/DisplayRegistry';
import { resolveOnlineStatus } from '../../display/onlineStatus';
import type { DiagnosticsRecentError } from '../../display/types';
import { DISPLAY_TYPE_IDS } from '../../display/types';
import { formatGridSize, resolveLayoutId } from '../../dashboard/layoutParse';
import { escapeHtml, TECHNICAL_PAGE_STYLES } from './html';

export interface DiagnosticsPageInput {
  readonly lang: string;
  readonly translate: (key: string) => string;
  readonly serverListening: boolean;
  readonly port: number | null;
  readonly uptimeSeconds: number;
  readonly registry: DisplayRegistry;
  readonly recentErrors: readonly DiagnosticsRecentError[];
  readonly now?: Date;
}

function typeLabel(
  typeId: string,
  translate: (key: string) => string,
): string {
  if (typeId === DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY) {
    return translate('adapters.shelly_wall_display');
  }
  if (typeId === DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY) {
    return translate('adapters.generic_web_display');
  }
  return typeId;
}

function matchLabel(
  status: string | null,
  translate: (key: string) => string,
): string {
  if (!status) {
    return translate('pages.status.none');
  }
  return translate(`pages.status.${status}`);
}

function gridSizeLabel(
  layoutId: string,
  translate: (key: string) => string,
): string {
  const resolved = resolveLayoutId(layoutId);
  if (!resolved.ok) {
    return translate('pages.status.invalidLayout');
  }
  return formatGridSize(resolved.config);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return '—';
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MiB`;
}

export function renderDiagnosticsPage(input: DiagnosticsPageInput): string {
  const t = input.translate;
  const now = input.now ?? new Date();
  const displays = input.registry.getAll();

  const summaryRows = [
    {
      label: t('pages.diagnostics.server'),
      value: input.serverListening
        ? t('pages.diagnostics.serverListening')
        : t('pages.diagnostics.serverStopped'),
    },
    {
      label: t('pages.diagnostics.port'),
      value: input.port === null ? t('device.notAvailable') : String(input.port),
    },
    {
      label: t('pages.diagnostics.uptime'),
      value: `${Math.floor(input.uptimeSeconds)}s`,
    },
    {
      label: t('pages.diagnostics.displayCount'),
      value: String(displays.length),
    },
    {
      label: t('pages.diagnostics.memoryRss'),
      value: formatBytes(process.memoryUsage().rss),
    },
    {
      label: t('pages.diagnostics.memoryHeap'),
      value: formatBytes(process.memoryUsage().heapUsed),
    },
  ];

  const summaryHtml = summaryRows
    .map(
      (row) =>
        `<dt>${escapeHtml(row.label)}</dt><dd>${escapeHtml(row.value)}</dd>`,
    )
    .join('\n      ');

  const tableRows = displays
    .map((entry) => {
      const online = resolveOnlineStatus(entry.runtime.lastSeenAt, now);
      const lastSeen = entry.runtime.lastSeenAt
        ? entry.runtime.lastSeenAt.toISOString()
        : t('pages.status.never');
      const lastRendered = entry.runtime.lastRenderedAt
        ? entry.runtime.lastRenderedAt.toISOString()
        : t('pages.status.never');
      const layoutError = entry.runtime.lastLayoutErrorKey
        ? t(entry.runtime.lastLayoutErrorKey)
        : t('pages.status.none');
      return `<tr>
        <td>${escapeHtml(entry.config.name)}</td>
        <td>${escapeHtml(typeLabel(entry.config.typeId, t))}</td>
        <td>${escapeHtml(entry.config.ipAddress)}</td>
        <td>${escapeHtml(t(`pages.status.${online}`))}</td>
        <td>${escapeHtml(lastSeen)}</td>
        <td>${escapeHtml(entry.config.layoutId)}</td>
        <td>${escapeHtml(gridSizeLabel(entry.config.layoutId, t))}</td>
        <td>${escapeHtml(lastRendered)}</td>
        <td>${escapeHtml(layoutError)}</td>
        <td>${escapeHtml(matchLabel(entry.runtime.lastMatchStatus, t))}</td>
        <td>${escapeHtml(entry.config.hardwareId ?? t('device.notAvailable'))}</td>
      </tr>`;
    })
    .join('\n');

  const errorsHtml =
    input.recentErrors.length === 0
      ? `<p>${escapeHtml(t('pages.diagnostics.noErrors'))}</p>`
      : `<ul>${input.recentErrors
          .map((error) => {
            const parts = [
              error.at.toISOString(),
              t(error.messageKey),
              error.ipAddress ? `IP ${error.ipAddress}` : null,
              error.displayId ? `id ${error.displayId}` : null,
            ].filter((part): part is string => part !== null);
            return `<li>${escapeHtml(parts.join(' — '))}</li>`;
          })
          .join('')}</ul>`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(input.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(t('pages.diagnostics.title'))}</title>
  <style>
${TECHNICAL_PAGE_STYLES}
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(t('pages.diagnostics.heading'))}</h1>
    <p>${escapeHtml(t('pages.diagnostics.lead'))}</p>
    <dl>
      ${summaryHtml}
    </dl>
    <h1 style="margin-top:2rem;font-size:1.25rem;">${escapeHtml(t('pages.diagnostics.displays'))}</h1>
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(t('pages.recognized.name'))}</th>
          <th>${escapeHtml(t('pages.recognized.type'))}</th>
          <th>${escapeHtml(t('pages.recognized.ip'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.online'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.lastSeen'))}</th>
          <th>${escapeHtml(t('pages.recognized.layout'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.gridSize'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.lastRendered'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.layoutError'))}</th>
          <th>${escapeHtml(t('pages.recognized.status'))}</th>
          <th>${escapeHtml(t('pages.recognized.hardwareId'))}</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || `<tr><td colspan="11">${escapeHtml(t('pages.diagnostics.noDisplays'))}</td></tr>`}
      </tbody>
    </table>
    <h1 style="margin-top:2rem;font-size:1.25rem;">${escapeHtml(t('pages.diagnostics.recentErrors'))}</h1>
    ${errorsHtml}
  </main>
</body>
</html>`;
}
