export const DEFAULT_HTTP_TIMEOUT_MS = 5000;

export interface JsonHttpClient {
  getJson(url: string, timeoutMs?: number): Promise<unknown>;
}

export class HttpRequestError extends Error {
  public readonly code = 'HTTP_REQUEST_FAILED' as const;

  public constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'HttpRequestError';
  }
}

export class HttpStatusError extends Error {
  public readonly code = 'HTTP_STATUS' as const;

  public constructor(public readonly status: number) {
    super(`HTTP request failed with status ${status}`);
    this.name = 'HttpStatusError';
  }
}

/**
 * Minimal JSON GET client using the Node.js 22 `fetch` available on Homey.
 * @see https://apps.developer.homey.app/upgrade-guides/node-22
 */
export class FetchJsonHttpClient implements JsonHttpClient {
  public async getJson(
    url: string,
    timeoutMs: number = DEFAULT_HTTP_TIMEOUT_MS,
  ): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpStatusError(response.status);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpStatusError) {
        throw error;
      }

      throw new HttpRequestError('JSON HTTP GET failed', error);
    } finally {
      clearTimeout(timer);
    }
  }
}
