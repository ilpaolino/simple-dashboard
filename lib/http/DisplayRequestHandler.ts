import type { AdapterRegistry } from '../adapters/AdapterRegistry';
import {
  createDashboardBootstrap,
  createDashboardUiCopy,
  createEmptyStateCopy,
} from '../dashboard';
import { formatGridSize, resolveLayoutId } from '../dashboard/layoutParse';
import type { DisplayRegistry } from '../display/DisplayRegistry';
import { normalizeClientIp } from '../display/ipNormalize';
import { verifyHardwareIdentity } from '../display/hardwareIdentity';
import { DISPLAY_TYPE_IDS } from '../display/types';
import type { DiagnosticsLog } from '../diagnostics/DiagnosticsLog';
import type { HttpResponse, Logger, RequestInfo } from '../types';
import {
  resolveDashboardRuntime,
  validateDashboardConfiguration,
  type PlacementValidationError,
} from '../widgets';
import type { HomeyDeviceRepository } from '../homey/HomeyDeviceRepository';
import { DashboardAssetStore } from './DashboardAssetStore';
import { renderDiagnosticsPage } from './pages/diagnosticsPage';
import {
  renderDashboardPage,
  renderInvalidLayoutPage,
} from './pages/dashboardPage';
import {
  renderDiagnosticsDisabledPage,
  renderMismatchPage,
  renderProbeFailedPage,
  renderUnconfiguredPage,
} from './pages/displayPages';

export interface DisplayRequestHandlerOptions {
  readonly registry: DisplayRegistry;
  readonly adapters: AdapterRegistry;
  readonly diagnosticsLog: DiagnosticsLog;
  readonly logger: Logger;
  readonly translate: (key: string) => string;
  readonly getLanguage: () => string;
  readonly isDiagnosticsEnabled: () => boolean;
  readonly isServerListening: () => boolean;
  readonly getPort: () => number | null;
  readonly getUptimeSeconds: () => number;
  readonly assets?: DashboardAssetStore;
  readonly deviceRepository?: HomeyDeviceRepository | null;
}

/**
 * Routes LAN HTTP requests for recognition, dashboard bootstrap, and diagnostics.
 */
export class DisplayRequestHandler {
  private readonly assets: DashboardAssetStore;

  public constructor(private readonly options: DisplayRequestHandlerOptions) {
    this.assets = options.assets ?? new DashboardAssetStore();
  }

  public async handle(info: RequestInfo): Promise<HttpResponse> {
    const path = pathOnly(info.url);

    if (info.method !== 'GET') {
      return textResponse(405, 'Method Not Allowed');
    }

    if (path === '/dashboard.css') {
      return this.assets.tryGet('dashboard.css') ?? textResponse(404, 'Not Found');
    }

    if (path === '/dashboard.js') {
      return this.assets.tryGet('dashboard.js') ?? textResponse(404, 'Not Found');
    }

    if (path === '/diagnostics') {
      return this.handleDiagnostics();
    }

    if (path === '/' || path === '') {
      return this.handleRoot(info);
    }

    return textResponse(404, 'Not Found');
  }

  private handleDiagnostics(): HttpResponse {
    const lang = this.options.getLanguage();
    const translate = this.options.translate;

    if (!this.options.isDiagnosticsEnabled()) {
      return htmlResponse(
        403,
        renderDiagnosticsDisabledPage({ lang, translate }),
      );
    }

    return htmlResponse(
      200,
      renderDiagnosticsPage({
        lang,
        translate,
        serverListening: this.options.isServerListening(),
        port: this.options.getPort(),
        uptimeSeconds: this.options.getUptimeSeconds(),
        registry: this.options.registry,
        recentErrors: this.options.diagnosticsLog.list(),
      }),
    );
  }

  private async handleRoot(info: RequestInfo): Promise<HttpResponse> {
    const lang = this.options.getLanguage();
    const translate = this.options.translate;
    const clientIp = normalizeClientIp(info.clientIp);
    const entry = this.options.registry.findByIp(clientIp);

    if (!entry) {
      this.options.logger.info('Root request from unconfigured display', {
        clientIp,
      });
      return htmlResponse(
        200,
        renderUnconfiguredPage({
          lang,
          translate,
          clientIp,
          userAgent: info.userAgent,
          timestamp: info.timestamp,
        }),
      );
    }

    const { config } = entry;

    if (config.hardwareId) {
      const adapter = this.options.adapters.getById(config.typeId);
      const identity = await verifyHardwareIdentity({
        adapter,
        ipAddress: config.ipAddress,
        expectedHardwareId: config.hardwareId,
      });

      if (identity.kind === 'mismatch') {
        this.options.registry.setMatchResult(
          config.displayId,
          'hardware_mismatch',
          'pages.mismatch.heading',
        );
        this.options.diagnosticsLog.record({
          at: new Date(),
          messageKey: 'pages.mismatch.heading',
          displayId: config.displayId,
          ipAddress: clientIp,
        });
        this.options.logger.warn('Hardware identity mismatch', {
          displayId: config.displayId,
          expectedId: identity.expectedId,
          actualId: identity.actualId,
          clientIp,
        });

        return htmlResponse(
          200,
          renderMismatchPage({
            lang,
            translate,
            clientIp,
            expectedId: identity.expectedId,
            actualId: identity.actualId,
            timestamp: info.timestamp,
          }),
        );
      }

      if (identity.kind === 'unavailable') {
        this.options.registry.setMatchResult(
          config.displayId,
          'probe_failed',
          'pages.probeFailed.heading',
        );
        this.options.diagnosticsLog.record({
          at: new Date(),
          messageKey: 'pages.probeFailed.heading',
          displayId: config.displayId,
          ipAddress: clientIp,
        });
        this.options.logger.warn('Hardware identity probe failed', {
          displayId: config.displayId,
          clientIp,
        });

        return htmlResponse(
          200,
          renderProbeFailedPage({
            lang,
            translate,
            clientIp,
            displayName: config.name,
            timestamp: info.timestamp,
          }),
        );
      }
    }

    const layout = resolveLayoutId(config.layoutId);
    if (!layout.ok) {
      this.options.registry.setMatchResult(
        config.displayId,
        'recognized',
        'pages.invalidLayout.heading',
      );
      this.options.registry.markLayoutError(
        config.displayId,
        'pages.invalidLayout.heading',
      );
      this.options.diagnosticsLog.record({
        at: new Date(),
        messageKey: 'pages.invalidLayout.heading',
        displayId: config.displayId,
        ipAddress: clientIp,
      });
      this.options.logger.error('Invalid display layout configuration', {
        displayId: config.displayId,
        layoutId: config.layoutId,
        clientIp,
      });

      return htmlResponse(
        200,
        renderInvalidLayoutPage({ lang, translate }),
      );
    }

    this.options.registry.touch(config.displayId, clientIp);
    this.options.registry.setMatchResult(config.displayId, 'recognized');

    const dashboardValidation = validateDashboardConfiguration({
      grid: layout.config,
      configuration: config.dashboard,
    });

    if (!dashboardValidation.ok) {
      this.options.registry.markDashboardError(
        config.displayId,
        errorKeyForValidation(dashboardValidation.error),
      );
      this.options.diagnosticsLog.record({
        at: new Date(),
        messageKey: errorKeyForValidation(dashboardValidation.error),
        displayId: config.displayId,
        ipAddress: clientIp,
      });
      this.options.logger.warn('Invalid dashboard widget configuration', {
        displayId: config.displayId,
        error: dashboardValidation.error,
        widgetId: dashboardValidation.widgetId,
        clientIp,
      });
    } else {
      this.options.registry.markDashboardError(config.displayId, null);
    }

    this.options.registry.markDashboardRendered(config.displayId);

    const widgets = dashboardValidation.ok
      ? config.dashboard.widgets
      : [];

    const runtime = await resolveDashboardRuntime({
      widgets,
      repository: this.options.deviceRepository ?? null,
      logger: this.options.logger,
    });

    this.options.registry.markLightWidgetDiagnostics(
      config.displayId,
      runtime.diagnostics,
    );

    const bootstrap = createDashboardBootstrap({
      displayId: config.displayId,
      displayName: config.name,
      typeLabel: typeLabelForDisplay(config.typeId, translate),
      layoutId: config.layoutId,
      layout: layout.config,
      widgets,
      widgetRuntime: runtime.states,
      theme: config.dashboard.theme,
      locale: this.options.getLanguage(),
      emptyState: createEmptyStateCopy(translate),
      copy: createDashboardUiCopy(translate),
    });

    this.options.logger.info('Display dashboard rendered', {
      displayId: config.displayId,
      typeId: config.typeId,
      layoutId: config.layoutId,
      grid: formatGridSize(layout.config),
      widgetCount: widgets.length,
      clientIp,
    });

    return htmlResponse(
      200,
      renderDashboardPage({
        lang,
        title: translate('pages.dashboard.title'),
        bootstrap,
      }),
    );
  }
}

function typeLabelForDisplay(
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

function pathOnly(url: string): string {
  const noQuery = url.split('?', 1)[0] ?? '/';
  return noQuery === '' ? '/' : noQuery;
}

function htmlResponse(statusCode: number, body: string): HttpResponse {
  return {
    statusCode,
    contentType: 'text/html; charset=utf-8',
    body,
  };
}

function textResponse(statusCode: number, body: string): HttpResponse {
  return {
    statusCode,
    contentType: 'text/plain; charset=utf-8',
    body,
  };
}

function errorKeyForValidation(error: PlacementValidationError): string {
  switch (error) {
    case 'out_of_bounds':
      return 'editor.errors.outOfBounds';
    case 'overlap':
      return 'editor.errors.overlap';
    case 'unsupported_span':
      return 'editor.errors.unsupportedSpan';
    case 'invalid_placement':
      return 'editor.errors.invalidPosition';
    case 'unknown_type':
      return 'editor.errors.unknownType';
    case 'duplicate_id':
      return 'editor.errors.duplicateId';
    case 'invalid_config':
    default:
      return 'editor.errors.invalidConfig';
  }
}