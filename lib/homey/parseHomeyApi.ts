import type { HomeyApiDeviceDto, HomeyApiZoneDto } from './types';
import {
  parseDeviceClassName,
  parseDeviceImages,
  parseDeviceVideos,
} from './parseHomeyMedia';

export function parseHomeyApiDevice(value: unknown): HomeyApiDeviceDto | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    return null;
  }

  if (typeof candidate.name !== 'string') {
    return null;
  }

  const capabilities = Array.isArray(candidate.capabilities)
    ? candidate.capabilities.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];

  return {
    id: candidate.id,
    name: candidate.name,
    zoneId: parseZoneId(candidate.zone),
    available: candidate.available !== false,
    capabilities,
    capabilityValues: parseCapabilityValues(candidate.capabilitiesObj),
    className: parseDeviceClassName(candidate.class),
    images: parseDeviceImages(candidate.images),
    videos: parseDeviceVideos(candidate.videos),
  };
}

export function parseHomeyApiZone(value: unknown): HomeyApiZoneDto | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
    return null;
  }

  if (typeof candidate.name !== 'string') {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
  };
}

export function parseHomeyApiDeviceCollection(
  value: unknown,
): readonly HomeyApiDeviceDto[] {
  const devices: HomeyApiDeviceDto[] = [];
  for (const item of valuesOf(value)) {
    const parsed = parseHomeyApiDevice(item);
    if (parsed) {
      devices.push(parsed);
    }
  }
  return devices;
}

export function parseHomeyApiZoneCollection(
  value: unknown,
): Readonly<Record<string, HomeyApiZoneDto>> {
  const zones: Record<string, HomeyApiZoneDto> = {};
  for (const item of valuesOf(value)) {
    const parsed = parseHomeyApiZone(item);
    if (parsed) {
      zones[parsed.id] = parsed;
    }
  }
  return zones;
}

function parseZoneId(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  return value;
}

function parseCapabilityValues(
  value: unknown,
): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  const values: Record<string, unknown> = {};
  for (const [capabilityId, capability] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (typeof capability === 'object' && capability !== null && 'value' in capability) {
      values[capabilityId] = (capability as { value: unknown }).value;
    }
  }
  return values;
}

function valuesOf(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value);
  }
  return [];
}
