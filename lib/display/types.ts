import type { LayoutId } from '../adapters/types';
import { ADAPTER_IDS } from '../adapters/types';
import type { DashboardConfiguration } from '../widgets/types';
import { emptyDashboardConfiguration } from '../widgets/types';
import type { LightWidgetDiagnostic } from '../widgets/light/types';

/**
 * Homey driver ids — also used as display type ids.
 * Separate drivers are the pairing-time type choice.
 */
export const DISPLAY_TYPE_IDS = {
  SHELLY_WALL_DISPLAY: ADAPTER_IDS.SHELLY_WALL_DISPLAY,
  GENERIC_WEB_DISPLAY: ADAPTER_IDS.GENERIC_WEB_DISPLAY,
} as const;

export type DisplayTypeId =
  (typeof DISPLAY_TYPE_IDS)[keyof typeof DISPLAY_TYPE_IDS];

export type MatchStatus =
  | 'recognized'
  | 'hardware_mismatch'
  | 'unconfigured'
  | 'probe_failed';

export type OnlineStatus = 'online' | 'offline';

/**
 * Persistent configuration projected from a Homey Device.
 * Homey remains the source of truth; this is a runtime snapshot only.
 */
export interface DisplaySnapshot {
  readonly displayId: string;
  readonly name: string;
  readonly typeId: DisplayTypeId;
  readonly ipAddress: string;
  /** Hardware identity when the driver supports it (e.g. Shelly id). */
  readonly hardwareId: string | null;
  readonly layoutId: LayoutId;
  /** Per-device widget configuration from Device Store. */
  readonly dashboard: DashboardConfiguration;
}

/**
 * Lightweight request/display context. Not persisted.
 */
export interface DisplaySession {
  readonly displayId: string;
  readonly ipAddress: string;
  readonly connectedAt: Date;
  readonly lastSeenAt: Date;
}

export interface DisplayRuntimeState {
  lastSeenAt: Date | null;
  session: DisplaySession | null;
  lastMatchStatus: MatchStatus | null;
  lastErrorKey: string | null;
  /** Last successful dashboard HTML serve for this display. */
  lastRenderedAt: Date | null;
  /** Localization key for the last layout configuration error, if any. */
  lastLayoutErrorKey: string | null;
  /** Localization key for invalid widget placement / config, if any. */
  lastDashboardErrorKey: string | null;
  /** ISO timestamp of last successfully loaded dashboard configuration. */
  lastDashboardLoadedAt: string | null;
  /** LightWidget snapshot diagnostics from the last dashboard bootstrap. */
  lastLightWidgetDiagnostics: readonly LightWidgetDiagnostic[];
}

export interface RegisteredDisplay {
  readonly config: DisplaySnapshot;
  readonly runtime: DisplayRuntimeState;
}

export interface DiagnosticsRecentError {
  readonly at: Date;
  readonly messageKey: string;
  readonly displayId?: string;
  readonly ipAddress?: string;
}

/**
 * Displays are considered online while lastSeenAt is within this window.
 * Based on inbound HTTP requests only — no separate heartbeat.
 */
export const DISPLAY_ONLINE_TIMEOUT_MS = 5 * 60 * 1000;

export function isDisplayTypeId(value: unknown): value is DisplayTypeId {
  return (
    value === DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY ||
    value === DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY
  );
}

export { emptyDashboardConfiguration };
