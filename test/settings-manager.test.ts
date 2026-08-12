import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import { AppLogger } from '../lib/Logger';
import { SettingsManager } from '../lib/SettingsManager';
import {
  DEFAULT_HTTP_PORT,
  SETTINGS_KEYS,
  type HomeyLogSink,
  type HomeySettingsStore,
} from '../lib/types';

class MemorySettings extends EventEmitter implements HomeySettingsStore {
  private readonly values = new Map<string, unknown>();

  public get(key: string): unknown {
    return this.values.get(key);
  }

  public set(key: string, value: unknown): void {
    this.values.set(key, value);
    this.emit('set', key);
  }
}

function createLogger(): AppLogger {
  const sink: HomeyLogSink = {
    log() {},
    error() {},
  };
  return new AppLogger(sink);
}

describe('SettingsManager', () => {
  it('returns default port when unset', () => {
    const settings = new MemorySettings();
    const manager = new SettingsManager(settings, createLogger());
    assert.equal(manager.getHttpPort(), DEFAULT_HTTP_PORT);
  });

  it('persists default port when missing', () => {
    const settings = new MemorySettings();
    const manager = new SettingsManager(settings, createLogger());
    manager.ensureDefaultPort();
    assert.equal(settings.get(SETTINGS_KEYS.HTTP_PORT), DEFAULT_HTTP_PORT);
  });

  it('falls back to default on invalid stored port', () => {
    const settings = new MemorySettings();
    settings.set(SETTINGS_KEYS.HTTP_PORT, 'not-a-port');
    const manager = new SettingsManager(settings, createLogger());
    assert.equal(manager.getHttpPort(), DEFAULT_HTTP_PORT);
  });

  it('notifies listeners when httpPort changes', async () => {
    const settings = new MemorySettings();
    const manager = new SettingsManager(settings, createLogger());
    const ports: number[] = [];

    manager.onHttpPortChange((port) => {
      ports.push(port);
    });

    settings.set(SETTINGS_KEYS.HTTP_PORT, 8100);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.deepEqual(ports, [8100]);
  });
});
