import type { DeviceConfiguration, LayoutId } from '../adapters/types';

export function isLayoutId(value: unknown): value is LayoutId {
  return value === '2x2' || value === '3x3' || value === '2x4' || value === '3x6';
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
    supportedLayoutIds: configuration.supportedLayoutIds,
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
