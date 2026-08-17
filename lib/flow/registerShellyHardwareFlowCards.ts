/**
 * Homey Flow Action Cards for Shelly Wall Display hardware commands.
 * @see https://apps.developer.homey.app/the-basics/flow#device-cards
 */

import { getDisplayId } from '../device/DisplayAppHost';
import type { ShellyRebootResult } from '../shelly';
import type { Logger } from '../types';

export interface ShellyHardwareFlowApp {
  rebootShellyDisplay(displayId: string): Promise<ShellyRebootResult>;
  recordShellyHardwareFlowError?(): void;
}

type HomeyDeviceLike = {
  getData(): unknown;
};

type FlowActionCard = {
  registerRunListener(
    listener: (args: Record<string, unknown>) => Promise<void>,
  ): FlowActionCard;
};

type HomeyFlowHost = {
  flow: {
    getActionCard(id: string): FlowActionCard;
  };
};

const SHELLY_REBOOT_IDS = ['shelly_reboot_display'] as const;

function resolveDisplayId(device: unknown): string | null {
  if (typeof device !== 'object' || device === null) {
    return null;
  }
  const candidate = device as HomeyDeviceLike;
  if (typeof candidate.getData !== 'function') {
    return null;
  }
  return getDisplayId(candidate.getData());
}

function mapRebootError(
  result: Extract<ShellyRebootResult, { readonly ok: false }>,
  translate: (key: string) => string,
): string {
  switch (result.message) {
    case 'reboot_unsupported':
      return translate('flow.hardware.errors.rebootUnsupported');
    case 'reboot_unknown':
      return translate('flow.hardware.errors.rebootUnknown');
    case 'missing_ip':
      return translate('flow.hardware.errors.deviceOffline');
    default:
      break;
  }

  switch (result.error) {
    case 'device_offline':
    case 'timeout':
    case 'network':
      return translate('flow.hardware.errors.deviceOffline');
    case 'unsupported_method':
      return translate('flow.hardware.errors.rebootUnsupported');
    default:
      return translate('flow.hardware.errors.rebootFailed');
  }
}

export function registerShellyHardwareFlowCards(input: {
  readonly homey: HomeyFlowHost;
  readonly app: ShellyHardwareFlowApp;
  readonly logger: Logger;
  readonly translate: (key: string) => string;
}): void {
  const { homey, app, logger, translate } = input;

  const rebootListener = async (args: Record<string, unknown>): Promise<void> => {
    const displayId = resolveDisplayId(args.device);
    if (!displayId) {
      app.recordShellyHardwareFlowError?.();
      throw new Error(translate('flow.hardware.errors.invalidDevice'));
    }

    try {
      const result = await app.rebootShellyDisplay(displayId);
      if (!result.ok) {
        app.recordShellyHardwareFlowError?.();
        throw new Error(mapRebootError(result, translate));
      }

      logger.info('Flow reboot display completed', {
        displayId,
        expectedDisconnect: result.expectedDisconnect,
      });
    } catch (error) {
      app.recordShellyHardwareFlowError?.();
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(translate('flow.hardware.errors.rebootFailed'));
    }
  };

  for (const id of SHELLY_REBOOT_IDS) {
    homey.flow.getActionCard(id).registerRunListener(rebootListener);
  }
}

export { SHELLY_REBOOT_IDS };
