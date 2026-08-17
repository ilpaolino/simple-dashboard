import Homey from 'homey';
import { AdapterRegistry } from '../../lib/adapters/AdapterRegistry';
import { ShellyWallDisplayAdapter } from '../../lib/adapters/ShellyWallDisplayAdapter';
import { ADAPTER_IDS } from '../../lib/adapters/types';
import { FetchJsonHttpClient } from '../../lib/http/JsonHttpClient';
import { AppLogger } from '../../lib/Logger';
import { PairingFlow } from '../../lib/pairing/PairingFlow';

interface WelcomeWallAppLike {
  discoverShellyHardwareAtPairing?(
    ipAddress: string,
  ): Promise<{
    readonly discoveryStatus: string;
    readonly rebootStatus: string;
    readonly rpcMethodCount: number;
    readonly warningKey: string | null;
  }>;
}

/**
 * Shelly Wall Display driver — pairing requires Shelly.GetDeviceInfo recognition.
 * @see https://apps.developer.homey.app/the-basics/devices
 * @see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly#shellygetdeviceinfo
 */
class ShellyWallDisplayDriver extends Homey.Driver {
  private logger!: AppLogger;

  public async onInit(): Promise<void> {
    this.logger = new AppLogger(this);
    this.logger.info('Shelly Wall Display driver initialized');
  }

  public async onPair(session: Homey.Driver.PairSession): Promise<void> {
    this.logger.info('Shelly Wall Display pairing session started');

    const app = this.homey.app as WelcomeWallAppLike;
    const translate = (key: string): string => this.homey.__(key);

    const flow = new PairingFlow({
      registry: new AdapterRegistry([
        new ShellyWallDisplayAdapter(new FetchJsonHttpClient()),
      ]),
      mode: 'identify_required',
      adapterId: ADAPTER_IDS.SHELLY_WALL_DISPLAY,
      translate,
      logger: this.logger,
      discoverHardware:
        typeof app.discoverShellyHardwareAtPairing === 'function'
          ? async (ip) => {
              const summary = await app.discoverShellyHardwareAtPairing!(ip);
              return {
                discoveryStatus: translate(
                  `hardware.discoveryStatus.${summary.discoveryStatus}`,
                ),
                rebootStatus: translate(
                  `hardware.featureStatus.${summary.rebootStatus}`,
                ),
                rpcMethodCount: summary.rpcMethodCount,
                warning: summary.warningKey ? translate(summary.warningKey) : null,
              };
            }
          : undefined,
    });

    flow.bind({
      setHandler: (event, handler) => {
        session.setHandler(event, async (data: unknown) => {
          this.logger.info('Pairing handler invoked', { event });
          try {
            const result = await handler(data);
            this.logger.info('Pairing handler completed', { event });
            return result;
          } catch (error) {
            this.logger.error('Pairing handler failed', { event, error });
            throw error;
          }
        });
      },
    });
  }
}

module.exports = ShellyWallDisplayDriver;
