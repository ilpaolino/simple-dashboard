import type { DisplaySnapshot, DisplayTypeId } from '../display/types';

/**
 * Minimal app surface used by Homey Devices to sync the runtime registry.
 */
export interface DisplayAppHost {
  registerDisplay(snapshot: DisplaySnapshot): void;
  unregisterDisplay(displayId: string): void;
  updateDisplay(snapshot: DisplaySnapshot): void;
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

export function getDisplayId(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const id = (data as Record<string, unknown>).id;
  return typeof id === 'string' && id.trim() !== '' ? id : null;
}

export type { DisplayTypeId };
