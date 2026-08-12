import { FetchJsonHttpClient, type JsonHttpClient } from '../http/JsonHttpClient';
import { GenericWebDisplayAdapter } from './GenericWebDisplayAdapter';
import { ShellyWallDisplayAdapter } from './ShellyWallDisplayAdapter';
import type { AdapterId, IdentifyResult, WallDisplayAdapter } from './types';

export class UnknownAdapterError extends Error {
  public readonly code = 'UNKNOWN_ADAPTER' as const;

  public constructor(public readonly adapterId: string) {
    super(`Unknown adapter: ${adapterId}`);
    this.name = 'UnknownAdapterError';
  }
}

/**
 * Owns the list of Wall Display adapters. Identification asks each
 * auto-identifying adapter in registration order; the first match wins.
 */
export class AdapterRegistry {
  public constructor(private readonly adapters: readonly WallDisplayAdapter[]) {}

  public getAll(): readonly WallDisplayAdapter[] {
    return this.adapters;
  }

  public getById(adapterId: string): WallDisplayAdapter {
    const adapter = this.adapters.find((item) => item.id === adapterId);
    if (!adapter) {
      throw new UnknownAdapterError(adapterId);
    }

    return adapter;
  }

  public has(adapterId: AdapterId): boolean {
    return this.adapters.some((item) => item.id === adapterId);
  }

  public async identify(ip: string): Promise<IdentifyResult> {
    for (const adapter of this.adapters) {
      if (!adapter.canAutoIdentify) {
        continue;
      }

      const info = await adapter.tryIdentify(ip);
      if (info) {
        return {
          kind: 'matched',
          adapter,
          info,
        };
      }
    }

    return { kind: 'unrecognized' };
  }
}

export function createDefaultAdapterRegistry(
  httpClient: JsonHttpClient = new FetchJsonHttpClient(),
): AdapterRegistry {
  return new AdapterRegistry([
    new ShellyWallDisplayAdapter(httpClient),
    new GenericWebDisplayAdapter(),
  ]);
}
