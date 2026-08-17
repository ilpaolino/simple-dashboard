import Homey from 'homey';
import { buildDisplaySnapshot } from '../../lib/device/buildDisplaySnapshot';
import {
  getDisplayId,
  isDisplayAppHost,
  isShellyHardwareAppHost,
} from '../../lib/device/DisplayAppHost';
import { ensureNotificationCapabilities } from '../../lib/device/notificationCapabilities';
import {
  ensureRediscoverHardwareCapability,
  REDISCOVER_HARDWARE_CAPABILITY_ID,
} from '../../lib/device/shellyHardwareCapabilities';
import { parseWallDisplayStore } from '../../lib/device/types';
import { validateDeviceSettingsChange } from '../../lib/device/settingsValidation';
import { DISPLAY_TYPE_IDS } from '../../lib/display/types';
import { AppLogger } from '../../lib/Logger';

/**
 * Shelly Wall Display device. Identity is Shelly hardware id in `data.id`.
 * @see https://apps-sdk-v3.developer.homey.app/Device.html
 */
class ShellyWallDisplayDevice extends Homey.Device {
  private logger!: AppLogger;

  public async onInit(): Promise<void> {
    this.logger = new AppLogger(this);
    await ensureNotificationCapabilities(this);
    await ensureRediscoverHardwareCapability(this);

    this.registerCapabilityListener(
      REDISCOVER_HARDWARE_CAPABILITY_ID,
      async () => {
        await this.runManualHardwareDiscovery();
      },
    );

    const snapshot = buildDisplaySnapshot({
      device: this,
      typeId: DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY,
    });

    this.logger.info('Shelly Wall Display device initialized', {
      id: snapshot?.displayId,
      ip: snapshot?.ipAddress,
      layout: snapshot?.layoutId,
    });

    if (snapshot && isDisplayAppHost(this.homey.app)) {
      this.homey.app.registerDisplay(snapshot);
      this.homey.app.syncNotificationCapabilities?.(snapshot.displayId);
      if (isShellyHardwareAppHost(this.homey.app)) {
        void this.homey.app
          .ensureShellyHardwareDiscovered?.(snapshot.displayId)
          .catch((error: unknown) => {
            this.logger.warn('Shelly hardware discovery after init failed', {
              displayId: snapshot.displayId,
              error,
            });
          });
      }
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
      const currentStore = this.getStore();
      pendingStore = {
        ...(typeof currentStore === 'object' && currentStore !== null
          ? (currentStore as Record<string, unknown>)
          : {}),
        configuration: result.updatedConfiguration,
      };
    }

    const snapshot = buildDisplaySnapshot({
      device: this,
      typeId: DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY,
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

  private async runManualHardwareDiscovery(): Promise<void> {
    const displayId = getDisplayId(this.getData());
    const app = this.homey.app;
    if (!displayId || !isShellyHardwareAppHost(app)) {
      throw new Error(this.homey.__('hardware.errors.rediscoveryFailed'));
    }

    this.logger.info('Manual Shelly hardware rediscovery requested', { displayId });

    try {
      await app.discoverShellyHardware(displayId);
      this.logger.info('Manual Shelly hardware rediscovery completed', { displayId });
    } catch (error) {
      this.logger.error('Manual Shelly hardware rediscovery failed', {
        displayId,
        error,
      });
      throw new Error(this.homey.__('hardware.errors.rediscoveryFailed'));
    }
  }
}

module.exports = ShellyWallDisplayDevice;
