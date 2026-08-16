import {
  COMMAND_DIAGNOSTICS_HISTORY_LIMIT,
  COMMAND_TIMEOUT_MS,
} from './constants';
import type { WidgetActionId } from './protocol';

export type PendingCommandStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'mismatched'
  | 'cancelled';

/** Homey confirmation target: onoff boolean, cover percent, or cover state enum. */
export type PendingExpectedValue = boolean | number | string;

export interface PendingCommandRecord {
  readonly requestId: string;
  readonly displayId: string;
  readonly widgetId: string;
  readonly deviceId: string;
  readonly capabilityId: string;
  readonly action: WidgetActionId;
  readonly expectedValue: PendingExpectedValue;
  /** Cover set-position: UX percent at command time (progress baseline). */
  readonly baselineValue: number | null;
  readonly startedAt: number;
}

export interface CommandDiagnosticEntry {
  readonly requestId: string;
  readonly displayId: string;
  readonly widgetId: string;
  readonly action: WidgetActionId;
  readonly capabilityId: string;
  readonly expectedValue: PendingExpectedValue;
  readonly baselineValue: number | null;
  readonly status: PendingCommandStatus;
  readonly durationMs: number;
  readonly at: string;
}

export interface PendingCommandManagerOptions {
  readonly timeoutMs?: number;
  readonly historyLimit?: number;
  readonly onTimeout: (command: PendingCommandRecord) => void;
  readonly now?: () => number;
}

interface InternalPending extends PendingCommandRecord {
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * Tracks in-flight widget commands until Homey realtime confirmation or timeout.
 * One pending command per display+widget; no persistent queue / retry.
 */
export class PendingCommandManager {
  private readonly byRequestId = new Map<string, InternalPending>();
  private readonly byWidgetKey = new Map<string, string>();
  private readonly history: CommandDiagnosticEntry[] = [];
  private readonly timeoutMs: number;
  private readonly historyLimit: number;
  private readonly onTimeout: PendingCommandManagerOptions['onTimeout'];
  private readonly now: () => number;

  public constructor(options: PendingCommandManagerOptions) {
    this.timeoutMs = options.timeoutMs ?? COMMAND_TIMEOUT_MS;
    this.historyLimit = options.historyLimit ?? COMMAND_DIAGNOSTICS_HISTORY_LIMIT;
    this.onTimeout = options.onTimeout;
    this.now = options.now ?? (() => Date.now());
  }

  public hasPendingForWidget(displayId: string, widgetId: string): boolean {
    return this.byWidgetKey.has(widgetKey(displayId, widgetId));
  }

  public getByRequestId(requestId: string): PendingCommandRecord | null {
    return this.byRequestId.get(requestId) ?? null;
  }

  public activeCount(): number {
    return this.byRequestId.size;
  }

  public listActive(): readonly PendingCommandRecord[] {
    return [...this.byRequestId.values()].map((entry) => publicRecord(entry));
  }

  public listRecent(): readonly CommandDiagnosticEntry[] {
    return [...this.history];
  }

  /**
   * Registers a pending command. Returns false if the widget already has one.
   */
  public register(command: {
    readonly requestId: string;
    readonly displayId: string;
    readonly widgetId: string;
    readonly deviceId: string;
    readonly capabilityId: string;
    readonly action: WidgetActionId;
    readonly expectedValue: PendingExpectedValue;
    readonly baselineValue?: number | null;
    readonly timeoutMs?: number;
  }): boolean {
    const key = widgetKey(command.displayId, command.widgetId);
    if (this.byWidgetKey.has(key) || this.byRequestId.has(command.requestId)) {
      return false;
    }

    const startedAt = this.now();
    const timeoutMs = command.timeoutMs ?? this.timeoutMs;
    const timer = setTimeout(() => {
      const current = this.byRequestId.get(command.requestId);
      if (!current) {
        return;
      }
      this.finish(current, 'timed_out');
      this.onTimeout(publicRecord(current));
    }, timeoutMs);

    // Avoid keeping the event loop alive solely for command timeouts in tests.
    if (typeof timer === 'object' && 'unref' in timer) {
      timer.unref();
    }

    const entry: InternalPending = {
      requestId: command.requestId,
      displayId: command.displayId,
      widgetId: command.widgetId,
      deviceId: command.deviceId,
      capabilityId: command.capabilityId,
      action: command.action,
      expectedValue: command.expectedValue,
      baselineValue: command.baselineValue ?? null,
      startedAt,
      timer,
    };

    this.byRequestId.set(command.requestId, entry);
    this.byWidgetKey.set(key, command.requestId);
    return true;
  }

  public resolveSuccess(requestId: string): PendingCommandRecord | null {
    return this.complete(requestId, 'succeeded');
  }

  public resolveMismatch(requestId: string): PendingCommandRecord | null {
    return this.complete(requestId, 'mismatched');
  }

  public resolveFailed(requestId: string): PendingCommandRecord | null {
    return this.complete(requestId, 'failed');
  }

  public cancel(requestId: string): PendingCommandRecord | null {
    return this.complete(requestId, 'cancelled');
  }

  public cancelForDisplay(displayId: string): readonly PendingCommandRecord[] {
    const cancelled: PendingCommandRecord[] = [];
    for (const entry of [...this.byRequestId.values()]) {
      if (entry.displayId === displayId) {
        const record = this.complete(entry.requestId, 'cancelled');
        if (record) {
          cancelled.push(record);
        }
      }
    }
    return cancelled;
  }

  /**
   * Find pending commands that target a Homey device (any display/widget).
   */
  public findByDeviceId(deviceId: string): readonly PendingCommandRecord[] {
    return [...this.byRequestId.values()]
      .filter((entry) => entry.deviceId === deviceId)
      .map((entry) => publicRecord(entry));
  }

  public findByDeviceAndCapability(
    deviceId: string,
    capabilityId: string,
  ): readonly PendingCommandRecord[] {
    return [...this.byRequestId.values()]
      .filter(
        (entry) =>
          entry.deviceId === deviceId && entry.capabilityId === capabilityId,
      )
      .map((entry) => publicRecord(entry));
  }

  public destroy(): void {
    for (const entry of [...this.byRequestId.values()]) {
      clearTimeout(entry.timer);
    }
    this.byRequestId.clear();
    this.byWidgetKey.clear();
    this.history.length = 0;
  }

  private complete(
    requestId: string,
    status: PendingCommandStatus,
  ): PendingCommandRecord | null {
    const entry = this.byRequestId.get(requestId);
    if (!entry) {
      return null;
    }
    this.finish(entry, status);
    return publicRecord(entry);
  }

  private finish(entry: InternalPending, status: PendingCommandStatus): void {
    clearTimeout(entry.timer);
    this.byRequestId.delete(entry.requestId);
    const key = widgetKey(entry.displayId, entry.widgetId);
    if (this.byWidgetKey.get(key) === entry.requestId) {
      this.byWidgetKey.delete(key);
    }

    const durationMs = Math.max(0, this.now() - entry.startedAt);
    this.history.push({
      requestId: entry.requestId,
      displayId: entry.displayId,
      widgetId: entry.widgetId,
      action: entry.action,
      capabilityId: entry.capabilityId,
      expectedValue: entry.expectedValue,
      baselineValue: entry.baselineValue,
      status,
      durationMs,
      at: new Date(this.now()).toISOString(),
    });

    while (this.history.length > this.historyLimit) {
      this.history.shift();
    }
  }
}

function widgetKey(displayId: string, widgetId: string): string {
  return `${displayId}::${widgetId}`;
}

function publicRecord(entry: InternalPending): PendingCommandRecord {
  return {
    requestId: entry.requestId,
    displayId: entry.displayId,
    widgetId: entry.widgetId,
    deviceId: entry.deviceId,
    capabilityId: entry.capabilityId,
    action: entry.action,
    expectedValue: entry.expectedValue,
    baselineValue: entry.baselineValue,
    startedAt: entry.startedAt,
  };
}
