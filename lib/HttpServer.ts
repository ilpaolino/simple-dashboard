import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type {
  HttpServerOptions,
  Logger,
  RequestInfo,
} from './types';

export class PortInUseError extends Error {
  public readonly code = 'EADDRINUSE' as const;

  public constructor(public readonly port: number) {
    super(`Port ${port} is already in use`);
    this.name = 'PortInUseError';
  }
}

export class ServerStartError extends Error {
  public readonly code = 'SERVER_START_FAILED' as const;
  public readonly cause: unknown;

  public constructor(
    public readonly port: number,
    cause: unknown,
  ) {
    super(`Failed to start HTTP server on port ${port}`);
    this.name = 'ServerStartError';
    this.cause = cause;
  }
}

export class ServerStopError extends Error {
  public readonly code = 'SERVER_STOP_FAILED' as const;
  public readonly cause: unknown;

  public constructor(cause: unknown) {
    super('Failed to stop HTTP server');
    this.name = 'ServerStopError';
    this.cause = cause;
  }
}

/**
 * Local HTTP server using Node.js `http` (Homey Node.js runtime).
 * Uses `requireHostHeader: false` as documented for Homey Node.js 22+.
 * @see https://apps.developer.homey.app/upgrade-guides/node-22
 */
export class HttpServer {
  private readonly logger: Logger;
  private readonly requestHandler: HttpServerOptions['requestHandler'];
  private readonly host: string;
  private server: http.Server | null = null;
  private activePort: number | null = null;
  private restartChain: Promise<void> = Promise.resolve();

  public constructor(options: HttpServerOptions) {
    this.logger = options.logger;
    this.requestHandler = options.requestHandler;
    this.host = options.host ?? '0.0.0.0';
  }

  public getPort(): number | null {
    return this.activePort;
  }

  public isListening(): boolean {
    return this.server?.listening === true;
  }

  public async start(port: number): Promise<void> {
    if (this.isListening()) {
      await this.stop();
    }

    const server = http.createServer(
      { requireHostHeader: false },
      (request, response) => {
        this.handleRequest(request, response);
      },
    );

    this.server = server;

    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: NodeJS.ErrnoException): void => {
          server.off('listening', onListening);
          reject(error);
        };

        const onListening = (): void => {
          server.off('error', onError);
          resolve();
        };

        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, this.host);
      });
    } catch (error) {
      this.server = null;
      this.activePort = null;

      if (isErrnoException(error) && error.code === 'EADDRINUSE') {
        const portError = new PortInUseError(port);
        this.logger.error('HTTP server bind failed: port occupied', {
          port,
          host: this.host,
        });
        throw portError;
      }

      this.logger.error('HTTP server failed to start', {
        port,
        host: this.host,
        error,
      });
      throw new ServerStartError(port, error);
    }

    const address = server.address();
    this.activePort = resolveBoundPort(address, port);
    this.logger.info('HTTP server started', {
      host: this.host,
      port: this.activePort,
    });
  }

  public async stop(): Promise<void> {
    const server = this.server;
    if (!server) {
      this.activePort = null;
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      this.logger.info('HTTP server stopped', { port: this.activePort });
    } catch (error) {
      this.logger.error('HTTP server failed to stop cleanly', error);
      throw new ServerStopError(error);
    } finally {
      this.server = null;
      this.activePort = null;
    }
  }

  /**
   * Serializes restarts so concurrent setting changes cannot leak sockets.
   */
  public async restart(port: number): Promise<void> {
    this.restartChain = this.restartChain
      .catch(() => undefined)
      .then(async () => {
        this.logger.info('Restarting HTTP server', { port });
        await this.start(port);
      });

    await this.restartChain;
  }

  private handleRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse,
  ): void {
    const info = extractRequestInfo(request);

    if (request.method === 'GET' && (info.url === '/' || info.url.startsWith('/?'))) {
      const body = this.requestHandler(info);
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(body);
      return;
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
  }
}

function extractRequestInfo(request: http.IncomingMessage): RequestInfo {
  const forwarded = request.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0]?.trim();

  const socketIp = request.socket.remoteAddress ?? 'unknown';

  return {
    clientIp: forwardedIp && forwardedIp.length > 0 ? forwardedIp : socketIp,
    userAgent: headerToString(request.headers['user-agent']) || 'unknown',
    method: request.method ?? 'UNKNOWN',
    url: request.url ?? '/',
    timestamp: new Date().toISOString(),
  };
}

function headerToString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return value ?? '';
}

function resolveBoundPort(address: string | AddressInfo | null, fallback: number): number {
  if (address && typeof address === 'object') {
    return address.port;
  }

  return fallback;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
