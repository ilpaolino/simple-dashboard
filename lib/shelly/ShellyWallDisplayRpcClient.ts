import {
  HttpRequestError,
  HttpStatusError,
  type JsonHttpClient,
} from '../http/JsonHttpClient';
import { parseListMethodsResponse } from './parseListMethods';
import { SHELLY_RPC_METHODS, SHELLY_RPC_TIMEOUT_MS } from './rpcMethods';
import { ShellyRpcError, type ShellyRpcErrorCode } from './types';

export interface ShellyWallDisplayRpcClientOptions {
  readonly httpClient?: JsonHttpClient;
  readonly timeoutMs?: number;
  readonly fetchImpl?: typeof fetch;
}

/**
 * Shelly Gen2+ RPC client for Wall Display hardware commands.
 * Uses official HTTP GET RPC endpoints.
 * @see https://shelly-api-docs.shelly.cloud/gen2/General/RPCProtocol
 */
export class ShellyWallDisplayRpcClient {
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  public constructor(private readonly options: ShellyWallDisplayRpcClientOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? SHELLY_RPC_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  public async listMethods(ip: string): Promise<readonly string[]> {
    const url = buildRpcUrl(ip, SHELLY_RPC_METHODS.LIST_METHODS);
    const payload = await this.requestJson(url);
    return parseListMethodsResponse(payload).methods;
  }

  /**
   * Reboots the device. A disconnect after a successful call is expected.
   * @see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly#shellyreboot
   */
  public async reboot(ip: string): Promise<void> {
    const url = buildRpcUrl(ip, SHELLY_RPC_METHODS.REBOOT);
    await this.requestJson(url);
  }

  private async requestJson(url: string): Promise<unknown> {
    if (this.options.httpClient) {
      try {
        return await this.options.httpClient.getJson(url, this.timeoutMs);
      } catch (error) {
        throw normalizeTransportError(error);
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ShellyRpcError(
          'http_status',
          `Shelly RPC HTTP ${response.status}`,
        );
      }

      const text = await response.text();
      if (text.trim() === '' || text.trim() === 'null') {
        return null;
      }

      try {
        return JSON.parse(text) as unknown;
      } catch (error) {
        throw new ShellyRpcError(
          'malformed_response',
          'Shelly RPC response is not valid JSON',
          error,
        );
      }
    } catch (error) {
      if (error instanceof ShellyRpcError) {
        throw error;
      }
      throw normalizeTransportError(error);
    } finally {
      clearTimeout(timer);
    }
  }
}

export function buildRpcUrl(ip: string, method: string): string {
  return `http://${ip}/rpc/${method}`;
}

function normalizeTransportError(error: unknown): ShellyRpcError {
  if (error instanceof ShellyRpcError) {
    return error;
  }

  if (error instanceof HttpStatusError) {
    return new ShellyRpcError(
      'http_status',
      `Shelly RPC HTTP ${error.status}`,
      error,
    );
  }

  if (error instanceof HttpRequestError) {
    const code = isAbortError(error.cause) ? 'timeout' : 'network';
    return new ShellyRpcError(code, error.message, error);
  }

  if (isAbortError(error)) {
    return new ShellyRpcError('timeout', 'Shelly RPC request timed out', error);
  }

  return new ShellyRpcError('network', 'Shelly RPC request failed', error);
}

function isAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  return (error as { name?: unknown }).name === 'AbortError';
}

export function shellyRpcErrorCode(error: unknown): ShellyRpcErrorCode {
  if (error instanceof ShellyRpcError) {
    return error.code;
  }
  return 'network';
}
