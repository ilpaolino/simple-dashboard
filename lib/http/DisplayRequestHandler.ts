import type { AdapterRegistry } from '../adapters/AdapterRegistry';
import { DISPLAY_TYPE_IDS } from '../display/types';
import type { DisplayRegistry } from '../display/DisplayRegistry';
import { normalizeClientIp } from '../display/ipNormalize';
import { verifyHardwareIdentity } from '../display/hardwareIdentity';
import type { DiagnosticsLog } from '../diagnostics/DiagnosticsLog';
import type { HttpResponse, Logger, RequestInfo } from '../types';
import { renderDiagnosticsPage } from './pages/diagnosticsPage';
import {
  renderDiagnosticsDisabledPage,
  renderMismatchPage,
  renderProbeFailedPage,
  renderRecognizedPage,
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
}

/**
 * Routes LAN HTTP requests for recognition and diagnostics.
 * Dashboard rendering is intentionally out of scope.
 */
export class DisplayRequestHandler {
  public constructor(private readonly options: DisplayRequestHandlerOptions) {}

  public async handle(info: RequestInfo): Promise<HttpResponse> {
    const path = pathOnly(info.url);

    if (info.method !== 'GET') {
      return textResponse(405, 'Method Not Allowed');
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

    this.options.registry.touch(config.displayId, clientIp);
    this.options.registry.setMatchResult(config.displayId, 'recognized');

    this.options.logger.info('Display recognized', {
      displayId: config.displayId,
      typeId: config.typeId,
      clientIp,
    });

    return htmlResponse(
      200,
      renderRecognizedPage({
        lang,
        translate,
        display: config,
        typeLabel: typeLabel(config.typeId, translate),
        timestamp: info.timestamp,
        matchStatus: 'recognized',
      }),
    );
  }
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
