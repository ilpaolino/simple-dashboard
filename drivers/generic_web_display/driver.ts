import Homey from 'homey';
import { AdapterRegistry } from '../../lib/adapters/AdapterRegistry';
import { GenericWebDisplayAdapter } from '../../lib/adapters/GenericWebDisplayAdapter';
import { ADAPTER_IDS } from '../../lib/adapters/types';
import { AppLogger } from '../../lib/Logger';
import { PairingFlow } from '../../lib/pairing/PairingFlow';

/**
 * Generic Web Display driver — IP-only pairing, no Shelly protocol.
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

    const flow = new PairingFlow({
      registry: new AdapterRegistry([new GenericWebDisplayAdapter()]),
      mode: 'ip_only',
      adapterId: ADAPTER_IDS.GENERIC_WEB_DISPLAY,
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

module.exports = GenericWebDisplayDriver;
