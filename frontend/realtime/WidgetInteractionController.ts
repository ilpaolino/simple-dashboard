import { COMMAND_ERROR_FEEDBACK_MS } from '../../lib/realtime/constants';
import type {
  CommandRejectReason,
  WidgetActionId,
} from '../../lib/realtime/protocol';

export type CommandStatus =
  | 'idle'
  | 'pending'
  | 'success'
  | 'error'
  | 'timeout';

export type WidgetGesture = 'tap' | 'double-tap' | 'long-press' | 'swipe';

export interface WidgetActionDispatch {
  readonly widgetId: string;
  readonly action: WidgetActionId;
  readonly requestId: string;
}

export interface WidgetCommandFeedback {
  readonly widgetId: string;
  readonly requestId: string;
  readonly status: CommandStatus;
  readonly reason?: CommandRejectReason;
}

export interface WidgetInteractionControllerOptions {
  readonly sendAction: (message: WidgetActionDispatch) => boolean;
  readonly errorFeedbackMs?: number;
  readonly createRequestId?: () => string;
}

type StatusListener = (feedback: WidgetCommandFeedback) => void;

interface PendingEntry {
  readonly widgetId: string;
  readonly requestId: string;
  readonly action: WidgetActionId;
}

/**
 * Frontend bridge between widgets and the WebSocket client.
 * Widgets never build protocol messages directly.
 */
export class WidgetInteractionController {
  private readonly sendAction: WidgetInteractionControllerOptions['sendAction'];
  private readonly errorFeedbackMs: number;
  private readonly createRequestId: () => string;

  private readonly pendingByWidget = new Map<string, PendingEntry>();
  private readonly pendingByRequest = new Map<string, PendingEntry>();
  private readonly listeners = new Map<string, Set<StatusListener>>();
  private readonly errorTimers = new Map<string, ReturnType<typeof setTimeout>>();

  public constructor(options: WidgetInteractionControllerOptions) {
    this.sendAction = options.sendAction;
    this.errorFeedbackMs = options.errorFeedbackMs ?? COMMAND_ERROR_FEEDBACK_MS;
    this.createRequestId = options.createRequestId ?? createRequestId;
  }

  /**
   * Maps a gesture to an action for a widget. Milestone 7 only uses tap→toggle
   * for LightWidget; the signature stays open for future gestures.
   */
  public handleGesture(options: {
    readonly widgetId: string;
    readonly gesture: WidgetGesture;
    readonly action: WidgetActionId;
    readonly interactive: boolean;
  }): boolean {
    if (!options.interactive) {
      return false;
    }

    if (options.gesture !== 'tap') {
      // Future gestures are reserved; ignore until implemented.
      return false;
    }

    if (this.pendingByWidget.has(options.widgetId)) {
      return false;
    }

    const requestId = this.createRequestId();
    const dispatched = this.sendAction({
      widgetId: options.widgetId,
      action: options.action,
      requestId,
    });

    if (!dispatched) {
      this.emit(options.widgetId, {
        widgetId: options.widgetId,
        requestId,
        status: 'error',
      });
      this.scheduleErrorClear(options.widgetId, requestId);
      return false;
    }

    const entry: PendingEntry = {
      widgetId: options.widgetId,
      requestId,
      action: options.action,
    };
    this.pendingByWidget.set(options.widgetId, entry);
    this.pendingByRequest.set(requestId, entry);
    this.clearErrorTimer(options.widgetId);
    this.emit(options.widgetId, {
      widgetId: options.widgetId,
      requestId,
      status: 'pending',
    });
    return true;
  }

  public onStatus(
    widgetId: string,
    listener: StatusListener,
  ): () => void {
    let set = this.listeners.get(widgetId);
    if (!set) {
      set = new Set();
      this.listeners.set(widgetId, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.listeners.delete(widgetId);
      }
    };
  }

  public isPending(widgetId: string): boolean {
    return this.pendingByWidget.has(widgetId);
  }

  public getPendingRequestId(widgetId: string): string | null {
    return this.pendingByWidget.get(widgetId)?.requestId ?? null;
  }

  /** Backend accepted the Homey API call — still waiting for realtime confirmation. */
  public handleCommandAccepted(requestId: string): void {
    // Keep pending UI until Homey confirms via widget-state / timeout / reject.
    void this.pendingByRequest.get(requestId);
  }

  public handleCommandRejected(
    requestId: string,
    reason: CommandRejectReason,
  ): void {
    const entry = this.pendingByRequest.get(requestId);
    if (!entry) {
      return;
    }
    this.clearPending(entry);
    this.emit(entry.widgetId, {
      widgetId: entry.widgetId,
      requestId,
      status: 'error',
      reason,
    });
    this.scheduleErrorClear(entry.widgetId, requestId);
  }

  public handleCommandTimeout(requestId: string): void {
    const entry = this.pendingByRequest.get(requestId);
    if (!entry) {
      return;
    }
    this.clearPending(entry);
    this.emit(entry.widgetId, {
      widgetId: entry.widgetId,
      requestId,
      status: 'timeout',
    });
    this.scheduleErrorClear(entry.widgetId, requestId);
  }

  /**
   * Homey realtime confirmation path: any widget-state for a pending widget
   * clears pending (matched or mismatched). Real state comes from the state update.
   */
  public handleWidgetStateConfirmed(widgetId: string): void {
    const entry = this.pendingByWidget.get(widgetId);
    if (!entry) {
      return;
    }
    this.clearPending(entry);
    this.emit(widgetId, {
      widgetId,
      requestId: entry.requestId,
      status: 'success',
    });
  }

  /**
   * Socket loss: drop all pending without assuming success. Snapshot on reconnect
   * restores Homey truth; no command replay.
   */
  public handleDisconnect(): void {
    const entries = [...this.pendingByWidget.values()];
    for (const entry of entries) {
      this.clearPending(entry);
      this.emit(entry.widgetId, {
        widgetId: entry.widgetId,
        requestId: entry.requestId,
        status: 'idle',
      });
    }
    for (const widgetId of [...this.errorTimers.keys()]) {
      this.clearErrorTimer(widgetId);
    }
  }

  public destroy(): void {
    this.handleDisconnect();
    this.listeners.clear();
  }

  private clearPending(entry: PendingEntry): void {
    this.pendingByWidget.delete(entry.widgetId);
    this.pendingByRequest.delete(entry.requestId);
  }

  private scheduleErrorClear(widgetId: string, requestId: string): void {
    this.clearErrorTimer(widgetId);
    const timer = setTimeout(() => {
      this.errorTimers.delete(widgetId);
      this.emit(widgetId, {
        widgetId,
        requestId,
        status: 'idle',
      });
    }, this.errorFeedbackMs);
    this.errorTimers.set(widgetId, timer);
  }

  private clearErrorTimer(widgetId: string): void {
    const timer = this.errorTimers.get(widgetId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.errorTimers.delete(widgetId);
    }
  }

  private emit(widgetId: string, feedback: WidgetCommandFeedback): void {
    const set = this.listeners.get(widgetId);
    if (!set) {
      return;
    }
    for (const listener of set) {
      try {
        listener(feedback);
      } catch {
        // Isolate widget paint failures from the interaction bus.
      }
    }
  }
}

export function createRequestId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `cmd_${time}_${random}`;
}
