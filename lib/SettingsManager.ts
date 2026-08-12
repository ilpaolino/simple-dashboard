import { parseHttpPort, InvalidPortError } from './port';
import {
  DEFAULT_DIAGNOSTICS_ENABLED,
  DEFAULT_HTTP_PORT,
  SETTINGS_KEYS,
  type HomeySettingsStore,
  type Logger,
} from './types';

export type HttpPortChangeListener = (port: number) => void | Promise<void>;
export type DiagnosticsEnabledChangeListener = (
  enabled: boolean,
) => void | Promise<void>;

/**
 * Owns Homey persistent settings access and change notifications.
 * @see https://apps-sdk-v3.developer.homey.app/ManagerSettings.html
 * @see https://apps.developer.homey.app/advanced/custom-views/app-settings
 */
export class SettingsManager {
  private readonly portListeners: HttpPortChangeListener[] = [];
  private readonly diagnosticsListeners: DiagnosticsEnabledChangeListener[] = [];

  public constructor(
    private readonly settings: HomeySettingsStore,
    private readonly logger: Logger,
  ) {
    this.settings.on('set', (key: string) => {
      if (key === SETTINGS_KEYS.HTTP_PORT) {
        void this.notifyPortChange();
        return;
      }

      if (key === SETTINGS_KEYS.DIAGNOSTICS_ENABLED) {
        void this.notifyDiagnosticsChange();
      }
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

  public isDiagnosticsEnabled(): boolean {
    const rawValue = this.settings.get(SETTINGS_KEYS.DIAGNOSTICS_ENABLED);
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return DEFAULT_DIAGNOSTICS_ENABLED;
    }

    if (typeof rawValue === 'boolean') {
      return rawValue;
    }

    if (rawValue === 'true' || rawValue === 1 || rawValue === '1') {
      return true;
    }

    if (rawValue === 'false' || rawValue === 0 || rawValue === '0') {
      return false;
    }

    this.logger.warn(
      'Invalid diagnosticsEnabled setting; falling back to default',
      { value: rawValue },
    );
    return DEFAULT_DIAGNOSTICS_ENABLED;
  }

  public ensureDefaults(): void {
    this.ensureDefaultPort();
    this.ensureDefaultDiagnostics();
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

  public ensureDefaultDiagnostics(): void {
    const rawValue = this.settings.get(SETTINGS_KEYS.DIAGNOSTICS_ENABLED);
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      this.settings.set(
        SETTINGS_KEYS.DIAGNOSTICS_ENABLED,
        DEFAULT_DIAGNOSTICS_ENABLED,
      );
      this.logger.info('Initialized default diagnostics setting', {
        diagnosticsEnabled: DEFAULT_DIAGNOSTICS_ENABLED,
      });
    }
  }

  public onHttpPortChange(listener: HttpPortChangeListener): void {
    this.portListeners.push(listener);
  }

  public onDiagnosticsEnabledChange(
    listener: DiagnosticsEnabledChangeListener,
  ): void {
    this.diagnosticsListeners.push(listener);
  }

  private async notifyPortChange(): Promise<void> {
    const port = this.getHttpPort();
    this.logger.info('HTTP port setting changed', { port });

    for (const listener of this.portListeners) {
      try {
        await listener(port);
      } catch (error) {
        this.logger.error('HTTP port change listener failed', error);
      }
    }
  }

  private async notifyDiagnosticsChange(): Promise<void> {
    const enabled = this.isDiagnosticsEnabled();
    this.logger.info('Diagnostics setting changed', { enabled });

    for (const listener of this.diagnosticsListeners) {
      try {
        await listener(enabled);
      } catch (error) {
        this.logger.error('Diagnostics change listener failed', error);
      }
    }
  }
}
