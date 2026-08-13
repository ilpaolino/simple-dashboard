import {
  LAYOUT_DEFINITIONS,
  type DeviceConfiguration,
  type LayoutId,
} from '../adapters/types';

export function isLayoutId(value: unknown): value is LayoutId {
  return typeof value === 'string' && value in LAYOUT_DEFINITIONS;
}

export function isDeviceConfiguration(value: unknown): value is DeviceConfiguration {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<DeviceConfiguration>;
  if (candidate.version !== 1 || !isLayoutId(candidate.layoutId)) {
    return false;
  }

  if (!Array.isArray(candidate.supportedLayoutIds)) {
    return false;
  }

  if (!candidate.supportedLayoutIds.every(isLayoutId)) {
    return false;
  }

  if (
    typeof candidate.recommended !== 'object' ||
    candidate.recommended === null ||
    !Array.isArray(candidate.recommended.capabilities) ||
    !candidate.recommended.capabilities.every((item) => typeof item === 'string')
  ) {
    return false;
  }

  return true;
}

export function withLayout(
  configuration: DeviceConfiguration,
  layoutId: LayoutId,
): DeviceConfiguration {
  return {
    version: 1,
    layoutId,
    supportedLayoutIds: [...configuration.supportedLayoutIds],
    recommended: {
      capabilities: [...configuration.recommended.capabilities],
    },
  };
}

export function isLayoutSupported(
  configuration: DeviceConfiguration,
  layoutId: string,
): boolean {
  return configuration.supportedLayoutIds.some((id) => id === layoutId);
}

/**
 * Adds newly introduced layout ids (e.g. landscape variants) without
 * changing the currently selected layout.
 */
export function withExpandedSupportedLayouts(
  configuration: DeviceConfiguration,
  extraIds: readonly LayoutId[],
): DeviceConfiguration {
  const merged = mergeLayoutIds(extraIds, configuration.supportedLayoutIds);
  if (sameLayoutIds(merged, configuration.supportedLayoutIds)) {
    return configuration;
  }

  return {
    version: 1,
    layoutId: configuration.layoutId,
    supportedLayoutIds: merged,
    recommended: {
      capabilities: [...configuration.recommended.capabilities],
    },
  };
}

function mergeLayoutIds(
  primary: readonly LayoutId[],
  secondary: readonly LayoutId[],
): readonly LayoutId[] {
  const seen = new Set<LayoutId>();
  const merged: LayoutId[] = [];

  for (const id of [...primary, ...secondary]) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    merged.push(id);
  }

  return merged;
}

function sameLayoutIds(
  left: readonly LayoutId[],
  right: readonly LayoutId[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((id, index) => id === right[index]);
}
