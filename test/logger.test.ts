import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppLogger } from '../lib/Logger';
import type { HomeyLogSink, LogLevel, LogSink } from '../lib/types';

describe('AppLogger', () => {
  it('routes info and warn through Homey log, error through Homey error', () => {
    const calls: Array<{ method: 'log' | 'error'; args: unknown[] }> = [];
    const sink: HomeyLogSink = {
      log: (...args: unknown[]) => {
        calls.push({ method: 'log', args });
      },
      error: (...args: unknown[]) => {
        calls.push({ method: 'error', args });
      },
    };

    const logger = new AppLogger(sink);
    logger.info('hello');
    logger.warn('careful');
    logger.error('boom');

    assert.deepEqual(calls, [
      { method: 'log', args: ['[INFO]', 'hello'] },
      { method: 'log', args: ['[WARN]', 'careful'] },
      { method: 'error', args: ['[ERROR]', 'boom'] },
    ]);
  });

  it('forwards entries to extra sinks for future diagnostics', () => {
    const levels: LogLevel[] = [];
    const extra: LogSink = {
      write(level) {
        levels.push(level);
      },
    };

    const noop: HomeyLogSink = {
      log() {},
      error() {},
    };

    const logger = new AppLogger(noop, [extra]);
    logger.info('a');
    logger.warn('b');
    logger.error('c');

    assert.deepEqual(levels, ['info', 'warn', 'error']);
  });
});
