/**
 * Display notification contracts (global chrome — not grid widgets).
 */

import type { NotificationAction } from './action';
import type { NotificationMedia } from './media';

export type NotificationSeverity =
  | 'critical'
  | 'warning'
  | 'success'
  | 'info';

/**
 * Controlled icon keys. Arbitrary HTML/SVG from clients is rejected.
 * Extensible: add keys here and in the frontend SVG map.
 */
export type NotificationIcon =
  | 'info'
  | 'warning'
  | 'success'
  | 'error'
  | 'home'
  | 'bell'
  | 'door'
  | 'washing-machine';

export type { NotificationAction };

/**
 * Wire / frontend notification instance (no display routing).
 */
export interface DisplayNotification {
  readonly id: string;
  readonly title?: string;
  readonly message: string;
  readonly severity: NotificationSeverity;
  readonly icon?: NotificationIcon;
  readonly dismissable: boolean;
  readonly highlight: boolean;
  /** Monotonic publish order (ms since epoch). Used for deterministic carousel order. */
  readonly publishedAt: number;
  /**
   * When true, realtime push may open the Notification Center.
   * Default true for M11/M11B backward compatibility.
   */
  readonly autoOpen: boolean;
  /**
   * Seconds until the Center may auto-close after an auto-open presentation.
   * Absent or 0 = disabled. Never removes/dismisses the notification.
   */
  readonly autoCloseSeconds?: number;
  /** At most one semantic CTA per notification (M12). */
  readonly action?: NotificationAction;
  /**
   * Optional Homey camera/media descriptor (M13). Never contains Device ids,
   * tokens, credentials, or raw stream URLs.
   */
  readonly media?: NotificationMedia;
  /**
   * Flow logical key when published via upsert. Absent for keyless HTTP publishes.
   */
  readonly notificationKey?: string;
}

export interface PublishNotificationInput {
  readonly id?: string;
  readonly title?: string;
  readonly message: string;
  readonly severity: NotificationSeverity;
  readonly icon?: NotificationIcon;
  readonly dismissable?: boolean;
  readonly highlight?: boolean;
  readonly autoOpen?: boolean;
  readonly autoCloseSeconds?: number;
  readonly action?: NotificationAction | null;
  readonly media?: NotificationMedia | null;
  readonly mediaDeviceId?: string | null;
  readonly notificationKey?: string;
  /** One or more Display ids. Never broadcast to all Displays by default. */
  readonly displayIds: readonly string[];
}

export interface UpdateNotificationInput {
  readonly id: string;
  readonly title?: string | null;
  readonly message?: string;
  readonly severity?: NotificationSeverity;
  readonly icon?: NotificationIcon | null;
  readonly dismissable?: boolean;
  readonly highlight?: boolean;
  readonly autoOpen?: boolean;
  readonly autoCloseSeconds?: number | null;
  /**
   * Set to replace action; `null` clears action.
   * Omit to keep the existing action.
   */
  readonly action?: NotificationAction | null;
  readonly media?: NotificationMedia | null;
  readonly mediaDeviceId?: string | null;
  readonly notificationKey?: string | null;
  /**
   * Optional display re-routing. When set, replaces the notification’s targets.
   * When omitted, existing targets are kept.
   */
  readonly displayIds?: readonly string[];
}

export type NotificationManagerErrorCode =
  | 'invalid_input'
  | 'not_found'
  | 'display_limit'
  | 'too_many_displays';

export type NotificationManagerResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: NotificationManagerErrorCode; readonly message: string };

export interface NotificationDiagnosticsSnapshot {
  readonly activeCount: number;
  readonly notificationsPublished: number;
  readonly notificationsUpdated: number;
  readonly notificationsRemoved: number;
  readonly notificationsDismissedLocally: number;
  readonly notificationMessagesSent: number;
  readonly criticalCount: number;
  readonly warningCount: number;
  readonly successCount: number;
  readonly infoCount: number;
  readonly dismissedRuntimeCount: number;
  readonly notificationsWithMedia: number;
  readonly mediaSessions: readonly NotificationMediaSessionDiagnostic[];
  readonly perDisplay: readonly NotificationDisplayDiagnostic[];
}

export interface NotificationMediaSessionDiagnostic {
  readonly displayId: string;
  readonly notificationId: string;
  readonly notificationKey: string | null;
  readonly deviceName: string | null;
  readonly playback: 'video' | 'image' | 'unavailable';
  readonly resolvedType: string;
  readonly fallbackAvailable: boolean;
  readonly state: 'active';
}

export interface NotificationDisplayDiagnostic {
  readonly displayId: string;
  readonly activeCount: number;
  readonly visibleCount: number;
  readonly dismissedCount: number;
  readonly criticalCount: number;
  readonly warningCount: number;
  readonly successCount: number;
  readonly infoCount: number;
}
