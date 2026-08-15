import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { AdapterRegistry } from '../lib/adapters/AdapterRegistry';
import { GenericWebDisplayAdapter } from '../lib/adapters/GenericWebDisplayAdapter';
import { ShellyWallDisplayAdapter } from '../lib/adapters/ShellyWallDisplayAdapter';
import { ADAPTER_IDS, LAYOUT_IDS } from '../lib/adapters/types';
import { HomeyDeviceRepository } from '../lib/homey/HomeyDeviceRepository';
import { emptyDashboardConfiguration } from '../lib/widgets';
import { DiagnosticsLog } from '../lib/diagnostics/DiagnosticsLog';
import { DisplayRegistry } from '../lib/display/DisplayRegistry';
import { DISPLAY_TYPE_IDS } from '../lib/display/types';
import { DashboardAssetStore } from '../lib/http/DashboardAssetStore';
import { DisplayRequestHandler } from '../lib/http/DisplayRequestHandler';
import type { JsonHttpClient } from '../lib/http/JsonHttpClient';
import type { Logger, RequestInfo } from '../lib/types';
import type { LayoutId } from '../lib/adapters/types';

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

function createTempAssets(): DashboardAssetStore {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-assets-'));
  fs.writeFileSync(path.join(dir, 'dashboard.css'), '/* test */');
  fs.writeFileSync(path.join(dir, 'dashboard.js'), '/* test */');
  return new DashboardAssetStore(dir);
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
      assets: createTempAssets(),
    });

    const response = await handler.handle(request({ clientIp: '10.0.0.9' }));
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /pages\.unconfigured\.heading/);
  });

  it('serves a dashboard bootstrap for a Generic display', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'gen-1',
        name: 'Office',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.40',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
        dashboard: emptyDashboardConfiguration(),
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
      assets: createTempAssets(),
    });

    const response = await handler.handle(
      request({ clientIp: '192.168.1.40' }),
    );
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /dashboard-bootstrap/);
    assert.match(response.body, /"rows":4/);
    assert.match(response.body, /"columns":2/);
    assert.match(response.body, /dashboard\.js/);
    assert.equal(registry.getOnlineStatus('gen-1'), 'offline');
    assert.ok(registry.getById('gen-1')?.runtime.lastRenderedAt);
  });

  it('serves an invalid layout page for corrupt layout ids', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'gen-bad',
        name: 'Broken',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.41',
        hardwareId: null,
        layoutId: '9x9' as LayoutId,
        dashboard: emptyDashboardConfiguration(),
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
      assets: createTempAssets(),
    });

    const response = await handler.handle(
      request({ clientIp: '192.168.1.41' }),
    );
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /pages\.invalidLayout\.heading/);
    assert.equal(
      registry.getById('gen-bad')?.runtime.lastLayoutErrorKey,
      'pages.invalidLayout.heading',
    );
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
        dashboard: emptyDashboardConfiguration(),
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
      assets: createTempAssets(),
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
      assets: createTempAssets(),
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
        dashboard: emptyDashboardConfiguration(),
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
      assets: createTempAssets(),
    });

    const response = await handler.handle(request({ url: '/diagnostics' }));
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /pages\.diagnostics\.heading/);
    assert.match(response.body, /7999/);
    assert.match(response.body, /Office/);
    assert.match(response.body, /pages\.diagnostics\.gridSize/);
    assert.match(response.body, /2x4/);
    assert.match(response.body, /pages\.diagnostics\.lightWidgets/);
  });

  it('serves diagnostics even when translations return undefined', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'gen-1',
        name: 'Office',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.40',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
        dashboard: emptyDashboardConfiguration(),
      },
    ]);

    const handler = new DisplayRequestHandler({
      registry,
      adapters: new AdapterRegistry([new GenericWebDisplayAdapter()]),
      diagnosticsLog: new DiagnosticsLog(),
      logger: silentLogger,
      translate: () => undefined as unknown as string,
      getLanguage: () => 'en',
      isDiagnosticsEnabled: () => true,
      isServerListening: () => true,
      getPort: () => 7999,
      getUptimeSeconds: () => 1,
      getRealtimeDiagnostics: () => ({
        active: true,
        metrics: {
          connectionsOpened: 0,
          connectionsClosed: 0,
          activeConnections: 0,
          reconnects: 0,
          messagesSent: 0,
          messagesReceived: 0,
          activeSubscriptions: 0,
          rejectedConnections: 0,
          heartbeatTimeouts: 0,
        },
        sessions: [],
        subscriptions: [],
      }),
    });

    const response = await handler.handle(request({ url: '/diagnostics' }));
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /pages\.diagnostics\.heading/);
  });

  it('serves diagnostics with corrupt runtime timestamps and dashboard shape', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'gen-1',
        name: 'Office',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.40',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
        dashboard: { version: 1 } as ReturnType<typeof emptyDashboardConfiguration>,
      },
    ]);

    const entry = registry.getById('gen-1');
    assert.ok(entry);
    (entry.runtime as { lastSeenAt: unknown }).lastSeenAt = '2024-01-01T00:00:00.000Z';
    (entry.runtime as { lastRenderedAt: unknown }).lastRenderedAt = new Date('invalid');
    (entry.runtime as { lastLightWidgetDiagnostics: unknown }).lastLightWidgetDiagnostics = [
      null,
      {
        widgetId: 'w1',
        deviceId: 'dev-1',
        resolved: true,
        hasOnoff: true,
        available: true,
        on: true,
        error: null,
      },
    ];

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
      getUptimeSeconds: () => 1,
      getRealtimeDiagnostics: () => ({
        active: true,
        metrics: {
          connectionsOpened: 1,
          connectionsClosed: 0,
          activeConnections: 1,
          reconnects: 0,
          messagesSent: 0,
          messagesReceived: 0,
          activeSubscriptions: 0,
          rejectedConnections: 0,
          heartbeatTimeouts: 0,
        },
        sessions: [],
        subscriptions: [
          null as unknown as {
            deviceId: string;
            refCount: number;
            displayIds: string[];
            subscribed: boolean;
          },
          {
            deviceId: 'dev-1',
            refCount: 1,
            displayIds: ['gen-1'],
            subscribed: true,
          },
        ],
      }),
    });

    const response = await handler.handle(request({ url: '/diagnostics' }));
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /Office/);
    assert.match(response.body, /w1/);
    assert.doesNotMatch(response.body, /Diagnostics render failed/);
  });

  it('serves dashboard static assets', async () => {
    const assets = createTempAssets();
    const handler = new DisplayRequestHandler({
      registry: new DisplayRegistry(),
      adapters: new AdapterRegistry([new GenericWebDisplayAdapter()]),
      diagnosticsLog: new DiagnosticsLog(),
      logger: silentLogger,
      translate,
      getLanguage: () => 'en',
      isDiagnosticsEnabled: () => true,
      isServerListening: () => true,
      getPort: () => 7999,
      getUptimeSeconds: () => 1,
      assets,
    });

    const css = await handler.handle(request({ url: '/dashboard.css' }));
    const js = await handler.handle(request({ url: '/dashboard.js' }));
    assert.equal(css.statusCode, 200);
    assert.match(css.contentType, /text\/css/);
    assert.equal(js.statusCode, 200);
    assert.match(js.contentType, /javascript/);
  });

  it('embeds a LightWidget snapshot at load without realtime listeners', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'gen-1',
        name: 'Office',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.40',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
        dashboard: {
          version: 1,
          theme: 'dark',
          widgets: [
            {
              id: 'light-1',
              type: 'light',
              placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
              config: { deviceId: 'lamp-1' },
            },
          ],
        },
      },
    ]);

    const repository = new HomeyDeviceRepository({
      async getDevices() {
        return [
          {
            id: 'lamp-1',
            name: 'Office lamp',
            zoneId: null,
            available: true,
            capabilities: ['onoff'],
            capabilityValues: { onoff: true },
          },
        ];
      },
      async getDevice(id: string) {
        return id === 'lamp-1'
          ? {
              id: 'lamp-1',
              name: 'Office lamp',
              zoneId: null,
              available: true,
              capabilities: ['onoff'],
              capabilityValues: { onoff: true },
            }
          : null;
      },
      async getZones() {
        return {};
      },
      async subscribeCapability() {
        return null;
      },
    });

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
      assets: createTempAssets(),
      deviceRepository: repository,
    });

    const response = await handler.handle(
      request({ clientIp: '192.168.1.40' }),
    );
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /"type":"light"/);
    assert.match(response.body, /"on":true/);
    assert.match(response.body, /Office lamp/);
    assert.equal(
      registry.getById('gen-1')?.runtime.lastLightWidgetDiagnostics[0]?.on,
      true,
    );
  });
});
