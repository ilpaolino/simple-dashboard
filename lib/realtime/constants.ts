/**
 * Internal realtime tuning. Not exposed as Homey user settings in this milestone.
 */

/** Discriminant version embedded in snapshots for future client/server skew checks. */
export const REALTIME_PROTOCOL_VERSION = 1 as const;

/** WebSocket path on the shared HTTP port. */
export const REALTIME_WEBSOCKET_PATH = '/realtime';

/** Server → client heartbeat interval. */
export const HEARTBEAT_INTERVAL_MS = 20_000;

/** Close the session if no heartbeat-ack arrives within this window. */
export const HEARTBEAT_TIMEOUT_MS = 45_000;

/** Client reconnect backoff (exponential). */
export const RECONNECT_INITIAL_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;
export const RECONNECT_FACTOR = 2;

/** Capability used by LightWidget realtime. */
export const REALTIME_LIGHT_CAPABILITY_ID = 'onoff';

/**
 * Max wait for Homey realtime confirmation after a capability command.
 * Not user-configurable in this milestone.
 */
export const COMMAND_TIMEOUT_MS = 4_000;

/** Bounded recent-command buffer for /diagnostics. */
export const COMMAND_DIAGNOSTICS_HISTORY_LIMIT = 20;

/** Brief client-side error feedback duration for command failures. */
export const COMMAND_ERROR_FEEDBACK_MS = 2_000;
