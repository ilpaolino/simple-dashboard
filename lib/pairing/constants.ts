/** Six-digit numeric pairing codes (100000–999999). */
export const GENERIC_PAIRING_CODE_LENGTH = 6;

/** Pairing codes expire after eight minutes (not user-configurable in M15). */
export const GENERIC_PAIRING_EXPIRY_MS = 8 * 60 * 1000;

/** Maximum concurrent pending pairing sessions in RAM. */
export const MAX_PENDING_GENERIC_PAIRINGS = 64;

/** Global opportunistic cleanup interval for expired pairing sessions. */
export const GENERIC_PAIRING_CLEANUP_INTERVAL_MS = 60_000;
