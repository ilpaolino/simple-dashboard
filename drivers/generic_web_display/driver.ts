import Homey from 'homey';
import { randomUUID } from 'node:crypto';
import { GenericWebDisplayAdapter } from '../../lib/adapters/GenericWebDisplayAdapter';
import { isGenericPairingAppHost } from '../../lib/device/DisplayAppHost';
import { AppLogger } from '../../lib/Logger';
import { GenericCodePairingFlow } from '../../lib/pairing/GenericCodePairingFlow';

/**
 * Generic Web Display driver — temporary pairing code resolves client IP.
 * @see https://apps.developer.homey.app/the-basics/devices
 */
class GenericWebDisplayDriver extends Homey.Driver {
  private logger!: AppLogger;

  public async onInit(): Promise<void> {
    this.logger = new AppLogger(this);
    this.logger.info('Generic Web Display driver initialized');
  }

  public async onPair(session: Homey.Driver.PairSession): Promise<void> {
    this.logger.info('Generic Web Display pairing session started');

    const app = this.homey.app;
    if (!isGenericPairingAppHost(app)) {
      throw new Error(this.homey.__('errors.pairingUnavailable'));
    }

    const flow = new GenericCodePairingFlow({
      pairingManager: app.getGenericPairingManager(),
      registry: app.displayRegistry,
      adapter: new GenericWebDisplayAdapter(),
      translate: (key: string) => this.homey.__(key),
      createId: () => randomUUID(),
      logger: this.logger,
    });

    flow.bind({
      setHandler: (event, handler) => {
        session.setHandler(event, async (data: unknown) => {
          this.logger.info('Generic pairing handler invoked', { event });
          try {
            const result = await handler(data);
            this.logger.info('Generic pairing handler completed', { event });
            return result;
          } catch (error) {
            this.logger.error('Generic pairing handler failed', { event, error });
            throw error;
          }
        });
      },
    });
  }
}

module.exports = GenericWebDisplayDriver;
