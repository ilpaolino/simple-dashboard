/**
 * Runtime-only pairing session. Never persisted.
 * The code correlates browser IP with Homey pairing; it is not device identity.
 */
export interface GenericDisplayPairingSession {
  readonly code: string;
  readonly ipAddress: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

/** Lightweight browser profile detected at runtime (not persisted as identity). */
export interface GenericBrowserCapabilities {
  readonly touch: boolean;
  readonly fullscreen: boolean;
  readonly audioPlayback: boolean;
  readonly canReloadPage: boolean;
}

export interface GenericBrowserViewport {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
}

/** Runtime metadata attached to a paired Generic display while online. */
export interface GenericBrowserRuntimeProfile {
  readonly capabilities: GenericBrowserCapabilities;
  readonly viewport: GenericBrowserViewport;
  readonly userAgent: string;
  readonly lastHelloAt: Date;
}

export type GenericPairingValidationResult =
  | {
      readonly ok: true;
      readonly ipAddress: string;
      readonly expiresAt: Date;
    }
  | {
      readonly ok: false;
      readonly reason: 'invalid' | 'expired' | 'ip_taken';
    };

export interface GenericPairingDiagnosticsSnapshot {
  readonly pendingCount: number;
  readonly activeCodes: readonly {
    readonly codeMasked: string;
    readonly ipAddress: string;
    readonly expiresAt: string;
  }[];
  readonly expiredCleanedCount: number;
  readonly successfulPairings: number;
  readonly rejectedCodes: number;
  readonly maxPendingReachedCount: number;
  readonly codesReused: number;
  readonly sessionsCreated: number;
}
