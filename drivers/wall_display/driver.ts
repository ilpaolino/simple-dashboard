import Homey from 'homey';
import { createDefaultAdapterRegistry } from '../../lib/adapters/AdapterRegistry';
import { AppLogger } from '../../lib/Logger';
import { PairingFlow } from '../../lib/pairing/PairingFlow';

/**
 * Wall Display driver — pairing only in this milestone.
 * @see https://apps.developer.homey.app/the-basics/devices
 * @see https://apps.developer.homey.app/advanced/custom-views/custom-pairing-views
 */
class WallDisplayDriver extends Homey.Driver {
  private logger!: AppLogger;

  public async onInit(): Promise<void> {
    this.logger = new AppLogger(this);
    this.logger.info('Wall Display driver initialized');
  }

  public async onPair(session: Homey.Driver.PairSession): Promise<void> {
    this.logger.info('Wall Display pairing session started');

    const flow = new PairingFlow({
      registry: createDefaultAdapterRegistry(),
      translate: (key: string) => this.homey.__(key),
      logger: this.logger,
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

module.exports = WallDisplayDriver;
