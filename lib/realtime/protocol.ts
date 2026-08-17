/**
 * Typed WebSocket protocol (discriminated unions). No arbitrary JSON payloads.
 * Shared by Homey backend and vanilla frontend (bundled into dashboard.js).
 *
 * Clients send widget intents (`widgetId` + `action` [+ normalized UX fields]),
 * never raw Homey `deviceId` / capability / value. The backend resolves and validates.
 */

import type {
  DashboardConfiguration,
  DashboardTheme,
  WidgetRuntimeState,
} from '../widgets/types';
import type {
  DashboardEmptyStateCopy,
  DashboardUiCopy,
  GridConfig,
} from '../dashboard/types';
import type { DisplayNotification } from '../notifications/types';
import { isNotificationAction } from '../notifications/action';
import { isNotificationIcon } from '../notifications/icons';
import { isNotificationMedia } from '../notifications/media';
import { isNotificationSeverity } from '../notifications/severity';
import { REALTIME_PROTOCOL_VERSION } from './constants';
import { isValidPositionPercent } from '../widgets/cover/normalize';
import { isValidPercent } from '../widgets/light/normalize';

export type RealtimeProtocolVersion = typeof REALTIME_PROTOCOL_VERSION;

export type RealtimeErrorCode =
  | 'protocol_error'
  | 'display_session_invalid'
  | 'snapshot_failed'
  | 'homey_connection_error'
  | 'realtime_unavailable';

/**
 * Extensible widget action ids sent over the wire.
 * Local-only UI actions (e.g. open-control) are not protocol actions.
 */
export type WidgetActionId =
  | 'toggle'
  | 'set-dim'
  | 'set-temperature'
  | 'set-color'
  | 'set-position'
  | 'stop';

export type CommandRejectReason =
  | 'display_session_invalid'
  | 'widget_not_found'
  | 'widget_type_unsupported'
  | 'action_not_allowed'
  | 'device_missing'
  | 'capability_missing'
  | 'device_unavailable'
  | 'invalid_state'
  | 'invalid_position'
  | 'invalid_value'
  | 'homey_api_error'
  | 'already_pending'
  | 'unexpected_state'
  | 'notification_not_found'
  | 'notification_action_invalid'
  | 'notification_action_mismatch';

export type NotificationActionRejectReason =
  | 'display_session_invalid'
  | 'notification_not_found'
  | 'notification_action_invalid'
  | 'notification_action_mismatch'
  | 'homey_api_error';

export type RealtimeUiCopy = DashboardUiCopy['realtime'];

export type DashboardUiCopyWithRealtime = DashboardUiCopy;

export interface DashboardSnapshotPayload {
  readonly protocolVersion: RealtimeProtocolVersion;
  readonly displayId: string;
  readonly displayName: string;
  readonly typeLabel: string;
  readonly layoutId: string;
  readonly layout: GridConfig;
  readonly configuration: DashboardConfiguration;
  readonly widgetStates: Readonly<Record<string, WidgetRuntimeState>>;
  /** Visible notifications for this Display (local dismiss already applied). */
  readonly notifications: readonly DisplayNotification[];
  readonly theme: DashboardTheme;
  readonly locale: string;
  readonly emptyState: DashboardEmptyStateCopy;
  readonly copy: DashboardUiCopy;
}

export type ServerMessage =
  | {
      readonly type: 'dashboard-snapshot';
      readonly snapshot: DashboardSnapshotPayload;
    }
  | {
      readonly type: 'dashboard-configuration';
      readonly configuration: DashboardConfiguration;
      readonly widgetStates: Readonly<Record<string, WidgetRuntimeState>>;
      readonly theme: DashboardTheme;
    }
  | {
      readonly type: 'widget-state';
      readonly widgetId: string;
      readonly state: WidgetRuntimeState;
    }
  | {
      readonly type: 'notification-snapshot';
      readonly notifications: readonly DisplayNotification[];
    }
  | {
      readonly type: 'notification-added';
      readonly notification: DisplayNotification;
    }
  | {
      readonly type: 'notification-updated';
      readonly notification: DisplayNotification;
    }
  | {
      readonly type: 'notification-removed';
      readonly notificationId: string;
    }
  | {
      readonly type: 'notification-action-accepted';
      readonly requestId: string;
    }
  | {
      readonly type: 'notification-action-succeeded';
      readonly requestId: string;
    }
  | {
      readonly type: 'notification-action-rejected';
      readonly requestId: string;
      readonly reason: NotificationActionRejectReason;
    }
  | {
      readonly type: 'heartbeat';
      readonly at: string;
    }
  | {
      readonly type: 'command-accepted';
      readonly requestId: string;
    }
  | {
      readonly type: 'command-succeeded';
      readonly requestId: string;
    }
  | {
      readonly type: 'command-rejected';
      readonly requestId: string;
      readonly reason: CommandRejectReason;
    }
  | {
      readonly type: 'command-timeout';
      readonly requestId: string;
    }
  | {
      readonly type: 'error';
      readonly code: RealtimeErrorCode;
      readonly message: string;
    };

export type ClientMessage =
  | {
      readonly type: 'heartbeat-ack';
      readonly at: string;
    }
  | {
      readonly type: 'client-ready';
    }
  | {
      readonly type: 'widget-action';
      readonly widgetId: string;
      readonly action: 'toggle';
      readonly requestId: string;
    }
  | {
      readonly type: 'widget-action';
      readonly widgetId: string;
      readonly action: 'set-dim';
      readonly requestId: string;
      readonly valuePercent: number;
    }
  | {
      readonly type: 'widget-action';
      readonly widgetId: string;
      readonly action: 'set-temperature';
      readonly requestId: string;
      readonly valuePercent: number;
    }
  | {
      readonly type: 'widget-action';
      readonly widgetId: string;
      readonly action: 'set-color';
      readonly requestId: string;
      readonly huePercent: number;
      readonly saturationPercent: number;
    }
  | {
      readonly type: 'widget-action';
      readonly widgetId: string;
      readonly action: 'set-position';
      readonly requestId: string;
      readonly positionPercent: number;
    }
  | {
      readonly type: 'widget-action';
      readonly widgetId: string;
      readonly action: 'stop';
      readonly requestId: string;
    }
  | {
      readonly type: 'notification-dismiss';
      readonly notificationId: string;
    }
  | {
      readonly type: 'notification-center-opened';
    }
  | {
      readonly type: 'notification-auto-opened';
    }
  | {
      readonly type: 'notification-auto-closed';
    }
  | {
      readonly type: 'notification-action';
      readonly notificationId: string;
      readonly notificationKey: string;
      readonly actionId: string;
      readonly requestId: string;
    }
  | {
      readonly type: 'notification-media-start';
      readonly notificationId: string;
    }
  | {
      readonly type: 'notification-media-stop';
      readonly notificationId: string;
    }
  | {
      readonly type: 'notification-media-telemetry';
      readonly notificationId: string;
      readonly event:
        | 'image-loaded'
        | 'video-ready'
        | 'video-failed'
        | 'image-fallback';
    };

export function isWidgetActionId(value: unknown): value is WidgetActionId {
  return (
    value === 'toggle' ||
    value === 'set-dim' ||
    value === 'set-temperature' ||
    value === 'set-color' ||
    value === 'set-position' ||
    value === 'stop'
  );
}

export function isCommandRejectReason(
  value: unknown,
): value is CommandRejectReason {
  switch (value) {
    case 'display_session_invalid':
    case 'widget_not_found':
    case 'widget_type_unsupported':
    case 'action_not_allowed':
    case 'device_missing':
    case 'capability_missing':
    case 'device_unavailable':
    case 'invalid_state':
    case 'invalid_position':
    case 'invalid_value':
    case 'homey_api_error':
    case 'already_pending':
    case 'unexpected_state':
    case 'notification_not_found':
    case 'notification_action_invalid':
    case 'notification_action_mismatch':
      return true;
    default:
      return false;
  }
}

export function isNotificationActionRejectReason(
  value: unknown,
): value is NotificationActionRejectReason {
  switch (value) {
    case 'display_session_invalid':
    case 'notification_not_found':
    case 'notification_action_invalid':
    case 'notification_action_mismatch':
    case 'homey_api_error':
      return true;
    default:
      return false;
  }
}

export function isDisplayNotification(
  value: unknown,
): value is DisplayNotification {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    readonly id?: unknown;
    readonly title?: unknown;
    readonly message?: unknown;
    readonly severity?: unknown;
    readonly icon?: unknown;
    readonly dismissable?: unknown;
    readonly highlight?: unknown;
    readonly publishedAt?: unknown;
    readonly autoOpen?: unknown;
    readonly autoCloseSeconds?: unknown;
    readonly action?: unknown;
    readonly notificationKey?: unknown;
    readonly media?: unknown;
  };

  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    return false;
  }
  if (typeof candidate.message !== 'string' || candidate.message.trim() === '') {
    return false;
  }
  if (!isNotificationSeverity(candidate.severity)) {
    return false;
  }
  if (typeof candidate.dismissable !== 'boolean') {
    return false;
  }
  if (typeof candidate.highlight !== 'boolean') {
    return false;
  }
  if (
    typeof candidate.publishedAt !== 'number' ||
    !Number.isFinite(candidate.publishedAt)
  ) {
    return false;
  }
  if (candidate.title !== undefined && typeof candidate.title !== 'string') {
    return false;
  }
  if (candidate.icon !== undefined && !isNotificationIcon(candidate.icon)) {
    return false;
  }
  // Backward compatible wire: missing autoOpen → treat as true at apply time,
  // but strict parser requires boolean when present. Accept missing for M11 payloads.
  if (
    candidate.autoOpen !== undefined &&
    typeof candidate.autoOpen !== 'boolean'
  ) {
    return false;
  }
  if (candidate.autoCloseSeconds !== undefined) {
    if (
      typeof candidate.autoCloseSeconds !== 'number' ||
      !Number.isFinite(candidate.autoCloseSeconds) ||
      candidate.autoCloseSeconds < 0
    ) {
      return false;
    }
  }
  if (candidate.action !== undefined && !isNotificationAction(candidate.action)) {
    return false;
  }
  if (
    candidate.notificationKey !== undefined &&
    typeof candidate.notificationKey !== 'string'
  ) {
    return false;
  }
  if (candidate.media !== undefined && !isNotificationMedia(candidate.media)) {
    return false;
  }
  return true;
}

/**
 * Coerce optional M11 fields onto a DisplayNotification with M12 defaults.
 */
export function coerceDisplayNotification(
  value: DisplayNotification,
): DisplayNotification {
  return {
    ...value,
    autoOpen: value.autoOpen !== false,
    ...(value.autoCloseSeconds !== undefined && value.autoCloseSeconds > 0
      ? { autoCloseSeconds: Math.floor(value.autoCloseSeconds) }
      : {}),
  };
}

export function isServerMessage(value: unknown): value is ServerMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { readonly type?: unknown };
  switch (candidate.type) {
    case 'dashboard-snapshot':
    case 'dashboard-configuration':
    case 'widget-state':
    case 'heartbeat':
    case 'error':
      return true;
    case 'notification-snapshot': {
      const notifications = (value as { readonly notifications?: unknown })
        .notifications;
      return (
        Array.isArray(notifications) &&
        notifications.every(isDisplayNotification)
      );
    }
    case 'notification-added':
    case 'notification-updated': {
      return isDisplayNotification(
        (value as { readonly notification?: unknown }).notification,
      );
    }
    case 'notification-removed': {
      const notificationId = (value as { readonly notificationId?: unknown })
        .notificationId;
      return typeof notificationId === 'string' && notificationId.trim() !== '';
    }
    case 'notification-action-accepted':
    case 'notification-action-succeeded': {
      const requestId = (value as { readonly requestId?: unknown }).requestId;
      return typeof requestId === 'string' && requestId.trim() !== '';
    }
    case 'notification-action-rejected': {
      const message = value as {
        readonly requestId?: unknown;
        readonly reason?: unknown;
      };
      return (
        typeof message.requestId === 'string' &&
        message.requestId.trim() !== '' &&
        isNotificationActionRejectReason(message.reason)
      );
    }
    case 'command-accepted':
    case 'command-succeeded':
    case 'command-timeout': {
      const requestId = (value as { readonly requestId?: unknown }).requestId;
      return typeof requestId === 'string' && requestId.trim() !== '';
    }
    case 'command-rejected': {
      const message = value as {
        readonly requestId?: unknown;
        readonly reason?: unknown;
      };
      return (
        typeof message.requestId === 'string' &&
        message.requestId.trim() !== '' &&
        isCommandRejectReason(message.reason)
      );
    }
    default:
      return false;
  }
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as {
    readonly type?: unknown;
    readonly widgetId?: unknown;
    readonly action?: unknown;
    readonly requestId?: unknown;
    readonly positionPercent?: unknown;
    readonly valuePercent?: unknown;
    readonly huePercent?: unknown;
    readonly saturationPercent?: unknown;
    readonly at?: unknown;
  };

  if (candidate.type === 'heartbeat-ack') {
    return typeof candidate.at === 'string';
  }

  if (candidate.type === 'client-ready') {
    return true;
  }

  if (candidate.type === 'notification-dismiss') {
    const notificationId = (value as { readonly notificationId?: unknown })
      .notificationId;
    return typeof notificationId === 'string' && notificationId.trim() !== '';
  }

  if (candidate.type === 'notification-center-opened') {
    return true;
  }

  if (
    candidate.type === 'notification-auto-opened' ||
    candidate.type === 'notification-auto-closed'
  ) {
    return true;
  }

  if (candidate.type === 'notification-action') {
    const message = value as {
      readonly notificationId?: unknown;
      readonly notificationKey?: unknown;
      readonly actionId?: unknown;
      readonly requestId?: unknown;
    };
    return (
      typeof message.notificationId === 'string' &&
      message.notificationId.trim() !== '' &&
      typeof message.notificationKey === 'string' &&
      typeof message.actionId === 'string' &&
      message.actionId.trim() !== '' &&
      typeof message.requestId === 'string' &&
      message.requestId.trim() !== ''
    );
  }

  if (
    candidate.type === 'notification-media-start' ||
    candidate.type === 'notification-media-stop'
  ) {
    const notificationId = (value as { readonly notificationId?: unknown })
      .notificationId;
    return typeof notificationId === 'string' && notificationId.trim() !== '';
  }

  if (candidate.type === 'notification-media-telemetry') {
    const message = value as {
      readonly notificationId?: unknown;
      readonly event?: unknown;
    };
    return (
      typeof message.notificationId === 'string' &&
      message.notificationId.trim() !== '' &&
      (message.event === 'image-loaded' ||
        message.event === 'video-ready' ||
        message.event === 'video-failed' ||
        message.event === 'image-fallback')
    );
  }

  if (candidate.type !== 'widget-action') {
    return false;
  }

  if (
    typeof candidate.widgetId !== 'string' ||
    candidate.widgetId.trim() === '' ||
    typeof candidate.requestId !== 'string' ||
    candidate.requestId.trim() === '' ||
    !isWidgetActionId(candidate.action)
  ) {
    return false;
  }

  if (candidate.action === 'set-position') {
    return (
      isValidPositionPercent(candidate.positionPercent) &&
      candidate.valuePercent === undefined &&
      candidate.huePercent === undefined &&
      candidate.saturationPercent === undefined
    );
  }

  if (candidate.action === 'set-dim' || candidate.action === 'set-temperature') {
    return (
      isValidPercent(candidate.valuePercent) &&
      candidate.positionPercent === undefined &&
      candidate.huePercent === undefined &&
      candidate.saturationPercent === undefined
    );
  }

  if (candidate.action === 'set-color') {
    return (
      isValidPercent(candidate.huePercent) &&
      isValidPercent(candidate.saturationPercent) &&
      candidate.positionPercent === undefined &&
      candidate.valuePercent === undefined
    );
  }

  // toggle / stop must not carry value payloads
  return (
    candidate.positionPercent === undefined &&
    candidate.valuePercent === undefined &&
    candidate.huePercent === undefined &&
    candidate.saturationPercent === undefined
  );
}

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isClientMessage(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isServerMessage(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function serializeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

export function serializeClientMessage(message: ClientMessage): string {
  return JSON.stringify(message);
}
