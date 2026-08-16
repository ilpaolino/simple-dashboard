/**
 * Swipe recognizer for Notification Center carousel.
 * Left → next, right → previous. Vertical-dominant motion is ignored.
 */

import {
  NOTIFICATION_SWIPE_HORIZONTAL_RATIO,
  NOTIFICATION_SWIPE_MAX_VERTICAL_PX,
  NOTIFICATION_SWIPE_MIN_DISTANCE_PX,
} from '../../lib/notifications/constants';

export interface SwipeGestureCallbacks {
  readonly onSwipeLeft: () => void;
  readonly onSwipeRight: () => void;
}

export class SwipeGestureRecognizer {
  private readonly element: HTMLElement;
  private readonly callbacks: SwipeGestureCallbacks;
  private readonly minDistancePx: number;
  private readonly maxVerticalPx: number;
  private readonly horizontalRatio: number;

  private activePointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private tracking = false;

  private readonly onPointerDown: (event: PointerEvent) => void;
  private readonly onPointerMove: (event: PointerEvent) => void;
  private readonly onPointerUp: (event: PointerEvent) => void;
  private readonly onPointerCancel: (event: PointerEvent) => void;

  public constructor(
    element: HTMLElement,
    callbacks: SwipeGestureCallbacks,
    options?: {
      readonly minDistancePx?: number;
      readonly maxVerticalPx?: number;
      readonly horizontalRatio?: number;
    },
  ) {
    this.element = element;
    this.callbacks = callbacks;
    this.minDistancePx =
      options?.minDistancePx ?? NOTIFICATION_SWIPE_MIN_DISTANCE_PX;
    this.maxVerticalPx =
      options?.maxVerticalPx ?? NOTIFICATION_SWIPE_MAX_VERTICAL_PX;
    this.horizontalRatio =
      options?.horizontalRatio ?? NOTIFICATION_SWIPE_HORIZONTAL_RATIO;

    this.onPointerDown = (event) => this.handlePointerDown(event);
    this.onPointerMove = (event) => this.handlePointerMove(event);
    this.onPointerUp = (event) => this.handlePointerUp(event);
    this.onPointerCancel = (event) => this.handlePointerCancel(event);

    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerUp);
    this.element.addEventListener('pointercancel', this.onPointerCancel);
  }

  public destroy(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerCancel);
    this.reset();
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return;
    }
    if (this.activePointerId !== null) {
      return;
    }
    // Ignore swipes starting on buttons / interactive controls.
    const target = event.target;
    if (
      typeof Element !== 'undefined' &&
      target instanceof Element &&
      target.closest('button, a, input, textarea, select')
    ) {
      return;
    }

    this.activePointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.tracking = true;
    try {
      this.element.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.tracking || event.pointerId !== this.activePointerId) {
      return;
    }
    const dy = Math.abs(event.clientY - this.startY);
    const dx = Math.abs(event.clientX - this.startX);
    if (dy > this.maxVerticalPx && dy > dx * this.horizontalRatio) {
      this.reset();
    }
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!this.tracking || event.pointerId !== this.activePointerId) {
      return;
    }

    const dx = event.clientX - this.startX;
    const dy = event.clientY - this.startY;
    this.reset();

    if (Math.abs(dy) > this.maxVerticalPx) {
      return;
    }
    if (Math.abs(dx) < this.minDistancePx) {
      return;
    }
    if (Math.abs(dx) < Math.abs(dy) * this.horizontalRatio) {
      return;
    }

    if (dx < 0) {
      this.callbacks.onSwipeLeft();
    } else {
      this.callbacks.onSwipeRight();
    }
  }

  private handlePointerCancel(event: PointerEvent): void {
    if (event.pointerId !== this.activePointerId) {
      return;
    }
    this.reset();
  }

  private reset(): void {
    if (this.activePointerId !== null) {
      try {
        this.element.releasePointerCapture(this.activePointerId);
      } catch {
        // ignore
      }
    }
    this.activePointerId = null;
    this.tracking = false;
  }
}
