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

/** Capability used by LightWidget realtime (base onoff). */
export const REALTIME_LIGHT_CAPABILITY_ID = 'onoff';

/** Optional LightWidget capabilities (subscribed when Homey exposes them). */
export const REALTIME_LIGHT_DIM_CAPABILITY_ID = 'dim';
export const REALTIME_LIGHT_TEMPERATURE_CAPABILITY_ID = 'light_temperature';
export const REALTIME_LIGHT_HUE_CAPABILITY_ID = 'light_hue';
export const REALTIME_LIGHT_SATURATION_CAPABILITY_ID = 'light_saturation';
export const REALTIME_LIGHT_MODE_CAPABILITY_ID = 'light_mode';

/** Capability used by CoverWidget realtime (official Homey windowcoverings_set). */
export const REALTIME_COVER_CAPABILITY_ID = 'windowcoverings_set';

/** Capability used for official cover stop (windowcoverings_state → idle). */
export const REALTIME_COVER_STATE_CAPABILITY_ID = 'windowcoverings_state';

/**
 * Per-command-type timeouts (ms). Not user-configurable in this milestone.
 *
 * Cover set-position waits for Homey to acknowledge movement (first coherent
 * progress or target within tolerance) — not the full physical travel time.
 */
export const COMMAND_TIMEOUTS = {
  lightToggle: 4_000,
  lightDim: 4_000,
  lightTemperature: 4_000,
  lightColor: 4_000,
  coverSetPosition: 8_000,
  coverStop: 4_000,
} as const;

/** Max wait for Homey Flow trigger confirmation after a notification CTA. */
export const NOTIFICATION_ACTION_TIMEOUT_MS = 8_000;

/** Centralized long-press threshold for LightWidget (touch-first). */
export const LONG_PRESS_MS = 500;

/** Cancel long-press when the pointer moves farther than this (px). */
export const LONG_PRESS_MOVE_TOLERANCE_PX = 12;

/**
 * Max wait for Homey realtime confirmation after a light toggle.
 * Alias of {@link COMMAND_TIMEOUTS.lightToggle} for backward compatibility.
 */
export const COMMAND_TIMEOUT_MS = COMMAND_TIMEOUTS.lightToggle;

/**
 * Cover position confirmation tolerance in UX percent points.
 * Homey reports [0,1] with two decimals; 1% matches that resolution.
 * @see {@link COVER_POSITION_CONFIRM_TOLERANCE_PERCENT} in cover/confirmation
 */
export { COVER_POSITION_CONFIRM_TOLERANCE_PERCENT } from '../widgets/cover/confirmation';

/** Bounded recent-command buffer for /diagnostics. */
export const COMMAND_DIAGNOSTICS_HISTORY_LIMIT = 20;

/** Brief client-side error feedback duration for command failures. */
export const COMMAND_ERROR_FEEDBACK_MS = 2_000;
