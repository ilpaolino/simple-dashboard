import sourceMapSupport from 'source-map-support';
import Homey from 'homey';
import { createDefaultAdapterRegistry } from './lib/adapters/AdapterRegistry';
import { resolveLayoutId } from './lib/dashboard/layoutParse';
import { DiagnosticsLog } from './lib/diagnostics/DiagnosticsLog';
import { DisplayRegistry } from './lib/display/DisplayRegistry';
import type { DisplaySnapshot } from './lib/display/types';
import {
  buildDisplaySnapshot,
  DASHBOARD_STORE_KEY,
} from './lib/device/buildDisplaySnapshot';
import { DISPLAY_TYPE_IDS } from './lib/display/types';
import { DisplayRequestHandler } from './lib/http/DisplayRequestHandler';
import { HttpServer } from './lib/HttpServer';
import { AppLogger } from './lib/Logger';
import { SettingsManager } from './lib/SettingsManager';
import {
  createDefaultWidgetRegistry,
  parseDashboardConfiguration,
  validateDashboardConfiguration,
  widgetTypesInConfiguration,
  type DashboardConfiguration,
  type PlacementValidationError,
} from './lib/widgets';

sourceMapSupport.install();

/**
 * Homey App entry point — wires lifecycle, HTTP routing, DisplayRegistry, and editor API.
 * @see https://apps-sdk-v3.developer.homey.app/App.html
 */
class WelcomeWallApp extends Homey.App {
  private logger!: AppLogger;
  private settingsManager!: SettingsManager;
  private httpServer!: HttpServer;
  private requestHandler!: DisplayRequestHandler;
  private readonly widgetRegistry = createDefaultWidgetRegistry();

  public readonly displayRegistry = new DisplayRegistry();
  public readonly diagnosticsLog = new DiagnosticsLog();

  public async onInit(): Promise<void> {
    this.logger = new AppLogger(this);
    this.settingsManager = new SettingsManager(this.homey.settings, this.logger);

    const adapters = createDefaultAdapterRegistry();
    this.requestHandler = new DisplayRequestHandler({
      registry: this.displayRegistry,
      adapters,
      diagnosticsLog: this.diagnosticsLog,
      logger: this.logger,
      translate: (key: string) => this.homey.__(key),
      getLanguage: () => this.homey.i18n.getLanguage(),
      isDiagnosticsEnabled: () => this.settingsManager.isDiagnosticsEnabled(),
      isServerListening: () => this.httpServer.isListening(),
      getPort: () => this.httpServer.getPort(),
      getUptimeSeconds: () => this.httpServer.getUptimeSeconds(),
    });

    this.httpServer = new HttpServer({
      logger: this.logger,
      requestHandler: (info) => this.requestHandler.handle(info),
    });

    this.settingsManager.ensureDefaults();

    this.settingsManager.onHttpPortChange(async (port) => {
      try {
        await this.httpServer.restart(port);
      } catch (error) {
        this.logger.error('Failed to apply new HTTP port', error);
      }
    });

    this.settingsManager.onDiagnosticsEnabledChange((enabled) => {
      this.logger.info('Diagnostics availability updated', { enabled });
    });

    const port = this.settingsManager.getHttpPort();
    try {
      await this.httpServer.start(port);
    } catch (error) {
      this.logger.error('HTTP server did not start during app init', error);
    }

    this.logger.info('Simple Dashboard app initialized', {
      diagnosticsEnabled: this.settingsManager.isDiagnosticsEnabled(),
    });
  }

  public registerDisplay(snapshot: DisplaySnapshot): void {
    this.displayRegistry.upsert(snapshot);
    this.logger.info('Display registered in runtime registry', {
      displayId: snapshot.displayId,
      typeId: snapshot.typeId,
      ip: snapshot.ipAddress,
    });
  }

  public unregisterDisplay(displayId: string): void {
    this.displayRegistry.remove(displayId);
    this.logger.info('Display removed from runtime registry', { displayId });
  }

  public updateDisplay(snapshot: DisplaySnapshot): void {
    this.displayRegistry.upsert(snapshot);
    this.logger.info('Display updated in runtime registry', {
      displayId: snapshot.displayId,
      ip: snapshot.ipAddress,
      layout: snapshot.layoutId,
    });
  }

  public async listDisplaysForEditor(): Promise<readonly EditorDisplaySummary[]> {
    const summaries: EditorDisplaySummary[] = [];

    for (const device of this.listWallDisplayDevices()) {
      const typeId = resolveTypeIdForDriver(device.driver.id);
      if (!typeId) {
        continue;
      }

      const snapshot = buildDisplaySnapshot({ device, typeId });
      if (!snapshot) {
        continue;
      }

      const layout = resolveLayoutId(snapshot.layoutId);
      summaries.push({
        displayId: snapshot.displayId,
        name: snapshot.name,
        typeId: snapshot.typeId,
        layoutId: snapshot.layoutId,
        rows: layout.ok ? layout.config.rows : 0,
        columns: layout.ok ? layout.config.columns : 0,
        widgetCount: snapshot.dashboard.widgets.length,
      });
    }

    summaries.sort((left, right) => left.name.localeCompare(right.name));
    return summaries;
  }

  public async getDashboardForEditor(
    displayId: string,
  ): Promise<EditorDashboardPayload> {
    const device = this.findWallDisplayDevice(displayId);
    if (!device) {
      throw new Error(this.homey.__('editor.errors.displayNotFound'));
    }

    const typeId = resolveTypeIdForDriver(device.driver.id);
    if (!typeId) {
      throw new Error(this.homey.__('editor.errors.displayNotFound'));
    }

    const snapshot = buildDisplaySnapshot({ device, typeId });
    if (!snapshot) {
      throw new Error(this.homey.__('editor.errors.displayNotFound'));
    }

    const layout = resolveLayoutId(snapshot.layoutId);
    if (!layout.ok) {
      throw new Error(this.homey.__('pages.invalidLayout.heading'));
    }

    return {
      displayId: snapshot.displayId,
      name: snapshot.name,
      layoutId: snapshot.layoutId,
      grid: layout.config,
      dashboard: snapshot.dashboard,
      widgetTypes: this.widgetRegistry.list().map((definition) => ({
        type: definition.type,
        name: this.homey.__(definition.nameKey),
        allowedSpans: definition.allowedSpans,
        defaultConfig: definition.defaultConfig,
      })),
    };
  }

  public async saveDashboardForEditor(
    displayId: string,
    body: unknown,
  ): Promise<{ readonly ok: true; readonly dashboard: DashboardConfiguration }> {
    const device = this.findWallDisplayDevice(displayId);
    if (!device) {
      throw new Error(this.homey.__('editor.errors.displayNotFound'));
    }

    const typeId = resolveTypeIdForDriver(device.driver.id);
    if (!typeId) {
      throw new Error(this.homey.__('editor.errors.displayNotFound'));
    }

    const snapshot = buildDisplaySnapshot({ device, typeId });
    if (!snapshot) {
      throw new Error(this.homey.__('editor.errors.displayNotFound'));
    }

    const layout = resolveLayoutId(snapshot.layoutId);
    if (!layout.ok) {
      throw new Error(this.homey.__('pages.invalidLayout.heading'));
    }

    const parsed = parseDashboardConfiguration(body, {
      registry: this.widgetRegistry,
    });
    if (!parsed.ok) {
      this.logger.warn('Rejected dashboard save: invalid payload', {
        displayId,
        error: parsed.error,
      });
      throw new Error(this.homey.__(errorKeyForValidation(parsed.error)));
    }

    const validation = validateDashboardConfiguration({
      grid: layout.config,
      configuration: parsed.configuration,
      registry: this.widgetRegistry,
    });

    if (!validation.ok) {
      this.logger.warn('Rejected dashboard save: validation failed', {
        displayId,
        error: validation.error,
        widgetId: validation.widgetId,
      });
      throw new Error(this.homey.__(errorKeyForValidation(validation.error)));
    }

    await device.setStoreValue(DASHBOARD_STORE_KEY, parsed.configuration);

    const updated = buildDisplaySnapshot({
      device,
      typeId,
      pendingDashboard: parsed.configuration,
    });
    if (updated) {
      this.updateDisplay(updated);
      this.displayRegistry.markDashboardError(displayId, null);
    }

    this.logger.info('Dashboard configuration saved', {
      displayId,
      widgetCount: parsed.configuration.widgets.length,
      types: widgetTypesInConfiguration(parsed.configuration),
    });

    return { ok: true, dashboard: parsed.configuration };
  }

  public async onUninit(): Promise<void> {
    try {
      await this.httpServer.stop();
    } catch (error) {
      this.logger.error('HTTP server cleanup failed during app uninit', error);
    }

    this.displayRegistry.clear();
    this.diagnosticsLog.clear();
    this.logger.info('Simple Dashboard app uninitialized');
  }

  private listWallDisplayDevices(): Homey.Device[] {
    const devices: Homey.Device[] = [];
    for (const driverId of Object.values(DISPLAY_TYPE_IDS)) {
      try {
        const driver = this.homey.drivers.getDriver(driverId);
        devices.push(...driver.getDevices());
      } catch {
        // Driver may be unavailable during early init.
      }
    }
    return devices;
  }

  private findWallDisplayDevice(displayId: string): Homey.Device | null {
    for (const device of this.listWallDisplayDevices()) {
      const data = device.getData() as { id?: unknown };
      if (typeof data.id === 'string' && data.id === displayId) {
        return device;
      }
    }
    return null;
  }
}

interface EditorDisplaySummary {
  readonly displayId: string;
  readonly name: string;
  readonly typeId: string;
  readonly layoutId: string;
  readonly rows: number;
  readonly columns: number;
  readonly widgetCount: number;
}

interface EditorDashboardPayload {
  readonly displayId: string;
  readonly name: string;
  readonly layoutId: string;
  readonly grid: { readonly rows: number; readonly columns: number };
  readonly dashboard: DashboardConfiguration;
  readonly widgetTypes: readonly {
    readonly type: string;
    readonly name: string;
    readonly allowedSpans: readonly {
      readonly rowSpan: number;
      readonly columnSpan: number;
    }[];
    readonly defaultConfig: unknown;
  }[];
}

function resolveTypeIdForDriver(
  driverId: string,
): DisplaySnapshot['typeId'] | null {
  if (driverId === DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY) {
    return DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY;
  }
  if (driverId === DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY) {
    return DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY;
  }
  return null;
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

module.exports = WelcomeWallApp;
