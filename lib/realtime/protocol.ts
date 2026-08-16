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
  | 'unexpected_state';

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
      return true;
    default:
      return false;
  }
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
