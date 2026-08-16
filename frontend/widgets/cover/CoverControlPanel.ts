import type { DashboardUiCopy } from '../../../lib/dashboard/types';
import type { CoverWidgetRuntimeState } from '../../../lib/widgets/cover/types';
import { formatCoverPositionPercent } from '../../../lib/widgets/cover/visual';
import type { CommandStatus } from '../../realtime/WidgetInteractionController';

export interface CoverControlPanelActions {
  readonly setPosition: (positionPercent: number) => boolean;
  readonly stop: () => boolean;
  readonly isPending: () => boolean;
  readonly onStatus: (
    listener: (status: CommandStatus) => void,
  ) => () => void;
}

export interface CoverControlPanelOptions {
  readonly copy: DashboardUiCopy['cover'];
  readonly initialRuntime: CoverWidgetRuntimeState;
  readonly actions: CoverControlPanelActions;
}

/**
 * Cover control content hosted inside WidgetControlOverlay.
 * Slider updates are local until pointerup — one Homey intent per release.
 */
export class CoverControlPanel {
  private readonly root: HTMLElement;
  private readonly copy: DashboardUiCopy['cover'];
  private readonly actions: CoverControlPanelActions;

  private readonly currentEl: HTMLElement;
  private readonly feedbackEl: HTMLElement;
  private readonly sliderTrack: HTMLElement;
  private readonly sliderFill: HTMLElement;
  private readonly sliderThumb: HTMLElement;
  private readonly sliderValueEl: HTMLElement;
  private readonly openButton: HTMLButtonElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly stopButton: HTMLButtonElement;

  private runtime: CoverWidgetRuntimeState;
  private previewPercent: number | null = null;
  private pendingTarget: number | null = null;
  private commandStatus: CommandStatus = 'idle';
  private dragging = false;
  private dragSent = false;
  private activePointerId: number | null = null;
  private readonly unsubscribeStatus: () => void;

  private readonly onPointerDown: (event: PointerEvent) => void;
  private readonly onPointerMove: (event: PointerEvent) => void;
  private readonly onPointerUp: (event: PointerEvent) => void;
  private readonly onPointerCancel: (event: PointerEvent) => void;

  public constructor(options: CoverControlPanelOptions) {
    this.copy = options.copy;
    this.actions = options.actions;
    this.runtime = options.initialRuntime;

    this.root = document.createElement('div');
    this.root.className = 'cover-control-panel';

    this.currentEl = document.createElement('p');
    this.currentEl.className = 'cover-control-panel__current';

    this.feedbackEl = document.createElement('p');
    this.feedbackEl.className = 'cover-control-panel__feedback';
    // Reserved line height — never toggle display, avoid touch layout shift.
    this.feedbackEl.setAttribute('aria-live', 'polite');

    const sliderSection = document.createElement('div');
    sliderSection.className = 'cover-control-panel__slider-section';

    const sliderColumn = document.createElement('div');
    sliderColumn.className = 'cover-control-panel__slider-column';

    const openLabel = document.createElement('span');
    openLabel.className = 'cover-control-panel__slider-cap';
    openLabel.textContent = '100%';

    const closedLabel = document.createElement('span');
    closedLabel.className = 'cover-control-panel__slider-cap';
    closedLabel.textContent = '0%';

    this.sliderTrack = document.createElement('div');
    this.sliderTrack.className = 'cover-control-panel__slider';
    this.sliderTrack.setAttribute('role', 'slider');
    this.sliderTrack.setAttribute('aria-orientation', 'vertical');
    this.sliderTrack.setAttribute('aria-valuemin', '0');
    this.sliderTrack.setAttribute('aria-valuemax', '100');
    this.sliderTrack.tabIndex = 0;

    this.sliderFill = document.createElement('div');
    this.sliderFill.className = 'cover-control-panel__slider-fill';
    this.sliderFill.setAttribute('aria-hidden', 'true');

    this.sliderThumb = document.createElement('div');
    this.sliderThumb.className = 'cover-control-panel__slider-thumb';
    this.sliderThumb.setAttribute('aria-hidden', 'true');

    this.sliderTrack.appendChild(this.sliderFill);
    this.sliderTrack.appendChild(this.sliderThumb);

    sliderColumn.appendChild(openLabel);
    sliderColumn.appendChild(this.sliderTrack);
    sliderColumn.appendChild(closedLabel);

    const valueColumn = document.createElement('div');
    valueColumn.className = 'cover-control-panel__value-column';

    this.sliderValueEl = document.createElement('span');
    this.sliderValueEl.className = 'cover-control-panel__value';
    this.sliderValueEl.setAttribute('aria-live', 'polite');

    valueColumn.appendChild(this.sliderValueEl);

    sliderSection.appendChild(sliderColumn);
    sliderSection.appendChild(valueColumn);

    const actions = document.createElement('div');
    actions.className = 'cover-control-panel__actions';

    this.openButton = document.createElement('button');
    this.openButton.type = 'button';
    this.openButton.className = 'cover-control-panel__button cover-control-panel__button--open';
    this.openButton.textContent = this.copy.open;

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className =
      'cover-control-panel__button cover-control-panel__button--close';
    this.closeButton.textContent = this.copy.close;

    this.stopButton = document.createElement('button');
    this.stopButton.type = 'button';
    this.stopButton.className =
      'cover-control-panel__button cover-control-panel__button--stop';
    this.stopButton.textContent = this.copy.stop;

    actions.appendChild(this.openButton);
    actions.appendChild(this.closeButton);
    actions.appendChild(this.stopButton);

    this.root.appendChild(this.currentEl);
    this.root.appendChild(this.feedbackEl);
    this.root.appendChild(sliderSection);
    this.root.appendChild(actions);

    this.onPointerDown = (event) => this.handlePointerDown(event);
    this.onPointerMove = (event) => this.handlePointerMove(event);
    this.onPointerUp = (event) => this.handlePointerUp(event);
    this.onPointerCancel = (event) => this.handlePointerCancel(event);

    this.sliderTrack.addEventListener('pointerdown', this.onPointerDown);
    this.sliderTrack.addEventListener('pointermove', this.onPointerMove);
    this.sliderTrack.addEventListener('pointerup', this.onPointerUp);
    this.sliderTrack.addEventListener('pointercancel', this.onPointerCancel);
    this.sliderTrack.addEventListener('lostpointercapture', () => {
      if (this.dragging) {
        this.finishDrag(false);
      }
    });

    this.openButton.addEventListener('click', () => {
      this.requestPosition(100);
    });
    this.closeButton.addEventListener('click', () => {
      this.requestPosition(0);
    });
    this.stopButton.addEventListener('click', () => {
      if (!this.runtime.capabilities.canStop || !this.controlsEnabled()) {
        return;
      }
      const sent = this.actions.stop();
      if (sent) {
        this.pendingTarget = null;
        this.commandStatus = 'pending';
        this.paint();
      }
    });

    this.unsubscribeStatus = this.actions.onStatus((status) => {
      this.commandStatus = status;
      if (status === 'success' || status === 'idle') {
        this.pendingTarget = null;
      }
      if (status === 'error' || status === 'timeout') {
        this.pendingTarget = null;
      }
      this.paint();
    });

    this.paint();
  }

  public mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  public updateRuntime(runtime: CoverWidgetRuntimeState): void {
    this.runtime = runtime;
    this.paint();
  }

  public destroy(): void {
    this.unsubscribeStatus();
    this.sliderTrack.removeEventListener('pointerdown', this.onPointerDown);
    this.sliderTrack.removeEventListener('pointermove', this.onPointerMove);
    this.sliderTrack.removeEventListener('pointerup', this.onPointerUp);
    this.sliderTrack.removeEventListener('pointercancel', this.onPointerCancel);
    this.root.remove();
  }

  private controlsEnabled(): boolean {
    return (
      this.runtime.available &&
      this.runtime.capabilities.canSetPosition &&
      this.commandStatus !== 'pending' &&
      !this.actions.isPending()
    );
  }

  private stopEnabled(): boolean {
    if (!this.runtime.available || !this.runtime.capabilities.canStop) {
      return false;
    }
    // Stop may interrupt an in-flight set-position.
    return true;
  }

  private displayPercent(): number {
    if (this.dragging && this.previewPercent !== null) {
      return this.previewPercent;
    }
    if (this.pendingTarget !== null) {
      return this.pendingTarget;
    }
    return this.runtime.positionPercent ?? 0;
  }

  private requestPosition(positionPercent: number): void {
    if (!this.controlsEnabled()) {
      return;
    }
    const sent = this.actions.setPosition(positionPercent);
    if (sent) {
      this.pendingTarget = positionPercent;
      this.commandStatus = 'pending';
      this.paint();
    }
  }

  private handlePointerDown(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return;
    }
    if (!this.controlsEnabled()) {
      return;
    }

    event.preventDefault();
    this.dragging = true;
    this.dragSent = false;
    this.activePointerId = event.pointerId;
    this.sliderTrack.setPointerCapture(event.pointerId);
    this.previewPercent = this.percentFromClientY(event.clientY);
    this.paint();
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.dragging || event.pointerId !== this.activePointerId) {
      return;
    }
    event.preventDefault();
    this.previewPercent = this.percentFromClientY(event.clientY);
    this.paint();
  }

  private handlePointerUp(event: PointerEvent): void {
    if (!this.dragging || event.pointerId !== this.activePointerId) {
      return;
    }
    event.preventDefault();
    this.previewPercent = this.percentFromClientY(event.clientY);
    this.finishDrag(true);
  }

  private handlePointerCancel(event: PointerEvent): void {
    if (!this.dragging || event.pointerId !== this.activePointerId) {
      return;
    }
    this.finishDrag(false);
  }

  private finishDrag(sendCommand: boolean): void {
    const pointerId = this.activePointerId;
    const target = this.previewPercent;
    this.dragging = false;
    this.activePointerId = null;
    this.previewPercent = null;

    if (pointerId !== null) {
      try {
        if (this.sliderTrack.hasPointerCapture(pointerId)) {
          this.sliderTrack.releasePointerCapture(pointerId);
        }
      } catch {
        // Pointer may already be released.
      }
    }

    if (
      sendCommand &&
      !this.dragSent &&
      target !== null &&
      this.controlsEnabled()
    ) {
      this.dragSent = true;
      this.requestPosition(target);
    } else {
      this.paint();
    }
  }

  private percentFromClientY(clientY: number): number {
    const rect = this.sliderTrack.getBoundingClientRect();
    if (rect.height <= 0) {
      return this.runtime.positionPercent ?? 0;
    }
    // Top = 100% open, bottom = 0% closed.
    const ratio = (rect.bottom - clientY) / rect.height;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  }

  private paint(): void {
    const unavailable = !this.runtime.available;
    const currentFormatted =
      formatCoverPositionPercent(this.runtime.positionPercent) ??
      this.copy.unavailable;

    this.currentEl.textContent = unavailable
      ? this.copy.unavailable
      : `${this.copy.currentPosition}: ${currentFormatted}`;

    if (this.commandStatus === 'pending') {
      this.feedbackEl.textContent = this.copy.commandInProgress;
    } else if (
      this.commandStatus === 'error' ||
      this.commandStatus === 'timeout'
    ) {
      this.feedbackEl.textContent =
        this.commandStatus === 'timeout'
          ? this.copy.commandTimeout
          : this.copy.commandFailed;
    } else {
      // Keep a non-breaking space so the reserved line never collapses.
      this.feedbackEl.textContent = '\u00a0';
    }

    const percent = this.displayPercent();
    this.sliderFill.style.height = `${percent}%`;
    this.sliderThumb.style.bottom = `calc(${percent}% - 0.75rem)`;
    this.sliderValueEl.textContent = `${percent}%`;

    if (this.dragging) {
      this.root.dataset.valueMode = 'preview';
    } else if (this.pendingTarget !== null && this.commandStatus === 'pending') {
      this.root.dataset.valueMode = 'target';
    } else {
      this.root.dataset.valueMode = 'current';
    }

    this.sliderTrack.setAttribute('aria-valuenow', String(percent));
    this.sliderTrack.setAttribute('aria-valuetext', `${percent}%`);
    this.sliderTrack.setAttribute('aria-label', this.copy.moveToPosition);

    const canSet = this.controlsEnabled();
    this.sliderTrack.tabIndex = canSet ? 0 : -1;
    this.sliderTrack.setAttribute('aria-disabled', canSet ? 'false' : 'true');
    this.openButton.disabled = !canSet;
    this.closeButton.disabled = !canSet;

    const showStop = this.runtime.capabilities.canStop;
    this.stopButton.hidden = !showStop;
    this.stopButton.disabled = !this.stopEnabled();

    this.root.dataset.unavailable = unavailable ? 'true' : 'false';
    this.root.dataset.pending =
      this.commandStatus === 'pending' ? 'true' : 'false';
  }
}
