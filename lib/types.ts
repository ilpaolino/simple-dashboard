/**
 * Shared contracts for Milestone 0.
 * Extension points only — no future milestone behavior is implemented here.
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

export interface HttpServerOptions {
  readonly host?: string;
  readonly logger: Logger;
  readonly requestHandler: (info: RequestInfo) => string;
}

export const SETTINGS_KEYS = {
  HTTP_PORT: 'httpPort',
} as const;

export const DEFAULT_HTTP_PORT = 7999;

export const MIN_TCP_PORT = 1;
export const MAX_TCP_PORT = 65535;
