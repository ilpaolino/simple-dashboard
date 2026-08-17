import { ShellyRpcError } from './types';

export interface ListMethodsResult {
  readonly methods: readonly string[];
}

/**
 * Parses Shelly.ListMethods HTTP GET / JSON-RPC result.
 * @see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly#shellylistmethods
 */
export function parseListMethodsResponse(value: unknown): ListMethodsResult {
  const payload = unwrapRpcResult(value);

  if (typeof payload !== 'object' || payload === null) {
    throw new ShellyRpcError(
      'malformed_response',
      'Shelly.ListMethods response is not an object',
    );
  }

  const candidate = payload as Record<string, unknown>;
  if (!Array.isArray(candidate.methods)) {
    throw new ShellyRpcError(
      'malformed_response',
      'Shelly.ListMethods response missing methods array',
    );
  }

  const methods: string[] = [];
  for (const entry of candidate.methods) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new ShellyRpcError(
        'malformed_response',
        'Shelly.ListMethods contains invalid method name',
      );
    }
    methods.push(entry);
  }

  return { methods };
}

function unwrapRpcResult(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }

  const candidate = value as Record<string, unknown>;
  if ('error' in candidate && candidate.error !== undefined) {
    throw new ShellyRpcError('rpc_error', parseRpcErrorMessage(candidate.error));
  }

  if ('result' in candidate) {
    return candidate.result;
  }

  return value;
}

function parseRpcErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }
  }
  return 'Shelly RPC error';
}
