import type { HomeyDeviceRepository } from '../../homey/HomeyDeviceRepository';
import type { HomeyDeviceSnapshot } from '../../homey/types';
import type { Logger } from '../../types';
import { LIGHT_CAPABILITY_ID, hasOnoffCapability } from './compatibility';
import type {
  LightBindingError,
  LightWidgetConfig,
  LightWidgetDiagnostic,
  LightWidgetRuntimeState,
  LightRuntimeError,
} from './types';

export interface LightRuntimeResolveResult {
  readonly state: LightWidgetRuntimeState;
  readonly diagnostic: LightWidgetDiagnostic;
}

/**
 * Resolves LightWidget runtime from Homey at dashboard load (snapshot, no listeners).
 */
export async function resolveLightWidgetRuntime(options: {
  readonly widgetId: string;
  readonly config: LightWidgetConfig;
  readonly repository: HomeyDeviceRepository;
  readonly logger?: Logger;
}): Promise<LightRuntimeResolveResult> {
  try {
    const device = await options.repository.getDevice(options.config.deviceId);
    return runtimeFromDevice(options.widgetId, options.config.deviceId, device);
  } catch (error) {
    options.logger?.error('Failed to read Homey device for LightWidget', {
      widgetId: options.widgetId,
      deviceId: options.config.deviceId,
      error,
    });
    return runtimeFromError(
      options.widgetId,
      options.config.deviceId,
      'api_error',
    );
  }
}

export function resolveLightWidgetRuntimeFromSnapshot(options: {
  readonly widgetId: string;
  readonly deviceId: string;
  readonly device: HomeyDeviceSnapshot | null;
}): LightRuntimeResolveResult {
  return runtimeFromDevice(options.widgetId, options.deviceId, options.device);
}

export async function validateLightWidgetBinding(options: {
  readonly config: LightWidgetConfig;
  readonly repository: HomeyDeviceRepository;
}): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: LightBindingError }> {
  let device: HomeyDeviceSnapshot | null;
  try {
    device = await options.repository.getDevice(options.config.deviceId);
  } catch {
    return { ok: false, error: 'device_api_error' };
  }

  if (!device) {
    return { ok: false, error: 'device_missing' };
  }

  if (!hasOnoffCapability(device)) {
    return { ok: false, error: 'missing_onoff' };
  }

  return { ok: true };
}

function runtimeFromDevice(
  widgetId: string,
  deviceId: string,
  device: HomeyDeviceSnapshot | null,
): LightRuntimeResolveResult {
  if (!device) {
    return runtimeFromError(widgetId, deviceId, 'missing_device');
  }

  const hasOnoff = hasOnoffCapability(device);
  const on = parseOnoff(device.capabilityValues[LIGHT_CAPABILITY_ID]);

  let error: LightRuntimeError | null = null;
  let available = device.available;
  let resolvedOn = on;

  if (!hasOnoff) {
    error = 'missing_capability';
    available = false;
    resolvedOn = null;
  } else if (!device.available) {
    error = 'unavailable';
    available = false;
  } else if (on === null) {
    error = 'invalid_value';
    available = false;
  }

  const state: LightWidgetRuntimeState = {
    type: 'light',
    deviceId,
    name: device.name,
    available,
    on: resolvedOn,
    error,
  };

  return {
    state,
    diagnostic: {
      widgetId,
      deviceId,
      resolved: true,
      hasOnoff,
      available,
      on: resolvedOn,
      error,
    },
  };
}

function runtimeFromError(
  widgetId: string,
  deviceId: string,
  error: Extract<LightRuntimeError, 'missing_device' | 'api_error'>,
): LightRuntimeResolveResult {
  const state: LightWidgetRuntimeState = {
    type: 'light',
    deviceId,
    name: '',
    available: false,
    on: null,
    error,
  };

  return {
    state,
    diagnostic: {
      widgetId,
      deviceId,
      resolved: false,
      hasOnoff: false,
      available: false,
      on: null,
      error,
    },
  };
}

export function createLightApiErrorRuntime(
  widgetId: string,
  deviceId: string,
): LightRuntimeResolveResult {
  return runtimeFromError(widgetId, deviceId, 'api_error');
}

export function parseOnoff(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
