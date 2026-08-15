import type { LightVisualState, LightWidgetRuntimeState } from './types';

export function resolveLightVisualState(
  runtime: LightWidgetRuntimeState | undefined,
): LightVisualState {
  if (!runtime || !runtime.available || runtime.on === null) {
    return 'unavailable';
  }

  return runtime.on ? 'on' : 'off';
}

export function lightVisualStateClass(state: LightVisualState): string {
  return `widget-light--state-${state}`;
}
