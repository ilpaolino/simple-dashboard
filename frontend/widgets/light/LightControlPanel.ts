import type { DashboardUiCopy } from '../../../lib/dashboard/types';
import type { LightWidgetRuntimeState } from '../../../lib/widgets/light/types';
import type { CommandStatus } from '../../realtime/WidgetInteractionController';

export interface LightControlPanelActions {
  readonly toggle: () => boolean;
  readonly setDim: (valuePercent: number) => boolean;
  readonly setTemperature: (valuePercent: number) => boolean;
  readonly setColor: (huePercent: number, saturationPercent: number) => boolean;
  readonly isPending: () => boolean;
  readonly onStatus: (
    listener: (status: CommandStatus) => void,
  ) => () => void;
}

export interface LightControlPanelOptions {
  readonly copy: DashboardUiCopy['light'];
  readonly initialRuntime: LightWidgetRuntimeState;
  readonly actions: LightControlPanelActions;
}

type DragKind = 'dim' | 'temperature' | 'color' | null;

/**
 * Light control content hosted inside WidgetControlOverlay.
 * Capability-driven: only supported controls are mounted.
 * Sliders / color pad update local preview until pointerup — one Homey intent.
 */
export class LightControlPanel {
  private readonly root: HTMLElement;
  private readonly copy: DashboardUiCopy['light'];
  private readonly actions: LightControlPanelActions;

  private readonly feedbackEl: HTMLElement;
  private readonly powerButton: HTMLButtonElement | null;
  private readonly dimSection: HTMLElement | null;
  private readonly dimValueEl: HTMLElement | null;
  private readonly dimTrack: HTMLElement | null;
  private readonly dimFill: HTMLElement | null;
  private readonly dimThumb: HTMLElement | null;
  private readonly tempSection: HTMLElement | null;
  private readonly tempValueEl: HTMLElement | null;
  private readonly tempTrack: HTMLElement | null;
  private readonly tempThumb: HTMLElement | null;
  private readonly colorSection: HTMLElement | null;
  private readonly colorSwatch: HTMLElement | null;
  private readonly colorPad: HTMLElement | null;
  private readonly colorThumb: HTMLElement | null;

  private runtime: LightWidgetRuntimeState;
  private commandStatus: CommandStatus = 'idle';
  private dragging: DragKind = null;
  private dragSent = false;
  private activePointerId: number | null = null;
  private previewDim: number | null = null;
  private previewTemp: number | null = null;
  private previewHue: number | null = null;
  private previewSat: number | null = null;
  private pendingDim: number | null = null;
  private pendingTemp: number | null = null;
  private pendingHue: number | null = null;
  private pendingSat: number | null = null;
  private readonly unsubscribeStatus: () => void;

  private readonly onDimPointerDown: (event: PointerEvent) => void;
  private readonly onTempPointerDown: (event: PointerEvent) => void;
  private readonly onColorPointerDown: (event: PointerEvent) => void;
  private readonly onPointerMove: (event: PointerEvent) => void;
  private readonly onPointerUp: (event: PointerEvent) => void;
  private readonly onPointerCancel: (event: PointerEvent) => void;

  public constructor(options: LightControlPanelOptions) {
    this.copy = options.copy;
    this.actions = options.actions;
    this.runtime = options.initialRuntime;

    this.root = document.createElement('div');
    this.root.className = 'control-panel light-control-panel';

    this.feedbackEl = document.createElement('p');
    this.feedbackEl.className = 'control-panel__feedback';
    this.feedbackEl.setAttribute('aria-live', 'polite');

    // Power toggle — always when canToggle (onoff devices).
    if (this.runtime.capabilities.canToggle) {
      const powerRow = document.createElement('div');
      powerRow.className = 'control-row control-row--inline';

      const powerLabel = document.createElement('p');
      powerLabel.className = 'control-label';
      powerLabel.textContent = this.copy.power;

      this.powerButton = document.createElement('button');
      this.powerButton.type = 'button';
      this.powerButton.className = 'control-toggle';
      this.powerButton.addEventListener('click', () => {
        if (!this.controlsEnabled()) {
          return;
        }
        const sent = this.actions.toggle();
        if (sent) {
          this.commandStatus = 'pending';
          this.paint();
        }
      });

      powerRow.appendChild(powerLabel);
      powerRow.appendChild(this.powerButton);
      this.root.appendChild(powerRow);
    } else {
      this.powerButton = null;
    }

    this.root.appendChild(this.feedbackEl);

    // Dimmer
    if (this.runtime.capabilities.canDim) {
      this.dimSection = document.createElement('div');
      this.dimSection.className = 'control-row';

      const label = document.createElement('p');
      label.className = 'control-label';
      label.textContent = this.copy.brightness;

      this.dimValueEl = document.createElement('p');
      this.dimValueEl.className = 'control-value';
      this.dimValueEl.setAttribute('aria-live', 'polite');

      this.dimTrack = document.createElement('div');
      this.dimTrack.className = 'control-slider';
      this.dimTrack.setAttribute('role', 'slider');
      this.dimTrack.setAttribute('aria-orientation', 'horizontal');
      this.dimTrack.setAttribute('aria-valuemin', '0');
      this.dimTrack.setAttribute('aria-valuemax', '100');
      this.dimTrack.setAttribute('aria-label', this.copy.brightness);
      this.dimTrack.tabIndex = 0;

      this.dimFill = document.createElement('div');
      this.dimFill.className = 'control-slider__fill';
      this.dimFill.setAttribute('aria-hidden', 'true');

      this.dimThumb = document.createElement('div');
      this.dimThumb.className = 'control-slider__thumb';
      this.dimThumb.setAttribute('aria-hidden', 'true');

      this.dimTrack.appendChild(this.dimFill);
      this.dimTrack.appendChild(this.dimThumb);

      this.dimSection.appendChild(label);
      this.dimSection.appendChild(this.dimValueEl);
      this.dimSection.appendChild(this.dimTrack);
      this.root.appendChild(this.dimSection);
    } else {
      this.dimSection = null;
      this.dimValueEl = null;
      this.dimTrack = null;
      this.dimFill = null;
      this.dimThumb = null;
    }

    // Temperature — Homey: higher = warmer. UX percent 0 cool … 100 warm.
    if (this.runtime.capabilities.canSetTemperature) {
      this.tempSection = document.createElement('div');
      this.tempSection.className = 'control-row';

      const label = document.createElement('p');
      label.className = 'control-label';
      label.textContent = this.copy.colorTemperature;

      this.tempValueEl = document.createElement('p');
      this.tempValueEl.className = 'control-value';
      this.tempValueEl.setAttribute('aria-live', 'polite');

      const caps = document.createElement('div');
      caps.className = 'control-slider__caps';
      const coolCap = document.createElement('span');
      coolCap.textContent = this.copy.cool;
      const warmCap = document.createElement('span');
      warmCap.textContent = this.copy.warm;
      caps.appendChild(coolCap);
      caps.appendChild(warmCap);

      this.tempTrack = document.createElement('div');
      this.tempTrack.className = 'control-slider control-temperature-slider';
      this.tempTrack.setAttribute('role', 'slider');
      this.tempTrack.setAttribute('aria-orientation', 'horizontal');
      this.tempTrack.setAttribute('aria-valuemin', '0');
      this.tempTrack.setAttribute('aria-valuemax', '100');
      this.tempTrack.setAttribute('aria-label', this.copy.colorTemperature);
      this.tempTrack.tabIndex = 0;

      this.tempThumb = document.createElement('div');
      this.tempThumb.className = 'control-slider__thumb';
      this.tempThumb.setAttribute('aria-hidden', 'true');
      this.tempTrack.appendChild(this.tempThumb);

      this.tempSection.appendChild(label);
      this.tempSection.appendChild(this.tempValueEl);
      this.tempSection.appendChild(caps);
      this.tempSection.appendChild(this.tempTrack);
      this.root.appendChild(this.tempSection);
    } else {
      this.tempSection = null;
      this.tempValueEl = null;
      this.tempTrack = null;
      this.tempThumb = null;
    }

    // Color — hue (X) + saturation (Y); brightness stays on the dimmer.
    if (this.runtime.capabilities.canSetColor) {
      this.colorSection = document.createElement('div');
      this.colorSection.className = 'control-row';

      const header = document.createElement('div');
      header.className = 'control-row control-row--inline';

      const label = document.createElement('p');
      label.className = 'control-label';
      label.textContent = this.copy.color;

      this.colorSwatch = document.createElement('div');
      this.colorSwatch.className = 'control-color-swatch';
      this.colorSwatch.setAttribute('aria-hidden', 'true');

      header.appendChild(label);
      header.appendChild(this.colorSwatch);

      this.colorPad = document.createElement('div');
      this.colorPad.className = 'control-color-pad';
      this.colorPad.setAttribute('role', 'slider');
      this.colorPad.setAttribute('aria-label', this.copy.color);
      this.colorPad.tabIndex = 0;

      this.colorThumb = document.createElement('div');
      this.colorThumb.className = 'control-color-pad__thumb';
      this.colorThumb.setAttribute('aria-hidden', 'true');
      this.colorPad.appendChild(this.colorThumb);

      this.colorSection.appendChild(header);
      this.colorSection.appendChild(this.colorPad);
      this.root.appendChild(this.colorSection);
    } else {
      this.colorSection = null;
      this.colorSwatch = null;
      this.colorPad = null;
      this.colorThumb = null;
    }

    this.onDimPointerDown = (event) => this.beginDrag(event, 'dim');
    this.onTempPointerDown = (event) => this.beginDrag(event, 'temperature');
    this.onColorPointerDown = (event) => this.beginDrag(event, 'color');
    this.onPointerMove = (event) => this.handlePointerMove(event);
    this.onPointerUp = (event) => this.handlePointerUp(event);
    this.onPointerCancel = (event) => this.handlePointerCancel(event);

    this.bindSlider(this.dimTrack, this.onDimPointerDown);
    this.bindSlider(this.tempTrack, this.onTempPointerDown);
    this.bindSlider(this.colorPad, this.onColorPointerDown);

    this.unsubscribeStatus = this.actions.onStatus((status) => {
      this.commandStatus = status;
      if (status === 'success' || status === 'idle') {
        this.clearPendingTargets();
      }
      if (status === 'error' || status === 'timeout') {
        this.clearPendingTargets();
      }
      this.paint();
    });

    this.paint();
  }

  public mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  public updateRuntime(runtime: LightWidgetRuntimeState): void {
    this.runtime = runtime;
    this.paint();
  }

  public destroy(): void {
    this.unsubscribeStatus();
    this.unbindSlider(this.dimTrack, this.onDimPointerDown);
    this.unbindSlider(this.tempTrack, this.onTempPointerDown);
    this.unbindSlider(this.colorPad, this.onColorPointerDown);
    this.root.remove();
  }

  private bindSlider(
    el: HTMLElement | null,
    onDown: (event: PointerEvent) => void,
  ): void {
    if (!el) {
      return;
    }
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', this.onPointerMove);
    el.addEventListener('pointerup', this.onPointerUp);
    el.addEventListener('pointercancel', this.onPointerCancel);
    el.addEventListener('lostpointercapture', () => {
      if (this.dragging !== null) {
        this.finishDrag(false);
      }
    });
  }

  private unbindSlider(
    el: HTMLElement | null,
    onDown: (event: PointerEvent) => void,
  ): void {
    if (!el) {
      return;
    }
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerup', this.onPointerUp);
    el.removeEventListener('pointercancel', this.onPointerCancel);
  }

  private clearPendingTargets(): void {
    this.pendingDim = null;
    this.pendingTemp = null;
    this.pendingHue = null;
    this.pendingSat = null;
  }

  private controlsEnabled(): boolean {
    return (
      this.runtime.available &&
      this.runtime.capabilities.canToggle &&
      this.commandStatus !== 'pending' &&
      !this.actions.isPending()
    );
  }

  private beginDrag(event: PointerEvent, kind: Exclude<DragKind, null>): void {
    if (event.button !== 0 && event.pointerType === 'mouse') {
      return;
    }
    if (!this.controlsEnabled()) {
      return;
    }

    const target =
      kind === 'dim'
        ? this.dimTrack
        : kind === 'temperature'
          ? this.tempTrack
          : this.colorPad;
    if (!target) {
      return;
    }

    event.preventDefault();
    this.dragging = kind;
    this.dragSent = false;
    this.activePointerId = event.pointerId;
    target.setPointerCapture(event.pointerId);
    this.applyPointerPreview(kind, event.clientX, event.clientY);
    this.paint();
  }

  private handlePointerMove(event: PointerEvent): void {
    if (this.dragging === null || event.pointerId !== this.activePointerId) {
      return;
    }
    event.preventDefault();
    this.applyPointerPreview(this.dragging, event.clientX, event.clientY);
    this.paint();
  }

  private handlePointerUp(event: PointerEvent): void {
    if (this.dragging === null || event.pointerId !== this.activePointerId) {
      return;
    }
    event.preventDefault();
    this.applyPointerPreview(this.dragging, event.clientX, event.clientY);
    this.finishDrag(true);
  }

  private handlePointerCancel(event: PointerEvent): void {
    if (this.dragging === null || event.pointerId !== this.activePointerId) {
      return;
    }
    this.finishDrag(false);
  }

  private applyPointerPreview(
    kind: Exclude<DragKind, null>,
    clientX: number,
    clientY: number,
  ): void {
    if (kind === 'dim' && this.dimTrack) {
      this.previewDim = percentFromClientX(this.dimTrack, clientX);
      return;
    }
    if (kind === 'temperature' && this.tempTrack) {
      // Left = cool (0), right = warm (100) — matches Homey higher = warmer.
      this.previewTemp = percentFromClientX(this.tempTrack, clientX);
      return;
    }
    if (kind === 'color' && this.colorPad) {
      const color = colorFromClient(this.colorPad, clientX, clientY);
      this.previewHue = color.huePercent;
      this.previewSat = color.saturationPercent;
    }
  }

  private finishDrag(sendCommand: boolean): void {
    const kind = this.dragging;
    const pointerId = this.activePointerId;
    const dim = this.previewDim;
    const temp = this.previewTemp;
    const hue = this.previewHue;
    const sat = this.previewSat;

    this.dragging = null;
    this.activePointerId = null;
    this.previewDim = null;
    this.previewTemp = null;
    this.previewHue = null;
    this.previewSat = null;

    const track =
      kind === 'dim'
        ? this.dimTrack
        : kind === 'temperature'
          ? this.tempTrack
          : this.colorPad;

    if (pointerId !== null && track) {
      try {
        if (track.hasPointerCapture(pointerId)) {
          track.releasePointerCapture(pointerId);
        }
      } catch {
        // already released
      }
    }

    if (!sendCommand || this.dragSent || kind === null || !this.controlsEnabled()) {
      this.paint();
      return;
    }

    this.dragSent = true;

    if (kind === 'dim' && dim !== null) {
      const sent = this.actions.setDim(dim);
      if (sent) {
        this.pendingDim = dim;
        this.commandStatus = 'pending';
      }
    } else if (kind === 'temperature' && temp !== null) {
      const sent = this.actions.setTemperature(temp);
      if (sent) {
        this.pendingTemp = temp;
        this.commandStatus = 'pending';
      }
    } else if (kind === 'color' && hue !== null && sat !== null) {
      const sent = this.actions.setColor(hue, sat);
      if (sent) {
        this.pendingHue = hue;
        this.pendingSat = sat;
        this.commandStatus = 'pending';
      }
    }

    this.paint();
  }

  private paint(): void {
    const unavailable = !this.runtime.available;
    const enabled = this.controlsEnabled();

    if (this.commandStatus === 'pending') {
      this.feedbackEl.textContent = this.copy.commandInProgress;
    } else if (this.commandStatus === 'timeout') {
      this.feedbackEl.textContent = this.copy.commandTimeout;
    } else if (this.commandStatus === 'error') {
      this.feedbackEl.textContent = this.copy.commandFailed;
    } else if (unavailable) {
      this.feedbackEl.textContent = this.copy.unavailable;
    } else {
      this.feedbackEl.textContent = '\u00a0';
    }

    if (this.powerButton) {
      const on = this.runtime.on === true;
      this.powerButton.textContent = on ? this.copy.on : this.copy.off;
      this.powerButton.setAttribute('aria-pressed', on ? 'true' : 'false');
      this.powerButton.disabled = !enabled;
    }

    // Dim
    if (this.dimTrack && this.dimFill && this.dimThumb && this.dimValueEl) {
      const dim = this.resolveDimPercent();
      this.dimFill.style.width = `${dim}%`;
      this.dimThumb.style.left = `${dim}%`;
      this.dimTrack.setAttribute('aria-valuenow', String(dim));
      this.dimTrack.setAttribute('aria-valuetext', `${dim}%`);
      this.dimTrack.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      this.dimTrack.tabIndex = enabled ? 0 : -1;

      const mode = this.valueMode('dim');
      this.dimValueEl.dataset.mode = mode;
      if (mode === 'preview' || mode === 'target') {
        this.dimValueEl.textContent = `${this.copy.target}: ${dim}%`;
      } else {
        this.dimValueEl.textContent = `${this.copy.current}: ${dim}%`;
      }
    }

    // Temperature
    if (this.tempTrack && this.tempThumb && this.tempValueEl) {
      const temp = this.resolveTempPercent();
      this.tempThumb.style.left = `${temp}%`;
      this.tempTrack.setAttribute('aria-valuenow', String(temp));
      this.tempTrack.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      this.tempTrack.tabIndex = enabled ? 0 : -1;

      const mode = this.valueMode('temperature');
      this.tempValueEl.dataset.mode = mode;
      const label =
        temp <= 33 ? this.copy.cool : temp >= 67 ? this.copy.warm : `${temp}%`;
      if (mode === 'preview' || mode === 'target') {
        this.tempValueEl.textContent = `${this.copy.target}: ${label}`;
      } else {
        this.tempValueEl.textContent = `${this.copy.current}: ${label}`;
      }
    }

    // Color
    if (this.colorPad && this.colorThumb && this.colorSwatch) {
      const hue = this.resolveHuePercent();
      const sat = this.resolveSatPercent();
      this.colorThumb.style.left = `${hue}%`;
      this.colorThumb.style.top = `${100 - sat}%`;
      const css = hslFromPercents(hue, sat);
      this.colorSwatch.style.background = css;
      this.colorPad.setAttribute('aria-disabled', enabled ? 'false' : 'true');
      this.colorPad.tabIndex = enabled ? 0 : -1;
    }

    // Hide sections if capabilities disappeared after live config.
    if (this.dimSection) {
      this.dimSection.hidden = !this.runtime.capabilities.canDim;
    }
    if (this.tempSection) {
      this.tempSection.hidden = !this.runtime.capabilities.canSetTemperature;
    }
    if (this.colorSection) {
      this.colorSection.hidden = !this.runtime.capabilities.canSetColor;
    }

    this.root.dataset.unavailable = unavailable ? 'true' : 'false';
    this.root.dataset.pending =
      this.commandStatus === 'pending' ? 'true' : 'false';
  }

  private valueMode(kind: 'dim' | 'temperature'): 'current' | 'preview' | 'target' {
    if (this.dragging === kind) {
      return 'preview';
    }
    if (kind === 'dim' && this.pendingDim !== null && this.commandStatus === 'pending') {
      return 'target';
    }
    if (
      kind === 'temperature' &&
      this.pendingTemp !== null &&
      this.commandStatus === 'pending'
    ) {
      return 'target';
    }
    return 'current';
  }

  private resolveDimPercent(): number {
    if (this.dragging === 'dim' && this.previewDim !== null) {
      return this.previewDim;
    }
    if (this.pendingDim !== null && this.commandStatus === 'pending') {
      return this.pendingDim;
    }
    return this.runtime.dimPercent ?? 0;
  }

  private resolveTempPercent(): number {
    if (this.dragging === 'temperature' && this.previewTemp !== null) {
      return this.previewTemp;
    }
    if (this.pendingTemp !== null && this.commandStatus === 'pending') {
      return this.pendingTemp;
    }
    return this.runtime.temperaturePercent ?? 50;
  }

  private resolveHuePercent(): number {
    if (this.dragging === 'color' && this.previewHue !== null) {
      return this.previewHue;
    }
    if (this.pendingHue !== null && this.commandStatus === 'pending') {
      return this.pendingHue;
    }
    return this.runtime.huePercent ?? 0;
  }

  private resolveSatPercent(): number {
    if (this.dragging === 'color' && this.previewSat !== null) {
      return this.previewSat;
    }
    if (this.pendingSat !== null && this.commandStatus === 'pending') {
      return this.pendingSat;
    }
    return this.runtime.saturationPercent ?? 100;
  }
}

function percentFromClientX(track: HTMLElement, clientX: number): number {
  const rect = track.getBoundingClientRect();
  if (rect.width <= 0) {
    return 0;
  }
  const ratio = (clientX - rect.left) / rect.width;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function colorFromClient(
  pad: HTMLElement,
  clientX: number,
  clientY: number,
): { readonly huePercent: number; readonly saturationPercent: number } {
  const rect = pad.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return { huePercent: 0, saturationPercent: 100 };
  }
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  return {
    huePercent: Math.max(0, Math.min(100, Math.round(x * 100))),
    // Top = full saturation, bottom = desaturated.
    saturationPercent: Math.max(0, Math.min(100, Math.round((1 - y) * 100))),
  };
}

function hslFromPercents(huePercent: number, saturationPercent: number): string {
  const hue = Math.round((huePercent / 100) * 360);
  const sat = Math.max(0, Math.min(100, saturationPercent));
  return `hsl(${hue} ${sat}% 50%)`;
}
