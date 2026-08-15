/**
 * Typed WebSocket protocol (discriminated unions). No arbitrary JSON payloads.
 * Shared by Homey backend and vanilla frontend (bundled into dashboard.js).
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

export type RealtimeProtocolVersion = typeof REALTIME_PROTOCOL_VERSION;

export type RealtimeErrorCode =
  | 'protocol_error'
  | 'display_session_invalid'
  | 'snapshot_failed'
  | 'homey_connection_error'
  | 'realtime_unavailable';

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
    };

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
    default:
      return false;
  }
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as { readonly type?: unknown };
  return candidate.type === 'heartbeat-ack' || candidate.type === 'client-ready';
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
