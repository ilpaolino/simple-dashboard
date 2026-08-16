import type { HomeyDeviceRepository } from '../../homey/HomeyDeviceRepository';
import type { HomeyDeviceSnapshot } from '../../homey/types';
import type { Logger } from '../../types';
import {
  COVER_CAPABILITY_ID,
  hasWindowcoveringsSetCapability,
} from './compatibility';
import { normalizeWindowcoveringsSet } from './normalize';
import type {
  CoverBindingError,
  CoverWidgetConfig,
  CoverWidgetDiagnostic,
  CoverWidgetRuntimeState,
  CoverRuntimeError,
} from './types';

export interface CoverRuntimeResolveResult {
  readonly state: CoverWidgetRuntimeState;
  readonly diagnostic: CoverWidgetDiagnostic;
}

/**
 * Resolves CoverWidget runtime from Homey at dashboard load (snapshot, no listeners).
 */
export async function resolveCoverWidgetRuntime(options: {
  readonly widgetId: string;
  readonly config: CoverWidgetConfig;
  readonly repository: HomeyDeviceRepository;
  readonly logger?: Logger;
}): Promise<CoverRuntimeResolveResult> {
  try {
    const device = await options.repository.getDevice(options.config.deviceId);
    return runtimeFromDevice(options.widgetId, options.config.deviceId, device);
  } catch (error) {
    options.logger?.error('Failed to read Homey device for CoverWidget', {
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

export function resolveCoverWidgetRuntimeFromSnapshot(options: {
  readonly widgetId: string;
  readonly deviceId: string;
  readonly device: HomeyDeviceSnapshot | null;
}): CoverRuntimeResolveResult {
  return runtimeFromDevice(options.widgetId, options.deviceId, options.device);
}

export async function validateCoverWidgetBinding(options: {
  readonly config: CoverWidgetConfig;
  readonly repository: HomeyDeviceRepository;
}): Promise<
  { readonly ok: true } | { readonly ok: false; readonly error: CoverBindingError }
> {
  let device: HomeyDeviceSnapshot | null;
  try {
    device = await options.repository.getDevice(options.config.deviceId);
  } catch {
    return { ok: false, error: 'device_api_error' };
  }

  if (!device) {
    return { ok: false, error: 'device_missing' };
  }

  if (!hasWindowcoveringsSetCapability(device)) {
    return { ok: false, error: 'missing_windowcoverings_set' };
  }

  return { ok: true };
}

function runtimeFromDevice(
  widgetId: string,
  deviceId: string,
  device: HomeyDeviceSnapshot | null,
): CoverRuntimeResolveResult {
  if (!device) {
    return runtimeFromError(widgetId, deviceId, 'missing_device');
  }

  const hasCapability = hasWindowcoveringsSetCapability(device);
  const normalized = normalizeWindowcoveringsSet(
    device.capabilityValues[COVER_CAPABILITY_ID],
  );

  let error: CoverRuntimeError | null = null;
  let available = device.available;
  let positionPercent = normalized.positionPercent;

  if (!hasCapability) {
    error = 'missing_capability';
    available = false;
    positionPercent = null;
  } else if (!device.available) {
    error = 'unavailable';
    available = false;
  } else if (normalized.positionPercent === null) {
    error = 'invalid_value';
    available = false;
    positionPercent = null;
  }

  const state: CoverWidgetRuntimeState = {
    type: 'cover',
    deviceId,
    name: device.name,
    available,
    positionPercent,
    error,
  };

  return {
    state,
    diagnostic: {
      widgetId,
      deviceId,
      resolved: true,
      hasWindowcoveringsSet: hasCapability,
      available,
      rawValue: hasCapability ? normalized.rawValue : null,
      positionPercent,
      error,
    },
  };
}

function runtimeFromError(
  widgetId: string,
  deviceId: string,
  error: Extract<CoverRuntimeError, 'missing_device' | 'api_error'>,
): CoverRuntimeResolveResult {
  const state: CoverWidgetRuntimeState = {
    type: 'cover',
    deviceId,
    name: '',
    available: false,
    positionPercent: null,
    error,
  };

  return {
    state,
    diagnostic: {
      widgetId,
      deviceId,
      resolved: false,
      hasWindowcoveringsSet: false,
      available: false,
      rawValue: null,
      positionPercent: null,
      error,
    },
  };
}

export function createCoverApiErrorRuntime(
  widgetId: string,
  deviceId: string,
): CoverRuntimeResolveResult {
  return runtimeFromError(widgetId, deviceId, 'api_error');
}
