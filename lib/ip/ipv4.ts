export class InvalidIpError extends Error {
  public readonly code = 'INVALID_IP' as const;

  public constructor(value: unknown) {
    super(`Invalid IPv4 address: ${String(value)}`);
    this.name = 'InvalidIpError';
  }
}

/**
 * HTML5 / Homey settings `pattern` (matched against the whole value).
 * @see https://apps.developer.homey.app/the-basics/devices/settings
 */
export const IPV4_HTML_PATTERN =
  '(?:(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)\\.){3}(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';

const IPV4_PATTERN = new RegExp(`^${IPV4_HTML_PATTERN}$`);

export function isValidIpv4(value: string): boolean {
  return IPV4_PATTERN.test(value.trim());
}

export function parseIpv4(value: unknown): string {
  if (typeof value !== 'string') {
    throw new InvalidIpError(value);
  }

  const trimmed = value.trim();
  if (!isValidIpv4(trimmed)) {
    throw new InvalidIpError(value);
  }

  return trimmed;
}
