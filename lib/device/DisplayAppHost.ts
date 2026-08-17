import type { DisplaySnapshot, DisplayTypeId } from '../display/types';
import type { GenericDisplayPairingManager } from '../pairing/GenericDisplayPairingManager';
import type { GenericPairingValidationResult } from '../pairing/types';

/**
 * Minimal app surface used by Homey Devices to sync the runtime registry.
 */
export interface DisplayAppHost {
  registerDisplay(snapshot: DisplaySnapshot): void;
  unregisterDisplay(displayId: string): void;
  updateDisplay(snapshot: DisplaySnapshot): void;
  syncNotificationCapabilities?(displayId: string): void;
}

/** App surface for Generic Web Display code-based pairing (M15). */
export interface GenericPairingAppHost extends DisplayAppHost {
  readonly displayRegistry: import('../display/DisplayRegistry').DisplayRegistry;
  getGenericPairingManager(): GenericDisplayPairingManager;
  validateGenericPairingCode(code: string): GenericPairingValidationResult;
  consumeGenericPairingCode(code: string): boolean;
  isDisplayIpTaken(ipAddress: string, excludeDisplayId?: string): boolean;
}

export function isGenericPairingAppHost(
  value: unknown,
): value is GenericPairingAppHost {
  if (!isDisplayAppHost(value)) {
    return false;
  }
  const candidate = value as GenericPairingAppHost;
  return (
    typeof candidate.getGenericPairingManager === 'function' &&
    typeof candidate.validateGenericPairingCode === 'function' &&
    typeof candidate.consumeGenericPairingCode === 'function' &&
    typeof candidate.isDisplayIpTaken === 'function'
  );
}

export interface ShellyHardwareAppHost extends DisplayAppHost {
  discoverShellyHardware(displayId: string): Promise<void>;
  ensureShellyHardwareDiscovered?(displayId: string): Promise<void>;
  syncShellyHardwareSettingsForDevice?(device: {
    getData(): unknown;
  }): Promise<void>;
}

export function isDisplayAppHost(value: unknown): value is DisplayAppHost {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.registerDisplay === 'function' &&
    typeof candidate.unregisterDisplay === 'function' &&
    typeof candidate.updateDisplay === 'function'
  );
}

export function isShellyHardwareAppHost(
  value: unknown,
): value is ShellyHardwareAppHost {
  return (
    isDisplayAppHost(value) &&
    typeof (value as ShellyHardwareAppHost).discoverShellyHardware === 'function'
  );
}

export function getDisplayId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const id = (data as Record<string, unknown>).id;
  return typeof id === 'string' && id.trim() !== '' ? id : null;
}

export type { DisplayTypeId };
