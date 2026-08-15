import type { HomeyDeviceRepository } from '../homey/HomeyDeviceRepository';
import type { HomeyDeviceSnapshot } from '../homey/types';
import type { Logger } from '../types';
import {
  createLightApiErrorRuntime,
  resolveLightWidgetRuntimeFromSnapshot,
  type LightRuntimeResolveResult,
} from './light/runtime';
import type { LightWidgetDiagnostic } from './light/types';
import type { WidgetInstance, WidgetRuntimeState } from './types';

export interface DashboardRuntimeResolveResult {
  readonly states: Readonly<Record<string, WidgetRuntimeState>>;
  readonly diagnostics: readonly LightWidgetDiagnostic[];
}

/**
 * Snapshot resolver: one Homey device list at dashboard load, no polling.
 * Each widget is isolated so one failure cannot block the others.
 */
export async function resolveDashboardRuntime(options: {
  readonly widgets: readonly WidgetInstance[];
  readonly repository: HomeyDeviceRepository | null;
  readonly logger?: Logger;
}): Promise<DashboardRuntimeResolveResult> {
  const lightWidgets = options.widgets.filter(
    (widget): widget is WidgetInstance & { readonly type: 'light' } =>
      widget.type === 'light',
  );

  if (lightWidgets.length === 0) {
    return { states: {}, diagnostics: [] };
  }

  let devicesById: ReadonlyMap<string, HomeyDeviceSnapshot> | null = null;
  let listError: unknown = null;

  if (options.repository) {
    try {
      const devices = await options.repository.listDevices();
      devicesById = new Map(devices.map((device) => [device.id, device]));
    } catch (error) {
      listError = error;
      options.logger?.error('Failed to list Homey devices for dashboard snapshot', error);
    }
  } else {
    listError = new Error('Homey device repository is not available');
  }

  const states: Record<string, WidgetRuntimeState> = {};
  const diagnostics: LightWidgetDiagnostic[] = [];

  for (const widget of lightWidgets) {
    const resolved = resolveOneLight({
      widget,
      devicesById,
      listError,
    });
    states[widget.id] = resolved.state;
    diagnostics.push(resolved.diagnostic);
  }

  return { states, diagnostics };
}

function resolveOneLight(options: {
  readonly widget: WidgetInstance & { readonly type: 'light' };
  readonly devicesById: ReadonlyMap<string, HomeyDeviceSnapshot> | null;
  readonly listError: unknown;
}): LightRuntimeResolveResult {
  if (options.listError !== null || options.devicesById === null) {
    return createLightApiErrorRuntime(
      options.widget.id,
      options.widget.config.deviceId,
    );
  }

  const device =
    options.devicesById.get(options.widget.config.deviceId) ?? null;

  return resolveLightWidgetRuntimeFromSnapshot({
    widgetId: options.widget.id,
    deviceId: options.widget.config.deviceId,
    device,
  });
}
