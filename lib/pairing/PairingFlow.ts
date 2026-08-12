import type { AdapterRegistry } from '../adapters/AdapterRegistry';
import { UnknownAdapterError } from '../adapters/AdapterRegistry';
import type { IdentifyResult, WallDisplayAdapter } from '../adapters/types';
import { buildPairingDevice } from '../device/pairingPayload';
import type { AdapterChoice, HomeyPairingDevice, PairingDetectedInfoView } from '../device/types';
import { toDetectedInfoView } from '../device/types';
import { InvalidIpError, parseIpv4 } from '../ip/ipv4';
import type { Logger } from '../types';

export type PairingNextView = 'confirm' | 'select_adapter';

export interface ProbeResult {
  readonly ok: true;
  readonly ip: string;
  readonly nextView: PairingNextView;
}

export interface PairingSessionPort {
  setHandler(
    event: string,
    handler: (data: unknown) => Promise<unknown>,
  ): void;
}

export interface PairingFlowOptions {
  readonly registry: AdapterRegistry;
  readonly translate: (key: string) => string;
  readonly createId?: () => string;
  readonly logger?: Logger;
}

interface SetIpPayload {
  readonly ip: string;
}

interface SelectAdapterPayload {
  readonly adapterId: string;
}

/**
 * Pairing orchestration for the Wall Display driver.
 * Views stay in Homey HTML; this class owns protocol-agnostic session state.
 *
 * Identification runs via the `probe` handler (not the system `loading` view)
 * so the frontend can choose confirm vs select_adapter without Homey advancing
 * to the next pair-array entry automatically.
 */
export class PairingFlow {
  private ip: string | null = null;
  private identifyResult: IdentifyResult | null = null;
  private selectedAdapter: WallDisplayAdapter | null = null;

  public constructor(private readonly options: PairingFlowOptions) {}

  public bind(session: PairingSessionPort): void {
    session.setHandler('probe', async (data: unknown) => this.probe(data));
    session.setHandler('list_adapters', async () => this.listAdapters());
    session.setHandler('get_detected_info', async () => this.getDetectedInfo());
    session.setHandler('select_adapter', async (data: unknown) => this.selectAdapter(data));
    session.setHandler('get_pairing_device', async () => this.getPairingDevice());
  }

  private async probe(data: unknown): Promise<ProbeResult> {
    const ip = this.parseIpOrThrow(data);
    this.ip = ip;
    this.identifyResult = null;
    this.selectedAdapter = null;

    this.log('info', 'Pairing probe started', { ip });

    this.identifyResult = await this.options.registry.identify(ip);

    if (this.identifyResult.kind === 'matched') {
      this.selectedAdapter = this.identifyResult.adapter;
      this.log('info', 'Pairing probe matched adapter', {
        ip,
        adapterId: this.identifyResult.adapter.id,
        model: this.identifyResult.info.model,
      });
      return { ok: true, ip, nextView: 'confirm' };
    }

    this.log('info', 'Pairing probe unrecognized; manual adapter selection required', {
      ip,
    });
    return { ok: true, ip, nextView: 'select_adapter' };
  }

  private listAdapters(): AdapterChoice[] {
    return this.options.registry.getAll().map((adapter) => ({
      id: adapter.id,
      name: this.options.translate(adapter.nameKey),
    }));
  }

  private getDetectedInfo(): PairingDetectedInfoView {
    if (this.identifyResult?.kind !== 'matched') {
      throw new Error(this.options.translate('errors.deviceNotIdentified'));
    }

    return toDetectedInfoView(
      this.identifyResult.info,
      this.options.translate(this.identifyResult.adapter.nameKey),
      this.options.translate('device.notAvailable'),
    );
  }

  private selectAdapter(data: unknown): { ok: true; adapterId: string } {
    try {
      const payload = parseSelectAdapterPayload(data);
      this.selectedAdapter = this.options.registry.getById(payload.adapterId);
    } catch (error) {
      if (error instanceof UnknownAdapterError) {
        throw new Error(this.options.translate('errors.unknownAdapter'));
      }
      throw error;
    }

    this.log('info', 'Pairing adapter selected manually', {
      adapterId: this.selectedAdapter.id,
      ip: this.ip,
    });

    return { ok: true, adapterId: this.selectedAdapter.id };
  }

  private getPairingDevice(): HomeyPairingDevice {
    if (!this.ip) {
      throw new Error(this.options.translate('errors.invalidIp'));
    }

    const adapter = this.selectedAdapter;
    if (!adapter) {
      throw new Error(this.options.translate('errors.unknownAdapter'));
    }

    const matched =
      this.identifyResult?.kind === 'matched' &&
      this.identifyResult.adapter.id === adapter.id
        ? this.identifyResult
        : null;

    const device = buildPairingDevice({
      ip: this.ip,
      adapter,
      adapterName: this.options.translate(adapter.nameKey),
      adapterAutoDetected: matched !== null,
      info: matched?.info,
      notAvailable: this.options.translate('device.notAvailable'),
      defaultName: this.options.translate('device.defaultName'),
      createId: this.options.createId,
    });

    this.log('info', 'Pairing device payload ready', {
      id: device.data.id,
      adapterId: device.store.adapterId,
      ip: device.settings.ip,
    });

    return device;
  }

  private parseIpOrThrow(data: unknown): string {
    try {
      const payload = parseSetIpPayload(data);
      return parseIpv4(payload.ip);
    } catch (error) {
      if (error instanceof InvalidIpError) {
        throw new Error(this.options.translate('errors.invalidIp'));
      }
      throw error;
    }
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

function parseSetIpPayload(data: unknown): SetIpPayload {
  if (typeof data !== 'object' || data === null) {
    throw new InvalidIpError(data);
  }

  const candidate = data as Record<string, unknown>;
  if (typeof candidate.ip !== 'string') {
    throw new InvalidIpError(candidate.ip);
  }

  return { ip: candidate.ip };
}

function parseSelectAdapterPayload(data: unknown): SelectAdapterPayload {
  if (typeof data !== 'object' || data === null) {
    throw new UnknownAdapterError('invalid');
  }

  const candidate = data as Record<string, unknown>;
  if (typeof candidate.adapterId !== 'string') {
    throw new UnknownAdapterError('invalid');
  }

  return { adapterId: candidate.adapterId };
}
