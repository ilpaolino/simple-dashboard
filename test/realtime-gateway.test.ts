import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it } from 'node:test';
import { WebSocket } from 'ws';
import { DisplayRegistry } from '../lib/display/DisplayRegistry';
import { DISPLAY_TYPE_IDS } from '../lib/display/types';
import type { DisplaySnapshot } from '../lib/display/types';
import { LAYOUT_IDS } from '../lib/adapters/types';
import { HomeyDeviceRepository } from '../lib/homey/HomeyDeviceRepository';
import type {
  HomeyApiDeviceDto,
  HomeyCapabilitySubscription,
  HomeyWebApi,
} from '../lib/homey/types';
import { HttpServer } from '../lib/HttpServer';
import { AppLogger } from '../lib/Logger';
import { RealtimeGateway } from '../lib/realtime/RealtimeGateway';
import { REALTIME_WEBSOCKET_PATH } from '../lib/realtime/constants';
import {
  parseServerMessage,
  serializeClientMessage,
  type ServerMessage,
} from '../lib/realtime/protocol';
import { emptyDashboardConfiguration } from '../lib/widgets';
import type { HomeyLogSink } from '../lib/types';

function createLogger(): AppLogger {
  const sink: HomeyLogSink = {
    log() {},
    error() {},
  };
  return new AppLogger(sink);
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Unable to allocate free port'));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function displaySnapshot(
  overrides: Partial<DisplaySnapshot> = {},
): DisplaySnapshot {
  return {
    displayId: 'display-1',
    name: 'Kitchen',
    typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
    ipAddress: '127.0.0.1',
    hardwareId: null,
    layoutId: LAYOUT_IDS.GRID_3X3,
    dashboard: {
      version: 1,
      widgets: [
        {
          id: 'light-1',
          type: 'light',
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
          config: { deviceId: 'lamp-1' },
        },
      ],
    },
    ...overrides,
  };
}

function mockHomeyApi(onoff = false): HomeyWebApi & {
  emitOnoff: (value: boolean) => void;
} {
  let listener: ((value: unknown) => void) | null = null;

  const device: HomeyApiDeviceDto = {
    id: 'lamp-1',
    name: 'Lamp',
    zoneId: null,
    available: true,
    capabilities: ['onoff'],
    capabilityValues: { onoff },
  };

  return {
    emitOnoff(value: boolean) {
      device.capabilityValues = { onoff: value };
      listener?.(value);
    },
    async getDevices() {
      return [device];
    },
    async getDevice(id: string) {
      return id === device.id ? device : null;
    },
    async getZones() {
      return {};
    },
    async subscribeCapability(options) {
      listener = options.onValue;
      const handle: HomeyCapabilitySubscription = {
        destroy() {
          options.onDestroyed?.();
        },
      };
      return handle;
    },
    async setCapabilityValue(options) {
      if (options.capabilityId !== 'onoff') {
        throw new Error('unsupported capability');
      }
      device.capabilityValues = { onoff: Boolean(options.value) };
      listener?.(options.value);
    },
  };
}

async function waitForMessage(
  socket: WebSocket,
  predicate: (message: ServerMessage) => boolean,
  timeoutMs = 3000,
): Promise<ServerMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for WebSocket message'));
    }, timeoutMs);

    const onMessage = (data: Buffer | ArrayBuffer | Buffer[]): void => {
      const raw = Buffer.isBuffer(data)
        ? data.toString('utf8')
        : Array.isArray(data)
          ? Buffer.concat(data).toString('utf8')
          : Buffer.from(data).toString('utf8');
      const message = parseServerMessage(raw);
      if (message && predicate(message)) {
        cleanup();
        resolve(message);
      }
    };

    const cleanup = (): void => {
      clearTimeout(timer);
      socket.off('message', onMessage);
    };

    socket.on('message', onMessage);
  });
}

async function closeSocket(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.CLOSED) {
    return;
  }
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      socket.terminate();
      resolve();
    }, 200);
    socket.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.close();
  });
}

describe('RealtimeGateway WebSocket', () => {
  async function withGateway(
    run: (ctx: {
      readonly port: number;
      readonly gateway: RealtimeGateway;
      readonly registry: DisplayRegistry;
      readonly api: ReturnType<typeof mockHomeyApi>;
    }) => Promise<void>,
    options?: {
      readonly onoff?: boolean;
      readonly snapshot?: DisplaySnapshot;
    },
  ): Promise<void> {
    const port = await getFreePort();
    const registry = new DisplayRegistry();
    registry.rebuild([options?.snapshot ?? displaySnapshot()]);
    const api = mockHomeyApi(options?.onoff ?? false);
    const repository = new HomeyDeviceRepository(api);
    const gateway = new RealtimeGateway({
      registry,
      deviceRepository: repository,
      capabilitySubscriber: {
        subscribeCapability: (opts) => repository.subscribeCapability(opts),
      },
      logger: createLogger(),
      translate: (key) => key,
      getLanguage: () => 'en',
    });

    const server = new HttpServer({
      host: '127.0.0.1',
      logger: createLogger(),
      requestHandler: () => ({
        statusCode: 200,
        contentType: 'text/plain',
        body: 'ok',
      }),
      onListening: (nodeServer) => {
        gateway.attach(nodeServer);
      },
      onBeforeClose: async () => {
        gateway.detach();
      },
    });

    await server.start(port);
    try {
      await run({ port, gateway, registry, api });
    } finally {
      gateway.detach();
      await gateway.destroy();
      const node = server.getNodeServer();
      node?.closeAllConnections();
      await server.stop();
    }
  }

  it('accepts a configured display and sends an initial snapshot', async () => {
    await withGateway(async ({ port, registry }) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`,
      );
      const message = await waitForMessage(
        socket,
        (item) => item.type === 'dashboard-snapshot',
      );
      assert.equal(message.type, 'dashboard-snapshot');
      if (message.type === 'dashboard-snapshot') {
        assert.equal(message.snapshot.displayId, 'display-1');
        assert.equal(message.snapshot.protocolVersion, 1);
        assert.equal(message.snapshot.widgetStates['light-1']?.type, 'light');
      }
      assert.equal(registry.getOnlineStatus('display-1'), 'online');
      await closeSocket(socket);
    }, { onoff: true });
  });

  it('accepts a pairing websocket for an unknown display IP', async () => {
    await withGateway(
      async ({ port }) => {
        const socket = new WebSocket(
          `ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`,
        );
        await new Promise<void>((resolve, reject) => {
          socket.once('open', () => resolve());
          socket.once('error', reject);
        });
        socket.send(
          JSON.stringify({
            type: 'generic-client-hello',
            capabilities: {
              touch: true,
              fullscreen: false,
              audioPlayback: true,
              canReloadPage: true,
            },
            viewport: { width: 800, height: 480, devicePixelRatio: 2 },
          }),
        );
        socket.send(
          JSON.stringify({
            type: 'widget-action',
            widgetId: 'x',
            action: 'toggle',
            requestId: 'r1',
          }),
        );
        await closeSocket(socket);
      },
      { snapshot: displaySnapshot({ ipAddress: '10.0.0.9' }) },
    );
  });

  it('routes onoff updates only to interested displays', async () => {
    await withGateway(async ({ port, gateway, api }) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`,
      );
      await waitForMessage(socket, (item) => item.type === 'dashboard-snapshot');
      api.emitOnoff(true);
      const update = await waitForMessage(
        socket,
        (item) => item.type === 'widget-state',
      );
      assert.equal(update.type, 'widget-state');
      if (update.type === 'widget-state') {
        assert.equal(update.widgetId, 'light-1');
        assert.equal(update.state.on, true);
      }
      assert.equal(gateway.listSubscriptions()[0]?.refCount, 1);
      await closeSocket(socket);
    });
  });

  it('replaces duplicate sockets for the same display', async () => {
    await withGateway(async ({ port }) => {
      const first = new WebSocket(
        `ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`,
      );
      await waitForMessage(first, (item) => item.type === 'dashboard-snapshot');
      const firstClosed = new Promise<void>((resolve) => {
        first.once('close', () => resolve());
      });
      const second = new WebSocket(
        `ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`,
      );
      await waitForMessage(second, (item) => item.type === 'dashboard-snapshot');
      await firstClosed;
      assert.equal(first.readyState, WebSocket.CLOSED);
      assert.equal(second.readyState, WebSocket.OPEN);
      await closeSocket(second);
    });
  });

  it('sends a fresh snapshot after reconnect with updated state', async () => {
    await withGateway(async ({ port, api }) => {
      const first = new WebSocket(
        `ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`,
      );
      await waitForMessage(first, (item) => item.type === 'dashboard-snapshot');
      await closeSocket(first);
      api.emitOnoff(true);
      const second = new WebSocket(
        `ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`,
      );
      const snapshot = await waitForMessage(
        second,
        (item) => item.type === 'dashboard-snapshot',
      );
      assert.equal(snapshot.type, 'dashboard-snapshot');
      if (snapshot.type === 'dashboard-snapshot') {
        assert.equal(snapshot.snapshot.widgetStates['light-1']?.on, true);
      }
      await closeSocket(second);
    }, { onoff: false });
  });

  it('acks heartbeat messages', async () => {
    await withGateway(async ({ port }) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`,
      );
      await waitForMessage(socket, (item) => item.type === 'dashboard-snapshot');
      socket.send(
        serializeClientMessage({
          type: 'heartbeat-ack',
          at: new Date().toISOString(),
        }),
      );
      assert.equal(socket.readyState, WebSocket.OPEN);
      await closeSocket(socket);
    });
  });

  it('pushes live configuration updates to connected displays', async () => {
    await withGateway(async ({ port, gateway, registry }) => {
      const socket = new WebSocket(
        `ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`,
      );
      await waitForMessage(socket, (item) => item.type === 'dashboard-snapshot');
      const entry = registry.getById('display-1');
      assert.ok(entry);
      registry.upsert({
        ...entry.config,
        dashboard: {
          version: 1,
          widgets: [
            {
              id: 'title-1',
              type: 'title',
              placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
              config: { text: 'Hello', alignment: 'center' },
            },
          ],
        },
      });
      await gateway.notifyDashboardConfigurationChanged('display-1');
      const configMessage = await waitForMessage(
        socket,
        (item) => item.type === 'dashboard-configuration',
      );
      assert.equal(configMessage.type, 'dashboard-configuration');
      if (configMessage.type === 'dashboard-configuration') {
        assert.equal(configMessage.configuration.widgets[0]?.type, 'title');
      }
      await closeSocket(socket);
    });
  });

  it('does not accumulate messages while a display is offline', async () => {
    await withGateway(async ({ gateway, registry }) => {
      const entry = registry.getById('display-1');
      assert.ok(entry);
      registry.upsert({
        ...entry.config,
        dashboard: emptyDashboardConfiguration(),
      });
      await gateway.notifyDashboardConfigurationChanged('display-1');
      assert.equal(gateway.getMetrics().activeConnections, 0);
    });
  });

  it('cleans up sessions across connect/disconnect cycles', async () => {
    await withGateway(async ({ port, gateway }) => {
      for (let i = 0; i < 4; i += 1) {
        const socket = new WebSocket(
          `ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`,
        );
        await waitForMessage(
          socket,
          (item) => item.type === 'dashboard-snapshot',
        );
        await closeSocket(socket);
        await new Promise<void>((resolve, reject) => {
          const started = Date.now();
          const timer = setInterval(() => {
            if (gateway.getMetrics().activeConnections === 0) {
              clearInterval(timer);
              resolve();
              return;
            }
            if (Date.now() - started > 1000) {
              clearInterval(timer);
              reject(new Error('activeConnections did not return to 0'));
            }
          }, 10);
        });
      }
      assert.equal(gateway.getMetrics().activeConnections, 0);
      assert.equal(gateway.listSubscriptions().length, 0);
    });
  });
});
