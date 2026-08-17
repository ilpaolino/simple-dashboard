import { buildPairingDevice } from '../device/pairingPayload';
import type { HomeyPairingDevice } from '../device/types';
import type { DisplayRegistry } from '../display/DisplayRegistry';
import { normalizeClientIp } from '../display/ipNormalize';
import type { Logger } from '../types';
import type { GenericDisplayPairingManager } from './GenericDisplayPairingManager';
import { normalizePairingCode } from './GenericDisplayPairingManager';
import type { GenericDisplayPairingSession } from './types';
import type { WallDisplayAdapter } from '../adapters/types';

export interface GenericCodePairingPreview {
  readonly ipAddress: string;
  readonly adapterName: string;
  readonly expiresAt: string;
}

export interface GenericCodePairingSessionPort {
  setHandler(
    event: string,
    handler: (data: unknown) => Promise<unknown>,
  ): void;
}

export interface GenericCodePairingFlowOptions {
  readonly pairingManager: GenericDisplayPairingManager;
  readonly registry: DisplayRegistry;
  readonly adapter: WallDisplayAdapter;
  readonly translate: (key: string) => string;
  readonly createId?: () => string;
  readonly logger?: Logger;
  readonly onPairingConsumed?: (code: string) => void;
}

/**
 * Homey pairing orchestration for Generic Web Display via temporary numeric code.
 */
export class GenericCodePairingFlow {
  private validatedSession: GenericDisplayPairingSession | null = null;

  public constructor(private readonly options: GenericCodePairingFlowOptions) {}

  public bind(session: GenericCodePairingSessionPort): void {
    session.setHandler('validate_code', async (data) => this.validateCode(data));
    session.setHandler('get_pairing_preview', async () => this.getPreview());
    session.setHandler('get_pairing_device', async () => this.getPairingDevice());
    session.setHandler('consume_pairing', async () => this.consumePairing());
  }

  private validateCode(data: unknown): { readonly ok: true } {
    const code = parseCodePayload(data);
    const result = this.options.pairingManager.validateCode(code);

    if (!result.ok) {
      const key =
        result.reason === 'expired'
          ? 'errors.pairingCodeExpired'
          : 'errors.pairingCodeInvalid';
      throw new Error(this.options.translate(key));
    }

    if (this.isIpTaken(result.ipAddress)) {
      throw new Error(this.options.translate('errors.pairingIpTaken'));
    }

    const session = this.options.pairingManager.lookupByCode(code);
    if (!session) {
      throw new Error(this.options.translate('errors.pairingCodeExpired'));
    }

    this.validatedSession = session;
    this.log('info', 'Generic pairing code accepted', {
      ipAddress: session.ipAddress,
    });
    return { ok: true };
  }

  private getPreview(): GenericCodePairingPreview {
    const session = this.requireValidatedSession();
    return {
      ipAddress: session.ipAddress,
      adapterName: this.options.translate(this.options.adapter.nameKey),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  private getPairingDevice(): HomeyPairingDevice {
    const session = this.requireValidatedSession();

    if (this.isIpTaken(session.ipAddress)) {
      throw new Error(this.options.translate('errors.pairingIpTaken'));
    }

    const device = buildPairingDevice({
      ip: session.ipAddress,
      adapter: this.options.adapter,
      adapterName: this.options.translate(this.options.adapter.nameKey),
      adapterAutoDetected: false,
      notAvailable: this.options.translate('device.notAvailable'),
      defaultName: this.options.translate('device.defaultNameGeneric'),
      createId: this.options.createId,
    });

    this.log('info', 'Generic pairing device payload ready', {
      id: device.data.id,
      ip: device.settings.ip,
    });

    return device;
  }

  private consumePairing(): { readonly ok: true } {
    const session = this.requireValidatedSession();
    const consumed = this.options.pairingManager.consume(session.code);
    if (!consumed) {
      throw new Error(this.options.translate('errors.pairingCodeExpired'));
    }
    this.options.onPairingConsumed?.(session.code);
    this.validatedSession = null;
    this.log('info', 'Generic pairing successful', {
      ipAddress: session.ipAddress,
    });
    return { ok: true };
  }

  private requireValidatedSession(): GenericDisplayPairingSession {
    if (!this.validatedSession) {
      throw new Error(this.options.translate('errors.pairingCodeInvalid'));
    }

    const stillValid = this.options.pairingManager.lookupByCode(
      this.validatedSession.code,
    );
    if (!stillValid) {
      this.validatedSession = null;
      throw new Error(this.options.translate('errors.pairingCodeExpired'));
    }

    return stillValid;
  }

  private isIpTaken(ipAddress: string): boolean {
    const normalized = normalizeClientIp(ipAddress);
    return this.options.registry.findByIp(normalized) !== null;
  }

  private log(
    level: 'info' | 'warn' | 'error',
    message: string,
    details?: Record<string, unknown>,
  ): void {
    const logger = this.options.logger;
    if (!logger) {
      return;
    }
    if (details) {
      logger[level](message, details);
      return;
    }
    logger[level](message);
  }
}

function parseCodePayload(data: unknown): string {
  if (typeof data !== 'object' || data === null) {
    throw new Error('invalid_code');
  }

  const code = (data as Record<string, unknown>).code;
  const normalized = normalizePairingCode(code);
  if (!normalized) {
    throw new Error('invalid_code');
  }
  return normalized;
}
