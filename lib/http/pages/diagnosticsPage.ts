import type { DisplayRegistry } from '../../display/DisplayRegistry';
import type { DiagnosticsRecentError } from '../../display/types';
import { DISPLAY_TYPE_IDS } from '../../display/types';
import { formatGridSize, resolveLayoutId } from '../../dashboard/layoutParse';
import { widgetTypesInConfiguration } from '../../widgets';
import type { DisplayRealtimeSessionInfo } from '../../realtime/DisplayRealtimeSession';
import type { RealtimeMetricsSnapshot } from '../../realtime/RealtimeMetrics';
import type { SubscriptionDiagnostic } from '../../realtime/RealtimeSubscriptionManager';
import { escapeHtml, TECHNICAL_PAGE_STYLES } from './html';

export interface DiagnosticsRealtimeSection {
  readonly active: boolean;
  readonly metrics: RealtimeMetricsSnapshot;
  readonly sessions: readonly DisplayRealtimeSessionInfo[];
  readonly subscriptions: readonly SubscriptionDiagnostic[];
}

export interface DiagnosticsPageInput {
  readonly lang: string;
  readonly translate: (key: string) => string;
  readonly serverListening: boolean;
  readonly port: number | null;
  readonly uptimeSeconds: number;
  readonly registry: DisplayRegistry;
  readonly recentErrors: readonly DiagnosticsRecentError[];
  readonly realtime?: DiagnosticsRealtimeSection | null;
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

function formatTimestamp(
  value: Date | string | null | undefined,
  fallback: string,
): string {
  if (value instanceof Date) {
    try {
      if (!Number.isNaN(value.getTime())) {
        return value.toISOString();
      }
    } catch {
      return fallback;
    }
    return fallback;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  return fallback;
}

function readProcessMemory(): { readonly rss: number; readonly heapUsed: number } {
  try {
    const usage = process.memoryUsage();
    return { rss: usage.rss, heapUsed: usage.heapUsed };
  } catch {
    return { rss: 0, heapUsed: 0 };
  }
}

function lightErrorLabel(
  error: string | null,
  translate: (key: string) => string,
): string {
  if (!error) {
    return translate('pages.status.none');
  }
  switch (error) {
    case 'missing_device':
    case 'api_error':
      return translate('widgets.light.failedToLoadDevice');
    case 'missing_capability':
      return translate('widgets.light.missingOnoff');
    case 'unavailable':
      return translate('widgets.light.unavailable');
    case 'invalid_value':
      return translate('editor.errors.invalidConfig');
    default:
      return error;
  }
}

function coverErrorLabel(
  error: string | null,
  translate: (key: string) => string,
): string {
  if (!error) {
    return translate('pages.status.none');
  }
  switch (error) {
    case 'missing_device':
    case 'api_error':
      return translate('widgets.cover.failedToLoadDevice');
    case 'missing_capability':
      return translate('widgets.cover.missingCapability');
    case 'unavailable':
      return translate('widgets.cover.unavailable');
    case 'invalid_value':
      return translate('widgets.cover.invalidPosition');
    default:
      return error;
  }
}

export function renderDiagnosticsPage(input: DiagnosticsPageInput): string {
  const translate = (key: string): string => {
    try {
      const value = input.translate(key);
      return typeof value === 'string' && value.length > 0 ? value : key;
    } catch {
      return key;
    }
  };
  const t = translate;
  const now = input.now ?? new Date();
  const displays = input.registry.getAll();
  const metrics = input.realtime?.metrics;
  const memory = readProcessMemory();
  const never = t('pages.status.never');
  const none = t('pages.status.none');

  const summaryRows = [
    {
      label: t('pages.diagnostics.server'),
      value: input.serverListening
        ? t('pages.diagnostics.serverListening')
        : t('pages.diagnostics.serverStopped'),
    },
    {
      label: t('pages.diagnostics.websocketServer'),
      value: input.realtime?.active
        ? t('pages.diagnostics.websocketActive')
        : t('pages.diagnostics.websocketInactive'),
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
      label: t('pages.diagnostics.activeConnections'),
      value: String(metrics?.activeConnections ?? 0),
    },
    {
      label: t('pages.diagnostics.activeSubscriptions'),
      value: String(metrics?.activeSubscriptions ?? 0),
    },
    {
      label: t('pages.diagnostics.activePendingCommands'),
      value: String(metrics?.activePendingCommands ?? 0),
    },
    {
      label: t('pages.diagnostics.displayCount'),
      value: String(displays.length),
    },
    {
      label: t('pages.diagnostics.memoryRss'),
      value: formatBytes(memory.rss),
    },
    {
      label: t('pages.diagnostics.memoryHeap'),
      value: formatBytes(memory.heapUsed),
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
      try {
        const online = input.registry.getOnlineStatus(entry.config.displayId, now);
        const runtime = entry.runtime;
        const dashboard = entry.config.dashboard;
        const widgets = Array.isArray(dashboard?.widgets) ? dashboard.widgets : [];
        const lastSeen = formatTimestamp(runtime?.lastSeenAt, never);
        const connectionId = runtime?.realtimeConnectionId ?? none;
        const connectedAt = formatTimestamp(runtime?.realtimeConnectedAt, never);
        const lastHeartbeat = formatTimestamp(runtime?.realtimeLastHeartbeatAt, never);
        const lastRendered = formatTimestamp(runtime?.lastRenderedAt, never);
        const layoutError = runtime?.lastLayoutErrorKey
          ? t(runtime.lastLayoutErrorKey)
          : none;
        const dashboardError = runtime?.lastDashboardErrorKey
          ? t(runtime.lastDashboardErrorKey)
          : none;
        const lastDashboardLoaded = formatTimestamp(
          runtime?.lastDashboardLoadedAt,
          never,
        );
        const widgetTypes = widgetTypesInConfiguration({
          version: dashboard?.version ?? 1,
          widgets,
        });
        const widgetTypesLabel =
          widgetTypes.length === 0 ? none : widgetTypes.join(', ');
        return `<tr>
        <td>${escapeHtml(entry.config.name)}</td>
        <td>${escapeHtml(typeLabel(entry.config.typeId, t))}</td>
        <td>${escapeHtml(entry.config.ipAddress)}</td>
        <td>${escapeHtml(t(`pages.status.${online}`))}</td>
        <td>${escapeHtml(connectionId)}</td>
        <td>${escapeHtml(connectedAt)}</td>
        <td>${escapeHtml(lastHeartbeat)}</td>
        <td>${escapeHtml(String(runtime?.realtimeReconnectCount ?? 0))}</td>
        <td>${escapeHtml(String(runtime?.realtimeSubscribedDeviceCount ?? 0))}</td>
        <td>${escapeHtml(lastSeen)}</td>
        <td>${escapeHtml(entry.config.layoutId)}</td>
        <td>${escapeHtml(gridSizeLabel(entry.config.layoutId, t))}</td>
        <td>${escapeHtml(String(widgets.length))}</td>
        <td>${escapeHtml(widgetTypesLabel)}</td>
        <td>${escapeHtml(lastRendered)}</td>
        <td>${escapeHtml(lastDashboardLoaded)}</td>
        <td>${escapeHtml(layoutError)}</td>
        <td>${escapeHtml(dashboardError)}</td>
        <td>${escapeHtml(matchLabel(runtime?.lastMatchStatus ?? null, t))}</td>
        <td>${escapeHtml(entry.config.hardwareId ?? t('device.notAvailable'))}</td>
      </tr>`;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'row_failed';
        const id = entry?.config?.displayId ?? 'unknown';
        return `<tr><td colspan="20">${escapeHtml(id)}: ${escapeHtml(message)}</td></tr>`;
      }
    })
    .join('\n');

  const recentErrors = Array.isArray(input.recentErrors) ? input.recentErrors : [];
  const errorsHtml =
    recentErrors.length === 0
      ? `<p>${escapeHtml(t('pages.diagnostics.noErrors'))}</p>`
      : `<ul>${recentErrors
          .map((error) => {
            const parts = [
              formatTimestamp(error?.at, never),
              t(error?.messageKey ?? 'pages.diagnostics.error'),
              error?.ipAddress ? `IP ${error.ipAddress}` : null,
              error?.displayId ? `id ${error.displayId}` : null,
            ].filter((part): part is string => part !== null);
            return `<li>${escapeHtml(parts.join(' — '))}</li>`;
          })
          .join('')}</ul>`;

  const lightRows = displays.flatMap((entry) => {
    try {
      const diagnostics = Array.isArray(entry?.runtime?.lastLightWidgetDiagnostics)
        ? entry.runtime.lastLightWidgetDiagnostics
        : [];
      return diagnostics.flatMap((item) => {
        if (!item || typeof item !== 'object') {
          return [];
        }
        const lastOnOff =
          item.on === null
            ? none
            : item.on
              ? t('widgets.light.on')
              : t('widgets.light.off');
        return [`<tr>
        <td>${escapeHtml(entry.config.name)}</td>
        <td>${escapeHtml(item.widgetId)}</td>
        <td>${escapeHtml(item.deviceId)}</td>
        <td>${escapeHtml(item.resolved ? t('pages.diagnostics.yes') : t('pages.diagnostics.no'))}</td>
        <td>${escapeHtml(item.hasOnoff ? t('pages.diagnostics.yes') : t('pages.diagnostics.no'))}</td>
        <td>${escapeHtml(item.available ? t('pages.diagnostics.yes') : t('pages.diagnostics.no'))}</td>
        <td>${escapeHtml(lastOnOff)}</td>
        <td>${escapeHtml(lightErrorLabel(item.error, t))}</td>
      </tr>`];
      });
    } catch {
      return [];
    }
  });

  const lightTable =
    lightRows.length === 0
      ? `<p>${escapeHtml(t('pages.diagnostics.noLightWidgets'))}</p>`
      : `<table>
      <thead>
        <tr>
          <th>${escapeHtml(t('pages.recognized.name'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.widgetId'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.deviceId'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.deviceResolved'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.hasOnoff'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.availability'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.lastOnOff'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.error'))}</th>
        </tr>
      </thead>
      <tbody>
        ${lightRows.join('\n')}
      </tbody>
    </table>`;

  const coverRows = displays.flatMap((entry) => {
    try {
      const diagnostics = Array.isArray(entry?.runtime?.lastCoverWidgetDiagnostics)
        ? entry.runtime.lastCoverWidgetDiagnostics
        : [];
      return diagnostics.flatMap((item) => {
        if (!item || typeof item !== 'object') {
          return [];
        }
        const raw =
          item.rawValue === null || item.rawValue === undefined
            ? none
            : String(item.rawValue);
        const percent =
          item.positionPercent === null || item.positionPercent === undefined
            ? none
            : `${item.positionPercent}%`;
        return [`<tr>
        <td>${escapeHtml(entry.config.name)}</td>
        <td>${escapeHtml(item.widgetId)}</td>
        <td>${escapeHtml(item.deviceId)}</td>
        <td>${escapeHtml(item.resolved ? t('pages.diagnostics.yes') : t('pages.diagnostics.no'))}</td>
        <td>${escapeHtml(item.hasWindowcoveringsSet ? t('pages.diagnostics.yes') : t('pages.diagnostics.no'))}</td>
        <td>${escapeHtml(item.canStop ? t('pages.diagnostics.yes') : t('pages.diagnostics.no'))}</td>
        <td>${escapeHtml(item.available ? t('pages.diagnostics.yes') : t('pages.diagnostics.no'))}</td>
        <td>${escapeHtml(raw)}</td>
        <td>${escapeHtml(percent)}</td>
        <td>${escapeHtml(coverErrorLabel(item.error, t))}</td>
      </tr>`];
      });
    } catch {
      return [];
    }
  });

  const coverTable =
    coverRows.length === 0
      ? `<p>${escapeHtml(t('pages.diagnostics.noCoverWidgets'))}</p>`
      : `<table>
      <thead>
        <tr>
          <th>${escapeHtml(t('pages.recognized.name'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.widgetId'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.deviceId'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.deviceResolved'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.hasWindowcoveringsSet'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.canStop'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.availability'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.rawValue'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.normalizedPercent'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.error'))}</th>
        </tr>
      </thead>
      <tbody>
        ${coverRows.join('\n')}
      </tbody>
    </table>`;

  const realtimeMetricsHtml = !metrics
    ? `<p>${escapeHtml(t('pages.diagnostics.noRealtime'))}</p>`
    : `<dl>
      <dt>${escapeHtml(t('pages.diagnostics.connectionsOpened'))}</dt><dd>${escapeHtml(String(metrics.connectionsOpened ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.connectionsClosed'))}</dt><dd>${escapeHtml(String(metrics.connectionsClosed ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.activeConnections'))}</dt><dd>${escapeHtml(String(metrics.activeConnections ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.reconnects'))}</dt><dd>${escapeHtml(String(metrics.reconnects ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.messagesSent'))}</dt><dd>${escapeHtml(String(metrics.messagesSent ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.messagesReceived'))}</dt><dd>${escapeHtml(String(metrics.messagesReceived ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.activeSubscriptions'))}</dt><dd>${escapeHtml(String(metrics.activeSubscriptions ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.rejectedConnections'))}</dt><dd>${escapeHtml(String(metrics.rejectedConnections ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.heartbeatTimeouts'))}</dt><dd>${escapeHtml(String(metrics.heartbeatTimeouts ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.commandsReceived'))}</dt><dd>${escapeHtml(String(metrics.commandsReceived ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.commandsAccepted'))}</dt><dd>${escapeHtml(String(metrics.commandsAccepted ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.commandsRejected'))}</dt><dd>${escapeHtml(String(metrics.commandsRejected ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.commandsSucceeded'))}</dt><dd>${escapeHtml(String(metrics.commandsSucceeded ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.commandsFailed'))}</dt><dd>${escapeHtml(String(metrics.commandsFailed ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.commandsTimedOut'))}</dt><dd>${escapeHtml(String(metrics.commandsTimedOut ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.activePendingCommands'))}</dt><dd>${escapeHtml(String(metrics.activePendingCommands ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.coverCommandsReceived'))}</dt><dd>${escapeHtml(String(metrics.coverCommandsReceived ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.coverSetPositionCommands'))}</dt><dd>${escapeHtml(String(metrics.coverSetPositionCommands ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.coverOpenCommands'))}</dt><dd>${escapeHtml(String(metrics.coverOpenCommands ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.coverCloseCommands'))}</dt><dd>${escapeHtml(String(metrics.coverCloseCommands ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.coverStopCommands'))}</dt><dd>${escapeHtml(String(metrics.coverStopCommands ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.coverCommandsAccepted'))}</dt><dd>${escapeHtml(String(metrics.coverCommandsAccepted ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.coverCommandsRejected'))}</dt><dd>${escapeHtml(String(metrics.coverCommandsRejected ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.coverCommandsFailed'))}</dt><dd>${escapeHtml(String(metrics.coverCommandsFailed ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.coverCommandsTimedOut'))}</dt><dd>${escapeHtml(String(metrics.coverCommandsTimedOut ?? 0))}</dd>
      <dt>${escapeHtml(t('pages.diagnostics.coverPendingCommands'))}</dt><dd>${escapeHtml(String(metrics.coverPendingCommands ?? 0))}</dd>
    </dl>`;

  const recentCommands = Array.isArray(metrics?.recentCommands)
    ? metrics.recentCommands
    : [];
  const recentCommandsHtml =
    recentCommands.length === 0
      ? `<p>${escapeHtml(t('pages.diagnostics.noRecentCommands'))}</p>`
      : `<table>
      <thead>
        <tr>
          <th>${escapeHtml(t('pages.diagnostics.widgetId'))}</th>
          <th>${escapeHtml(t('pages.recognized.name'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.commandAction'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.capabilityId'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.commandTarget'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.commandStatus'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.commandDuration'))}</th>
        </tr>
      </thead>
      <tbody>
        ${recentCommands
          .map((item) => {
            if (!item || typeof item !== 'object') {
              return '';
            }
            const target =
              item.expectedValue === undefined || item.expectedValue === null
                ? none
                : String(item.expectedValue);
            const baseline =
              item.baselineValue === null || item.baselineValue === undefined
                ? none
                : String(item.baselineValue);
            return `<tr>
          <td>${escapeHtml(item.widgetId)}</td>
          <td>${escapeHtml(item.displayId)}</td>
          <td>${escapeHtml(item.action)}</td>
          <td>${escapeHtml(item.capabilityId ?? none)}</td>
          <td>${escapeHtml(`${baseline} → ${target}`)}</td>
          <td>${escapeHtml(item.status)}</td>
          <td>${escapeHtml(`${item.durationMs}ms`)}</td>
        </tr>`;
          })
          .join('\n')}
      </tbody>
    </table>`;

  const subscriptions = Array.isArray(input.realtime?.subscriptions)
    ? input.realtime.subscriptions
    : [];
  const subscriptionRows = subscriptions.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return [];
    }
    return [`<tr>
        <td>${escapeHtml(item.deviceId)}</td>
        <td>${escapeHtml(item.capabilityId)}</td>
        <td>${escapeHtml(String(item.refCount))}</td>
        <td>${escapeHtml(String(item.displayIds?.length ?? 0))}</td>
        <td>${escapeHtml(item.subscribed ? t('pages.diagnostics.yes') : t('pages.diagnostics.no'))}</td>
        <td>${escapeHtml((item.displayIds ?? []).join(', ') || none)}</td>
      </tr>`];
  });

  const subscriptionsHtml =
    subscriptionRows.length === 0
      ? `<p>${escapeHtml(t('pages.diagnostics.noSubscriptions'))}</p>`
      : `<table>
      <thead>
        <tr>
          <th>${escapeHtml(t('pages.diagnostics.deviceId'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.capabilityId'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.refCount'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.interestedDisplays'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.subscriptionActive'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.displayIds'))}</th>
        </tr>
      </thead>
      <tbody>
        ${subscriptionRows.join('\n')}
      </tbody>
    </table>`;

  // Wide diagnostics tables need more than the default technical-page width.
  const diagnosticsStyles = `${TECHNICAL_PAGE_STYLES}
main { width: min(96rem, 100%); overflow-x: auto; }
`;

  return `<!DOCTYPE html>
<html lang="${escapeHtml(input.lang)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(t('pages.diagnostics.title'))}</title>
  <style>
${diagnosticsStyles}
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
          <th>${escapeHtml(t('pages.diagnostics.connectionId'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.connectedAt'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.lastHeartbeat'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.reconnectCount'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.subscribedDevices'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.lastSeen'))}</th>
          <th>${escapeHtml(t('pages.recognized.layout'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.gridSize'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.widgetCount'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.widgetTypes'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.lastRendered'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.lastDashboardLoaded'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.layoutError'))}</th>
          <th>${escapeHtml(t('pages.diagnostics.dashboardError'))}</th>
          <th>${escapeHtml(t('pages.recognized.status'))}</th>
          <th>${escapeHtml(t('pages.recognized.hardwareId'))}</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows || `<tr><td colspan="20">${escapeHtml(t('pages.diagnostics.noDisplays'))}</td></tr>`}
      </tbody>
    </table>
    <h1 style="margin-top:2rem;font-size:1.25rem;">${escapeHtml(t('pages.diagnostics.lightWidgets'))}</h1>
    ${lightTable}
    <h1 style="margin-top:2rem;font-size:1.25rem;">${escapeHtml(t('pages.diagnostics.coverWidgets'))}</h1>
    ${coverTable}
    <h1 style="margin-top:2rem;font-size:1.25rem;">${escapeHtml(t('pages.diagnostics.realtimeMetrics'))}</h1>
    ${realtimeMetricsHtml}
    <h1 style="margin-top:2rem;font-size:1.25rem;">${escapeHtml(t('pages.diagnostics.recentCommands'))}</h1>
    ${recentCommandsHtml}
    <h1 style="margin-top:2rem;font-size:1.25rem;">${escapeHtml(t('pages.diagnostics.subscriptions'))}</h1>
    ${subscriptionsHtml}
    <h1 style="margin-top:2rem;font-size:1.25rem;">${escapeHtml(t('pages.diagnostics.recentErrors'))}</h1>
    ${errorsHtml}
  </main>
</body>
</html>`;
}
