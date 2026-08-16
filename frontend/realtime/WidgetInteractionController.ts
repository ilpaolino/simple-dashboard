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
  readonly positionPercent?: number;
  readonly valuePercent?: number;
  readonly huePercent?: number;
  readonly saturationPercent?: number;
}

export interface WidgetCommandFeedback {
  readonly widgetId: string;
  readonly requestId: string;
  readonly status: CommandStatus;
  readonly reason?: CommandRejectReason;
  readonly targetPercent?: number;
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
  readonly targetPercent: number | null;
}

/**
 * Frontend bridge between widgets and the WebSocket client.
 * Widgets never build protocol messages directly.
 *
 * One pending command per widget (simplest robust policy for light + cover).
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
   * Maps a gesture to an action for a widget. LightWidget uses tap→toggle.
   * Long-press opens the overlay locally (not via this method).
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
      return false;
    }

    return this.dispatchAction({
      widgetId: options.widgetId,
      action: options.action,
      allowReplacePending: false,
    });
  }

  public requestSetDim(widgetId: string, valuePercent: number): boolean {
    return this.dispatchAction({
      widgetId,
      action: 'set-dim',
      valuePercent,
      allowReplacePending: false,
    });
  }

  public requestSetTemperature(
    widgetId: string,
    valuePercent: number,
  ): boolean {
    return this.dispatchAction({
      widgetId,
      action: 'set-temperature',
      valuePercent,
      allowReplacePending: false,
    });
  }

  public requestSetColor(
    widgetId: string,
    huePercent: number,
    saturationPercent: number,
  ): boolean {
    return this.dispatchAction({
      widgetId,
      action: 'set-color',
      huePercent,
      saturationPercent,
      allowReplacePending: false,
    });
  }

  public requestSetPosition(
    widgetId: string,
    positionPercent: number,
  ): boolean {
    return this.dispatchAction({
      widgetId,
      action: 'set-position',
      positionPercent,
      allowReplacePending: false,
    });
  }

  /**
   * Stop may replace an in-flight set-position for the same widget.
   */
  public requestStop(widgetId: string): boolean {
    return this.dispatchAction({
      widgetId,
      action: 'stop',
      allowReplacePending: true,
    });
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

  public getPendingTargetPercent(widgetId: string): number | null {
    return this.pendingByWidget.get(widgetId)?.targetPercent ?? null;
  }

  /** Backend accepted the Homey API call — still waiting for realtime confirmation. */
  public handleCommandAccepted(requestId: string): void {
    void this.pendingByRequest.get(requestId);
  }

  /** Homey realtime confirmed the expected state. */
  public handleCommandSucceeded(requestId: string): void {
    const entry = this.pendingByRequest.get(requestId);
    if (!entry) {
      return;
    }
    this.clearPending(entry);
    this.emit(entry.widgetId, {
      widgetId: entry.widgetId,
      requestId,
      status: 'success',
      targetPercent: entry.targetPercent ?? undefined,
    });
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
      targetPercent: entry.targetPercent ?? undefined,
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
      targetPercent: entry.targetPercent ?? undefined,
    });
    this.scheduleErrorClear(entry.widgetId, requestId);
  }

  /**
   * Homey realtime confirmation path: clears pending for the widget.
   * Prefer command-succeeded from the server for light advanced commands.
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
      targetPercent: entry.targetPercent ?? undefined,
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

  private dispatchAction(options: {
    readonly widgetId: string;
    readonly action: WidgetActionId;
    readonly positionPercent?: number;
    readonly valuePercent?: number;
    readonly huePercent?: number;
    readonly saturationPercent?: number;
    readonly allowReplacePending: boolean;
  }): boolean {
    const existing = this.pendingByWidget.get(options.widgetId);
    if (existing && !options.allowReplacePending) {
      return false;
    }

    if (existing && options.allowReplacePending) {
      this.clearPending(existing);
    }

    const requestId = this.createRequestId();
    const targetPercent =
      options.action === 'set-position' &&
      typeof options.positionPercent === 'number'
        ? options.positionPercent
        : options.action === 'set-dim' || options.action === 'set-temperature'
          ? (options.valuePercent ?? null)
          : null;

    const dispatched = this.sendAction({
      widgetId: options.widgetId,
      action: options.action,
      requestId,
      ...(typeof options.positionPercent === 'number'
        ? { positionPercent: options.positionPercent }
        : {}),
      ...(typeof options.valuePercent === 'number'
        ? { valuePercent: options.valuePercent }
        : {}),
      ...(typeof options.huePercent === 'number'
        ? { huePercent: options.huePercent }
        : {}),
      ...(typeof options.saturationPercent === 'number'
        ? { saturationPercent: options.saturationPercent }
        : {}),
    });

    if (!dispatched) {
      this.emit(options.widgetId, {
        widgetId: options.widgetId,
        requestId,
        status: 'error',
        targetPercent: targetPercent ?? undefined,
      });
      this.scheduleErrorClear(options.widgetId, requestId);
      return false;
    }

    const entry: PendingEntry = {
      widgetId: options.widgetId,
      requestId,
      action: options.action,
      targetPercent,
    };
    this.pendingByWidget.set(options.widgetId, entry);
    this.pendingByRequest.set(requestId, entry);
    this.clearErrorTimer(options.widgetId);
    this.emit(options.widgetId, {
      widgetId: options.widgetId,
      requestId,
      status: 'pending',
      targetPercent: targetPercent ?? undefined,
    });
    return true;
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
