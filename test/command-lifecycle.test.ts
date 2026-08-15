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
import { COMMAND_TIMEOUT_MS } from '../lib/realtime/constants';
import { RealtimeGateway } from '../lib/realtime/RealtimeGateway';
import { REALTIME_WEBSOCKET_PATH } from '../lib/realtime/constants';
import {
  parseServerMessage,
  serializeClientMessage,
  type ServerMessage,
} from '../lib/realtime/protocol';
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

function mockHomeyApi(options: {
  readonly onoff?: boolean;
  readonly available?: boolean;
  readonly emitOnSet?: boolean;
  readonly failSet?: boolean;
}): HomeyWebApi & {
  emitOnoff: (value: boolean) => void;
  setCalls: number;
} {
  let listener: ((value: unknown) => void) | null = null;
  let setCalls = 0;

  const device: HomeyApiDeviceDto = {
    id: 'lamp-1',
    name: 'Lamp',
    zoneId: null,
    available: options.available ?? true,
    capabilities: ['onoff'],
    capabilityValues: { onoff: options.onoff ?? false },
  };

  return {
    get setCalls() {
      return setCalls;
    },
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
    async subscribeCapability(opts) {
      listener = opts.onValue;
      const handle: HomeyCapabilitySubscription = {
        destroy() {
          opts.onDestroyed?.();
        },
      };
      return handle;
    },
    async setCapabilityValue(opts) {
      setCalls += 1;
      if (options.failSet) {
        throw new Error('Homey API error');
      }
      if (options.emitOnSet !== false) {
        device.capabilityValues = { onoff: Boolean(opts.value) };
        listener?.(opts.value);
      }
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

async function openSession(port: number): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${REALTIME_WEBSOCKET_PATH}`);
  await waitForMessage(socket, (message) => message.type === 'dashboard-snapshot');
  return socket;
}

describe('Command lifecycle over WebSocket', () => {
  async function withGateway(
    run: (ctx: {
      readonly port: number;
      readonly gateway: RealtimeGateway;
      readonly api: ReturnType<typeof mockHomeyApi>;
    }) => Promise<void>,
    apiOptions: Parameters<typeof mockHomeyApi>[0] = {},
    snapshot?: DisplaySnapshot,
  ): Promise<void> {
    const port = await getFreePort();
    const registry = new DisplayRegistry();
    registry.rebuild([snapshot ?? displaySnapshot()]);
    const api = mockHomeyApi(apiOptions);
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
      await run({ port, gateway, api });
    } finally {
      gateway.detach();
      await gateway.destroy();
      const node = server.getNodeServer();
      node?.closeAllConnections();
      await server.stop();
    }
  }

  it('success: OFF → pending → Homey ON → confirmed', async () => {
    await withGateway(async ({ port, gateway, api }) => {
      const socket = await openSession(port);
      socket.send(
        serializeClientMessage({
          type: 'widget-action',
          widgetId: 'light-1',
          action: 'toggle',
          requestId: 'success-1',
        }),
      );

      const accepted = await waitForMessage(
        socket,
        (message) =>
          message.type === 'command-accepted' && message.requestId === 'success-1',
      );
      assert.equal(accepted.type, 'command-accepted');
      assert.equal(gateway.getMetrics().activePendingCommands, 1);

      // Homey realtime confirmation arrives after the API accepted the write.
      api.emitOnoff(true);

      await waitForMessage(
        socket,
        (message) =>
          message.type === 'widget-state' &&
          message.widgetId === 'light-1' &&
          message.state.type === 'light' &&
          message.state.on === true,
      );

      const metrics = gateway.getMetrics();
      assert.equal(metrics.commandsAccepted, 1);
      assert.equal(metrics.commandsSucceeded, 1);
      assert.equal(metrics.activePendingCommands, 0);
      socket.close();
    }, { onoff: false, emitOnSet: false });
  });

  it('API error clears pending and rejects', async () => {
    await withGateway(async ({ port, gateway }) => {
      const socket = await openSession(port);
      socket.send(
        serializeClientMessage({
          type: 'widget-action',
          widgetId: 'light-1',
          action: 'toggle',
          requestId: 'api-err-1',
        }),
      );

      const rejected = await waitForMessage(
        socket,
        (message) =>
          message.type === 'command-rejected' &&
          message.requestId === 'api-err-1' &&
          message.reason === 'homey_api_error',
      );
      assert.equal(rejected.type, 'command-rejected');
      assert.equal(gateway.getMetrics().activePendingCommands, 0);
      socket.close();
    }, { onoff: false, failSet: true });
  });

  it('documents command timeout constant and clears pending on mismatch', async () => {
    assert.equal(COMMAND_TIMEOUT_MS, 4_000);

    await withGateway(async ({ port, gateway, api }) => {
      const socket = await openSession(port);
      socket.send(
        serializeClientMessage({
          type: 'widget-action',
          widgetId: 'light-1',
          action: 'toggle',
          requestId: 'pending-keep',
        }),
      );

      await waitForMessage(
        socket,
        (message) =>
          message.type === 'command-accepted' &&
          message.requestId === 'pending-keep',
      );
      assert.equal(gateway.getMetrics().activePendingCommands, 1);
      assert.equal(api.setCalls, 1);

      api.emitOnoff(false);
      const mismatch = await waitForMessage(
        socket,
        (message) =>
          message.type === 'command-rejected' &&
          message.reason === 'unexpected_state',
      );
      assert.equal(mismatch.type, 'command-rejected');
      assert.equal(gateway.getMetrics().activePendingCommands, 0);
      socket.close();
    }, { onoff: false, emitOnSet: false });
  });

  it('rejects foreign widget and does not accept arbitrary device control', async () => {
    const snapshot = displaySnapshot();
    const foreign = displaySnapshot({
      displayId: 'display-2',
      ipAddress: '10.0.0.2',
      dashboard: {
        version: 1,
        widgets: [
          {
            id: 'foreign-light',
            type: 'light',
            placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
            config: { deviceId: 'lamp-1' },
          },
        ],
      },
    });

    const port = await getFreePort();
    const registry = new DisplayRegistry();
    registry.rebuild([snapshot, foreign]);
    const api = mockHomeyApi({ onoff: false });
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
      const socket = await openSession(port);
      socket.send(
        JSON.stringify({
          type: 'widget-action',
          widgetId: 'foreign-light',
          action: 'toggle',
          requestId: 'sec-1',
          deviceId: 'arbitrary-device',
          capability: 'onoff',
          value: true,
        }),
      );

      const rejected = await waitForMessage(
        socket,
        (message) =>
          message.type === 'command-rejected' &&
          message.requestId === 'sec-1' &&
          message.reason === 'widget_not_found',
      );
      assert.equal(rejected.type, 'command-rejected');
      assert.equal(api.setCalls, 0);
      socket.close();
    } finally {
      gateway.detach();
      await gateway.destroy();
      server.getNodeServer()?.closeAllConnections();
      await server.stop();
    }
  });

  it('clears pending commands when the socket closes', async () => {
    await withGateway(async ({ port, gateway }) => {
      const socket = await openSession(port);
      socket.send(
        serializeClientMessage({
          type: 'widget-action',
          widgetId: 'light-1',
          action: 'toggle',
          requestId: 'disc-1',
        }),
      );
      await waitForMessage(
        socket,
        (message) =>
          message.type === 'command-accepted' && message.requestId === 'disc-1',
      );
      assert.equal(gateway.getMetrics().activePendingCommands, 1);

      await new Promise<void>((resolve) => {
        socket.once('close', () => resolve());
        socket.close();
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(gateway.getMetrics().activePendingCommands, 0);
    }, { onoff: false, emitOnSet: false });
  });
});
