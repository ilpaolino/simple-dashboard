/**
 * Normalizes client IPs as seen by Node.js HTTP (IPv4, IPv4-mapped IPv6).
 * Used only for runtime routing — never as device identity.
 */
export function normalizeClientIp(raw: string): string {
  let value = raw.trim();

  if (value.startsWith('[') && value.endsWith(']')) {
    value = value.slice(1, -1);
  }

  const zoneIndex = value.indexOf('%');
  if (zoneIndex >= 0) {
    value = value.slice(0, zoneIndex);
  }

  if (value.toLowerCase().startsWith('::ffff:')) {
    value = value.slice('::ffff:'.length);
  }

  return value;
}
