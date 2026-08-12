import { parseHttpPort, InvalidPortError } from './port';
import {
  DEFAULT_HTTP_PORT,
  SETTINGS_KEYS,
  type HomeySettingsStore,
  type Logger,
} from './types';

export type HttpPortChangeListener = (port: number) => void | Promise<void>;

/**
 * Owns Homey persistent settings access and change notifications.
 * @see https://apps-sdk-v3.developer.homey.app/ManagerSettings.html
 * @see https://apps.developer.homey.app/advanced/custom-views/app-settings
 */
export class SettingsManager {
  private readonly listeners: HttpPortChangeListener[] = [];

  public constructor(
    private readonly settings: HomeySettingsStore,
    private readonly logger: Logger,
  ) {
    this.settings.on('set', (key: string) => {
      if (key !== SETTINGS_KEYS.HTTP_PORT) {
        return;
      }

      void this.notifyPortChange();
    });
  }

  public getHttpPort(): number {
    const rawValue = this.settings.get(SETTINGS_KEYS.HTTP_PORT);

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return DEFAULT_HTTP_PORT;
    }

    try {
      return parseHttpPort(rawValue);
    } catch (error) {
      if (error instanceof InvalidPortError) {
        this.logger.error(
          'Invalid HTTP port in settings; falling back to default',
          {
            value: rawValue,
            defaultPort: DEFAULT_HTTP_PORT,
          },
        );
        return DEFAULT_HTTP_PORT;
      }

      throw error;
    }
  }

  public ensureDefaultPort(): void {
    const rawValue = this.settings.get(SETTINGS_KEYS.HTTP_PORT);
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      this.settings.set(SETTINGS_KEYS.HTTP_PORT, DEFAULT_HTTP_PORT);
      this.logger.info('Initialized default HTTP port setting', {
        port: DEFAULT_HTTP_PORT,
      });
    }
  }

  public onHttpPortChange(listener: HttpPortChangeListener): void {
    this.listeners.push(listener);
  }

  private async notifyPortChange(): Promise<void> {
    const port = this.getHttpPort();
    this.logger.info('HTTP port setting changed', { port });

    for (const listener of this.listeners) {
      try {
        await listener(port);
      } catch (error) {
        this.logger.error('HTTP port change listener failed', error);
      }
    }
  }
}
