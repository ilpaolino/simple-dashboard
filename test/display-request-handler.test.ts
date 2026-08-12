import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdapterRegistry } from '../lib/adapters/AdapterRegistry';
import { GenericWebDisplayAdapter } from '../lib/adapters/GenericWebDisplayAdapter';
import { ShellyWallDisplayAdapter } from '../lib/adapters/ShellyWallDisplayAdapter';
import { ADAPTER_IDS, LAYOUT_IDS } from '../lib/adapters/types';
import { DiagnosticsLog } from '../lib/diagnostics/DiagnosticsLog';
import { DisplayRegistry } from '../lib/display/DisplayRegistry';
import { DISPLAY_TYPE_IDS } from '../lib/display/types';
import { DisplayRequestHandler } from '../lib/http/DisplayRequestHandler';
import type { JsonHttpClient } from '../lib/http/JsonHttpClient';
import type { Logger, RequestInfo } from '../lib/types';

class MockJsonHttpClient implements JsonHttpClient {
  public constructor(private readonly payload: unknown | Error) {}

  public async getJson(): Promise<unknown> {
    if (this.payload instanceof Error) {
      throw this.payload;
    }
    return this.payload;
  }
}

const silentLogger: Logger = {
  info() {},
  warn() {},
  error() {},
};

const translate = (key: string): string => key;

function request(overrides: Partial<RequestInfo> = {}): RequestInfo {
  return {
    clientIp: '192.168.1.30',
    userAgent: 'test-agent',
    method: 'GET',
    url: '/',
    timestamp: '2026-08-13T00:00:00.000Z',
    ...overrides,
  };
}

describe('DisplayRequestHandler', () => {
  it('returns unconfigured for unknown IPs', async () => {
    const registry = new DisplayRegistry();
    const handler = new DisplayRequestHandler({
      registry,
      adapters: new AdapterRegistry([new GenericWebDisplayAdapter()]),
      diagnosticsLog: new DiagnosticsLog(),
      logger: silentLogger,
      translate,
      getLanguage: () => 'en',
      isDiagnosticsEnabled: () => true,
      isServerListening: () => true,
      getPort: () => 7999,
      getUptimeSeconds: () => 12,
    });

    const response = await handler.handle(request({ clientIp: '10.0.0.9' }));
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /pages\.unconfigured\.heading/);
  });

  it('recognizes a Generic display by IP', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'gen-1',
        name: 'Office',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.40',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
      },
    ]);

    const handler = new DisplayRequestHandler({
      registry,
      adapters: new AdapterRegistry([new GenericWebDisplayAdapter()]),
      diagnosticsLog: new DiagnosticsLog(),
      logger: silentLogger,
      translate,
      getLanguage: () => 'en',
      isDiagnosticsEnabled: () => true,
      isServerListening: () => true,
      getPort: () => 7999,
      getUptimeSeconds: () => 12,
    });

    const response = await handler.handle(
      request({ clientIp: '192.168.1.40' }),
    );
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /pages\.recognized\.heading/);
    assert.match(response.body, /Office/);
    assert.match(response.body, /2x4/);
    assert.equal(registry.getOnlineStatus('gen-1'), 'online');
  });

  it('rejects Shelly hardware mismatches', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'shellywalldisplay-abc',
        name: 'Kitchen',
        typeId: DISPLAY_TYPE_IDS.SHELLY_WALL_DISPLAY,
        ipAddress: '192.168.1.30',
        hardwareId: 'shellywalldisplay-abc',
        layoutId: LAYOUT_IDS.GRID_3X3,
      },
    ]);

    const handler = new DisplayRequestHandler({
      registry,
      adapters: new AdapterRegistry([
        new ShellyWallDisplayAdapter(
          new MockJsonHttpClient({
            id: 'shellywalldisplay-xyz',
            model: 'SAWD-0A1XX10EU1',
            app: 'WallDisplay',
          }),
        ),
      ]),
      diagnosticsLog: new DiagnosticsLog(),
      logger: silentLogger,
      translate,
      getLanguage: () => 'en',
      isDiagnosticsEnabled: () => true,
      isServerListening: () => true,
      getPort: () => 7999,
      getUptimeSeconds: () => 12,
    });

    const response = await handler.handle(request());
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /pages\.mismatch\.heading/);
    assert.equal(
      registry.getById('shellywalldisplay-abc')?.runtime.lastMatchStatus,
      'hardware_mismatch',
    );
  });

  it('returns 403 when diagnostics are disabled', async () => {
    const handler = new DisplayRequestHandler({
      registry: new DisplayRegistry(),
      adapters: new AdapterRegistry([
        new ShellyWallDisplayAdapter(new MockJsonHttpClient({})),
      ]),
      diagnosticsLog: new DiagnosticsLog(),
      logger: silentLogger,
      translate,
      getLanguage: () => 'en',
      isDiagnosticsEnabled: () => false,
      isServerListening: () => true,
      getPort: () => 7999,
      getUptimeSeconds: () => 12,
    });

    const response = await handler.handle(
      request({ url: '/diagnostics' }),
    );
    assert.equal(response.statusCode, 403);
    assert.match(response.body, /pages\.diagnosticsDisabled\.heading/);
  });

  it('serves diagnostics when enabled', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: ADAPTER_IDS.GENERIC_WEB_DISPLAY,
        name: 'Office',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.40',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
      },
    ]);

    const handler = new DisplayRequestHandler({
      registry,
      adapters: new AdapterRegistry([new GenericWebDisplayAdapter()]),
      diagnosticsLog: new DiagnosticsLog(),
      logger: silentLogger,
      translate,
      getLanguage: () => 'en',
      isDiagnosticsEnabled: () => true,
      isServerListening: () => true,
      getPort: () => 7999,
      getUptimeSeconds: () => 42,
    });

    const response = await handler.handle(request({ url: '/diagnostics' }));
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /pages\.diagnostics\.heading/);
    assert.match(response.body, /7999/);
    assert.match(response.body, /Office/);
  });
});
