import Homey from 'homey';
import { buildDisplaySnapshot } from '../../lib/device/buildDisplaySnapshot';
import {
  getDisplayId,
  isDisplayAppHost,
} from '../../lib/device/DisplayAppHost';
import { parseWallDisplayStore } from '../../lib/device/types';
import { validateDeviceSettingsChange } from '../../lib/device/settingsValidation';
import { DISPLAY_TYPE_IDS } from '../../lib/display/types';
import { AppLogger } from '../../lib/Logger';

/**
 * Generic Web Display device. Identity is a generated UUID; IP is routing only.
 * @see https://apps-sdk-v3.developer.homey.app/Device.html
 */
class GenericWebDisplayDevice extends Homey.Device {
  private logger!: AppLogger;

  public async onInit(): Promise<void> {
    this.logger = new AppLogger(this);
    const snapshot = buildDisplaySnapshot({
      device: this,
      typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
    });

    this.logger.info('Generic Web Display device initialized', {
      id: snapshot?.displayId,
      ip: snapshot?.ipAddress,
      layout: snapshot?.layoutId,
    });

    if (snapshot && isDisplayAppHost(this.homey.app)) {
      this.homey.app.registerDisplay(snapshot);
    }
  }

  public async onSettings({
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<void> {
    const store = parseWallDisplayStore(this.getStore());
    const result = validateDeviceSettingsChange({
      changedKeys,
      newSettings,
      store,
    });

    if (!result.ok) {
      throw new Error(this.homey.__(result.errorKey));
    }

    let pendingStore: unknown = this.getStore();
    if (result.updatedConfiguration) {
      await this.setStoreValue('configuration', result.updatedConfiguration);
      pendingStore = {
        ...(typeof this.getStore() === 'object' && this.getStore() !== null
          ? (this.getStore() as Record<string, unknown>)
          : {}),
        configuration: result.updatedConfiguration,
      };
    }

    const snapshot = buildDisplaySnapshot({
      device: this,
      typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
      pendingSettings: newSettings,
      pendingStore,
    });

    if (snapshot && isDisplayAppHost(this.homey.app)) {
      this.homey.app.updateDisplay(snapshot);
    }
  }

  public async onDeleted(): Promise<void> {
    const displayId = getDisplayId(this.getData());
    if (displayId && isDisplayAppHost(this.homey.app)) {
      this.homey.app.unregisterDisplay(displayId);
    }
  }
}

module.exports = GenericWebDisplayDevice;
