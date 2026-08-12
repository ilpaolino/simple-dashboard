import sourceMapSupport from 'source-map-support';
import Homey from 'homey';
import { createDefaultAdapterRegistry } from './lib/adapters/AdapterRegistry';
import { DiagnosticsLog } from './lib/diagnostics/DiagnosticsLog';
import { DisplayRegistry } from './lib/display/DisplayRegistry';
import type { DisplaySnapshot } from './lib/display/types';
import { DisplayRequestHandler } from './lib/http/DisplayRequestHandler';
import { HttpServer } from './lib/HttpServer';
import { AppLogger } from './lib/Logger';
import { SettingsManager } from './lib/SettingsManager';

sourceMapSupport.install();

/**
 * Homey App entry point — wires lifecycle, HTTP routing, and DisplayRegistry.
 * @see https://apps-sdk-v3.developer.homey.app/App.html
 */
class WelcomeWallApp extends Homey.App {
  private logger!: AppLogger;
  private settingsManager!: SettingsManager;
  private httpServer!: HttpServer;
  private requestHandler!: DisplayRequestHandler;

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
}

module.exports = WelcomeWallApp;
