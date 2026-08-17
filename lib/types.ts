/**
 * Shared contracts for the Simple Dashboard Homey app.
 */

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Minimal sink matching Homey SimpleClass logging methods.
 * @see https://apps-sdk-v3.developer.homey.app/SimpleClass.html
 */
export interface HomeyLogSink {
  log(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * Future-proof sink interface for Homey diagnostics / external exporters.
 */
export interface LogSink {
  write(level: LogLevel, args: readonly unknown[]): void;
}

export interface Logger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/**
 * Minimal surface of ManagerSettings used by SettingsManager.
 * @see https://apps-sdk-v3.developer.homey.app/ManagerSettings.html
 */
export interface HomeySettingsStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  on(event: 'set', listener: (key: string) => void): void;
}

export interface RequestInfo {
  clientIp: string;
  userAgent: string;
  method: string;
  url: string;
  timestamp: string;
}

export interface HttpResponse {
  readonly statusCode: number;
  readonly contentType: string;
  readonly body: string;
  /** Optional binary payload (notification images). Prefer over encoding bytes as a string. */
  readonly binaryBody?: Buffer;
  readonly cacheControl?: string;
}

export type RequestHandler = (
  info: RequestInfo,
) => HttpResponse | Promise<HttpResponse>;

export interface HttpServerOptions {
  readonly host?: string;
  readonly logger: Logger;
  readonly requestHandler: RequestHandler;
  /** Called after the HTTP server is listening (e.g. attach WebSocket). */
  readonly onListening?: (server: import('node:http').Server) => void | Promise<void>;
  /** Called before the HTTP server closes (e.g. detach WebSocket sessions). */
  readonly onBeforeClose?: () => void | Promise<void>;
}

export const SETTINGS_KEYS = {
  HTTP_PORT: 'httpPort',
  DIAGNOSTICS_ENABLED: 'diagnosticsEnabled',
} as const;

export const DEFAULT_HTTP_PORT = 7999;
export const DEFAULT_DIAGNOSTICS_ENABLED = true;

export const MIN_TCP_PORT = 1;
export const MAX_TCP_PORT = 65535;
