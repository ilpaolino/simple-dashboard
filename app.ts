import sourceMapSupport from 'source-map-support';
import Homey from 'homey';
import { AppLogger } from './lib/Logger';
import { HttpServer } from './lib/HttpServer';
import { SettingsManager } from './lib/SettingsManager';
import { renderWelcomePage } from './lib/WelcomePage';

sourceMapSupport.install();

/**
 * Homey App entry point — wires lifecycle only.
 * @see https://apps-sdk-v3.developer.homey.app/App.html
 */
class WelcomeWallApp extends Homey.App {
  private logger!: AppLogger;
  private settingsManager!: SettingsManager;
  private httpServer!: HttpServer;

  public async onInit(): Promise<void> {
    this.logger = new AppLogger(this);
    this.settingsManager = new SettingsManager(this.homey.settings, this.logger);
    this.httpServer = new HttpServer({
      logger: this.logger,
      requestHandler: renderWelcomePage,
    });

    this.settingsManager.ensureDefaultPort();

    this.settingsManager.onHttpPortChange(async (port) => {
      try {
        await this.httpServer.restart(port);
      } catch (error) {
        this.logger.error('Failed to apply new HTTP port', error);
      }
    });

    const port = this.settingsManager.getHttpPort();
    try {
      await this.httpServer.start(port);
    } catch (error) {
      this.logger.error('HTTP server did not start during app init', error);
    }

    this.logger.info('Simple Dashboard app initialized');
  }

  public async onUninit(): Promise<void> {
    try {
      await this.httpServer.stop();
    } catch (error) {
      this.logger.error('HTTP server cleanup failed during app uninit', error);
    }

    this.logger.info('Simple Dashboard app uninitialized');
  }
}

module.exports = WelcomeWallApp;
