import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WebSocket, WebSocketServer } from 'ws';
import { DisplayRealtimeSession } from '../lib/realtime/DisplayRealtimeSession';
import { RealtimeMetrics } from '../lib/realtime/RealtimeMetrics';
import { parseServerMessage } from '../lib/realtime/protocol';

async function createListeningServer(): Promise<{
  readonly wss: WebSocketServer;
  readonly port: number;
}> {
  const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await new Promise<void>((resolve) => wss.once('listening', () => resolve()));
  const address = wss.address();
  assert.ok(address && typeof address === 'object');
  return { wss, port: address.port };
}

async function openPair(
  wss: WebSocketServer,
  port: number,
): Promise<{ readonly server: WebSocket; readonly client: WebSocket }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connection timeout')), 2000);
    const client = new WebSocket(`ws://127.0.0.1:${port}`);
    wss.once('connection', (server) => {
      clearTimeout(timer);
      resolve({ server, client });
    });
  });
}

describe('DisplayRealtimeSession heartbeat', () => {
  it('sends heartbeat and closes on missing ack (zombie socket)', async () => {
    const { wss, port } = await createListeningServer();
    const metrics = new RealtimeMetrics();
    const { server, client } = await openPair(wss, port);

    let sessionClosed = false;
    const session = new DisplayRealtimeSession({
      displayId: 'd1',
      remoteAddress: '127.0.0.1',
      socket: server,
      metrics,
      heartbeatIntervalMs: 30,
      heartbeatTimeoutMs: 60,
      onClose() {
        sessionClosed = true;
      },
      onClientMessage() {},
      onProtocolError() {},
    });

    const heartbeatSeen = await new Promise<boolean>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('no heartbeat')), 1000);
      client.on('message', (data) => {
        const raw = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
        const message = parseServerMessage(raw);
        if (message?.type === 'heartbeat') {
          clearTimeout(timer);
          resolve(true);
        }
      });
    });
    assert.equal(heartbeatSeen, true);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('session did not close')),
        1000,
      );
      const poll = setInterval(() => {
        if (sessionClosed || !session.isOpen()) {
          clearInterval(poll);
          clearTimeout(timer);
          resolve();
        }
      }, 10);
    });

    assert.ok(metrics.snapshot().heartbeatTimeouts >= 1);
    assert.equal(session.isOpen(), false);

    client.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  it('keeps the session alive when heartbeats are acknowledged', async () => {
    const { wss, port } = await createListeningServer();
    const metrics = new RealtimeMetrics();
    const { server, client } = await openPair(wss, port);

    client.on('message', (data) => {
      const raw = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
      const message = parseServerMessage(raw);
      if (message?.type === 'heartbeat') {
        client.send(JSON.stringify({ type: 'heartbeat-ack', at: message.at }));
      }
    });

    const session = new DisplayRealtimeSession({
      displayId: 'd1',
      remoteAddress: '127.0.0.1',
      socket: server,
      metrics,
      heartbeatIntervalMs: 30,
      heartbeatTimeoutMs: 200,
      onClose() {},
      onClientMessage() {},
      onProtocolError() {},
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(session.isOpen(), true);
    assert.equal(metrics.snapshot().heartbeatTimeouts, 0);

    session.close();
    client.terminate();
    await new Promise<void>((resolve) => wss.close(() => resolve()));
  });
});
