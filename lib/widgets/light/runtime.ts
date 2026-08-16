import type { HomeyDeviceRepository } from '../../homey/HomeyDeviceRepository';
import type { HomeyDeviceSnapshot } from '../../homey/types';
import type { Logger } from '../../types';
import {
  EMPTY_LIGHT_CAPABILITIES,
  LIGHT_CAPABILITY_ID,
  LIGHT_DIM_CAPABILITY_ID,
  LIGHT_HUE_CAPABILITY_ID,
  LIGHT_SATURATION_CAPABILITY_ID,
  LIGHT_TEMPERATURE_CAPABILITY_ID,
  hasOnoffCapability,
  resolveLightWidgetCapabilities,
} from './compatibility';
import { normalizeHomeyUnitInterval } from './normalize';
import type {
  LightBindingError,
  LightWidgetConfig,
  LightWidgetDiagnostic,
  LightWidgetRuntimeState,
  LightRuntimeError,
} from './types';
import { normalizeLightTitle, resolveLightDisplayName } from './types';

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
  const title = normalizeLightTitle(options.config.title);
  try {
    const device = await options.repository.getDevice(options.config.deviceId);
    return runtimeFromDevice(
      options.widgetId,
      options.config.deviceId,
      device,
      title,
    );
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
      title,
    );
  }
}

export function resolveLightWidgetRuntimeFromSnapshot(options: {
  readonly widgetId: string;
  readonly deviceId: string;
  readonly device: HomeyDeviceSnapshot | null;
  readonly title?: string;
}): LightRuntimeResolveResult {
  return runtimeFromDevice(
    options.widgetId,
    options.deviceId,
    options.device,
    normalizeLightTitle(options.title),
  );
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
  title: string | undefined,
): LightRuntimeResolveResult {
  if (!device) {
    return runtimeFromError(widgetId, deviceId, 'missing_device', title);
  }

  const hasOnoff = hasOnoffCapability(device);
  const on = parseOnoff(device.capabilityValues[LIGHT_CAPABILITY_ID]);
  const dimPercent = normalizeHomeyUnitInterval(
    device.capabilityValues[LIGHT_DIM_CAPABILITY_ID],
  ).percent;
  const temperaturePercent = normalizeHomeyUnitInterval(
    device.capabilityValues[LIGHT_TEMPERATURE_CAPABILITY_ID],
  ).percent;
  const huePercent = normalizeHomeyUnitInterval(
    device.capabilityValues[LIGHT_HUE_CAPABILITY_ID],
  ).percent;
  const saturationPercent = normalizeHomeyUnitInterval(
    device.capabilityValues[LIGHT_SATURATION_CAPABILITY_ID],
  ).percent;

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

  const capabilities = resolveLightWidgetCapabilities(device, available);

  const state: LightWidgetRuntimeState = {
    type: 'light',
    deviceId,
    name: resolveLightDisplayName(title, device.name),
    available,
    on: resolvedOn,
    dimPercent: capabilities.canDim ? dimPercent : null,
    temperaturePercent: capabilities.canSetTemperature
      ? temperaturePercent
      : null,
    huePercent: capabilities.canSetColor ? huePercent : null,
    saturationPercent: capabilities.canSetColor ? saturationPercent : null,
    capabilities,
    error,
  };

  return {
    state,
    diagnostic: {
      widgetId,
      deviceId,
      resolved: true,
      hasOnoff,
      canDim: capabilities.canDim,
      canSetTemperature: capabilities.canSetTemperature,
      canSetColor: capabilities.canSetColor,
      available,
      on: resolvedOn,
      dimPercent: state.dimPercent,
      temperaturePercent: state.temperaturePercent,
      huePercent: state.huePercent,
      saturationPercent: state.saturationPercent,
      error,
    },
  };
}

function runtimeFromError(
  widgetId: string,
  deviceId: string,
  error: Extract<LightRuntimeError, 'missing_device' | 'api_error'>,
  title?: string,
): LightRuntimeResolveResult {
  const state: LightWidgetRuntimeState = {
    type: 'light',
    deviceId,
    name: resolveLightDisplayName(title, ''),
    available: false,
    on: null,
    dimPercent: null,
    temperaturePercent: null,
    huePercent: null,
    saturationPercent: null,
    capabilities: EMPTY_LIGHT_CAPABILITIES,
    error,
  };

  return {
    state,
    diagnostic: {
      widgetId,
      deviceId,
      resolved: false,
      hasOnoff: false,
      canDim: false,
      canSetTemperature: false,
      canSetColor: false,
      available: false,
      on: null,
      dimPercent: null,
      temperaturePercent: null,
      huePercent: null,
      saturationPercent: null,
      error,
    },
  };
}

export function createLightApiErrorRuntime(
  widgetId: string,
  deviceId: string,
  title?: string,
): LightRuntimeResolveResult {
  return runtimeFromError(widgetId, deviceId, 'api_error', title);
}

export function parseOnoff(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}
