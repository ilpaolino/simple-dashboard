import type {
  GenericBrowserCapabilities,
  GenericBrowserRuntimeProfile,
  GenericBrowserViewport,
} from './types';

/**
 * Runtime-only browser metadata keyed by displayId.
 * Cleared when the display is removed from the registry.
 */
export class GenericBrowserCapabilityStore {
  private readonly byDisplayId = new Map<string, GenericBrowserRuntimeProfile>();

  public set(
    displayId: string,
    profile: GenericBrowserRuntimeProfile,
  ): void {
    this.byDisplayId.set(displayId, profile);
  }

  public get(displayId: string): GenericBrowserRuntimeProfile | null {
    return this.byDisplayId.get(displayId) ?? null;
  }

  public remove(displayId: string): void {
    this.byDisplayId.delete(displayId);
  }

  public clear(): void {
    this.byDisplayId.clear();
  }
}

export function parseGenericClientHello(value: unknown): {
  readonly capabilities: GenericBrowserCapabilities;
  readonly viewport: GenericBrowserViewport;
} | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as {
    readonly type?: unknown;
    readonly capabilities?: unknown;
    readonly viewport?: unknown;
  };

  if (candidate.type !== 'generic-client-hello') {
    return null;
  }

  const capabilities = parseCapabilities(candidate.capabilities);
  if (!capabilities) {
    return null;
  }

  const viewport = parseViewport(candidate.viewport);
  if (!viewport) {
    return null;
  }

  return { capabilities, viewport };
}

function parseCapabilities(value: unknown): GenericBrowserCapabilities | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.touch !== 'boolean' ||
    typeof candidate.fullscreen !== 'boolean' ||
    typeof candidate.audioPlayback !== 'boolean'
  ) {
    return null;
  }

  return {
    touch: candidate.touch,
    fullscreen: candidate.fullscreen,
    audioPlayback: candidate.audioPlayback,
    canReloadPage:
      typeof candidate.canReloadPage === 'boolean'
        ? candidate.canReloadPage
        : true,
  };
}

function parseViewport(value: unknown): GenericBrowserViewport | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.width !== 'number' ||
    !Number.isFinite(candidate.width) ||
    candidate.width < 0 ||
    typeof candidate.height !== 'number' ||
    !Number.isFinite(candidate.height) ||
    candidate.height < 0 ||
    typeof candidate.devicePixelRatio !== 'number' ||
    !Number.isFinite(candidate.devicePixelRatio) ||
    candidate.devicePixelRatio <= 0
  ) {
    return null;
  }

  return {
    width: Math.round(candidate.width),
    height: Math.round(candidate.height),
    devicePixelRatio: candidate.devicePixelRatio,
  };
}
