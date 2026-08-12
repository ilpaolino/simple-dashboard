import Homey from 'homey';
import { AppLogger } from '../../lib/Logger';
import { parseWallDisplayStore } from '../../lib/device/types';
import { validateDeviceSettingsChange } from '../../lib/device/settingsValidation';

/**
 * Wall Display device. Identity lives in `data.id`; IP is a setting.
 * @see https://apps-sdk-v3.developer.homey.app/Device.html
 * @see https://apps.developer.homey.app/the-basics/devices/settings
 */
class WallDisplayDevice extends Homey.Device {
  private logger!: AppLogger;

  public async onInit(): Promise<void> {
    this.logger = new AppLogger(this);

    const data = this.getData() as { id?: unknown };
    const settings = this.getSettings() as Record<string, unknown>;
    const store = parseWallDisplayStore(this.getStore());

    this.logger.info('Wall Display device initialized', {
      id: typeof data.id === 'string' ? data.id : undefined,
      ip: settings.ip,
      adapterId: store?.adapterId,
      layout: settings.layout,
    });
  }

  public async onSettings({
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<void> {
    const result = validateDeviceSettingsChange({
      changedKeys,
      newSettings,
      store: parseWallDisplayStore(this.getStore()),
    });

    if (!result.ok) {
      throw new Error(this.homey.__(result.errorKey));
    }

    if (result.updatedConfiguration) {
      await this.setStoreValue('configuration', result.updatedConfiguration);
    }
  }
}

module.exports = WallDisplayDevice;
