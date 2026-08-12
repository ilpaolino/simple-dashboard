import {
  MAX_TCP_PORT,
  MIN_TCP_PORT,
} from './types';

export class InvalidPortError extends Error {
  public readonly code = 'INVALID_PORT' as const;

  public constructor(value: unknown) {
    super(`Invalid HTTP port configuration: ${String(value)}`);
    this.name = 'InvalidPortError';
  }
}

/**
 * Parses and validates a TCP port from Homey settings or raw input.
 */
export function parseHttpPort(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return assertPortRange(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed)) {
      return assertPortRange(parsed);
    }
  }

  throw new InvalidPortError(value);
}

function assertPortRange(port: number): number {
  if (port < MIN_TCP_PORT || port > MAX_TCP_PORT) {
    throw new InvalidPortError(port);
  }

  return port;
}
