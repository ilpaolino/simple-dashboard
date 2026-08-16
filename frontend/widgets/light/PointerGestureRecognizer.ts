import {
  LONG_PRESS_MS,
  LONG_PRESS_MOVE_TOLERANCE_PX,
} from '../../../lib/realtime/constants';

export type PointerGestureKind = 'tap' | 'long-press' | 'cancelled';

export interface PointerGestureCallbacks {
  readonly onTap: () => void;
  readonly onLongPress: () => void;
  /** Fired when the long-press threshold is reached (before release). */
  readonly onLongPressRecognized?: () => void;
}

/**
 * Deterministic pointer gesture recognizer for LightWidget.
 * Long press never emits tap; excess movement or cancel suppress both.
 */
export class PointerGestureRecognizer {
  private readonly element: HTMLElement;
  private readonly callbacks: PointerGestureCallbacks;
  private readonly longPressMs: number;
  private readonly moveTolerancePx: number;

  private activePointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;
  private suppressClickUntil = 0;

  private readonly onPointerDown: (event: PointerEvent) => void;
  private readonly onPointerMove: (event: PointerEvent) => void;
  private readonly onPointerUp: (event: PointerEvent) => void;
  private readonly onPointerCancel: (event: PointerEvent) => void;
  private readonly onClick: (event: MouseEvent) => void;

  public constructor(
    element: HTMLElement,
    callbacks: PointerGestureCallbacks,
    options?: {
      readonly longPressMs?: number;
      readonly moveTolerancePx?: number;
    },
  ) {
    this.element = element;
    this.callbacks = callbacks;
    this.longPressMs = options?.longPressMs ?? LONG_PRESS_MS;
    this.moveTolerancePx =
      options?.moveTolerancePx ?? LONG_PRESS_MOVE_TOLERANCE_PX;

    this.onPointerDown = (event) => this.handlePointerDown(event);
    this.onPointerMove = (event) => this.handlePointerMove(event);
    this.onPointerUp = (event) => this.handlePointerUp(event);
    this.onPointerCancel = (event) => this.handlePointerCancel(event);
    this.onClick = (event) => this.handleClick(event);

    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerUp);
    this.element.addEventListener('pointercancel', this.onPointerCancel);
    this.element.addEventListener('click', this.onClick);
  }

  public destroy(): void {
    this.clearLongPressTimer();
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerCancel);
    this.element.removeEventListener('click', this.onClick);
    this.activePointerId = null;
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return;
    }
    if (this.activePointerId !== null) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.longPressFired = false;
    this.element.setPointerCapture(event.pointerId);

    this.clearLongPressTimer();
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      if (this.activePointerId === null) {
        return;
      }
      this.longPressFired = true;
      this.element.dataset.longPress = 'true';
      this.callbacks.onLongPressRecognized?.();
      this.callbacks.onLongPress();
      // Suppress synthetic click after long-press release.
      this.suppressClickUntil = Date.now() + 500;
    }, this.longPressMs);
  }

  private handlePointerMove(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    if (Math.hypot(dx, dy) > this.moveTolerancePx) {
      this.cancelActiveGesture();
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) {
      return;
    }

    const wasLongPress = this.longPressFired;
    this.finishPointer(event.pointerId);
    this.element.dataset.longPress = 'false';

    if (wasLongPress) {
      // Long press already opened the panel — never toggle.
      this.suppressClickUntil = Date.now() + 500;
      return;
    }

    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      this.suppressClickUntil = Date.now() + 400;
    }
    this.callbacks.onTap();
  }

  private handlePointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.cancelActiveGesture();
  }

  private handleClick(event: MouseEvent): void {
    if (Date.now() < this.suppressClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    // Keyboard / accessibility path without pointerdown sequence.
    if (this.activePointerId !== null) {
      return;
    }
    this.callbacks.onTap();
  }

  private cancelActiveGesture(): void {
    const pointerId = this.activePointerId;
    this.clearLongPressTimer();
    this.longPressFired = false;
    this.element.dataset.longPress = 'false';
    if (pointerId !== null) {
      this.finishPointer(pointerId);
    } else {
      this.activePointerId = null;
    }
  }

  private finishPointer(pointerId: number): void {
    this.clearLongPressTimer();
    this.activePointerId = null;
    try {
      if (this.element.hasPointerCapture(pointerId)) {
        this.element.releasePointerCapture(pointerId);
      }
    } catch {
      // Pointer may already be released.
    }
  }

  private clearLongPressTimer(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}

export { LONG_PRESS_MS, LONG_PRESS_MOVE_TOLERANCE_PX };
