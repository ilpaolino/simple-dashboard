import type {
  HomeyLogSink,
  LogLevel,
  LogSink,
  Logger,
} from './types';

/**
 * Centralized application logger.
 *
 * Homey SimpleClass exposes only `log` and `error`
 * (https://apps-sdk-v3.developer.homey.app/SimpleClass.html).
 * WARN is therefore routed through `log` with an explicit level tag.
 *
 * Additional LogSink implementations can be registered later for Homey
 * diagnostics without changing call sites.
 */
export class AppLogger implements Logger {
  private readonly sinks: LogSink[];

  public constructor(
    homeySink: HomeyLogSink,
    extraSinks: readonly LogSink[] = [],
  ) {
    this.sinks = [new HomeyLogSinkAdapter(homeySink), ...extraSinks];
  }

  public info(...args: unknown[]): void {
    this.write('info', args);
  }

  public warn(...args: unknown[]): void {
    this.write('warn', args);
  }

  public error(...args: unknown[]): void {
    this.write('error', args);
  }

  public addSink(sink: LogSink): void {
    this.sinks.push(sink);
  }

  private write(level: LogLevel, args: readonly unknown[]): void {
    for (const sink of this.sinks) {
      sink.write(level, args);
    }
  }
}

class HomeyLogSinkAdapter implements LogSink {
  public constructor(private readonly homeySink: HomeyLogSink) {}

  public write(level: LogLevel, args: readonly unknown[]): void {
    const taggedArgs = [`[${level.toUpperCase()}]`, ...args];

    if (level === 'error') {
      this.homeySink.error(...taggedArgs);
      return;
    }

    this.homeySink.log(...taggedArgs);
  }
}
