import assert from 'node:assert/strict';
import http from 'node:http';
import { describe, it, after } from 'node:test';
import { AppLogger } from '../lib/Logger';
import {
  HttpServer,
  PortInUseError,
} from '../lib/HttpServer';
import { renderWelcomePage } from '../lib/WelcomePage';
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

describe('HttpServer', () => {
  const servers: HttpServer[] = [];

  after(async () => {
    for (const server of servers) {
      await server.stop().catch(() => undefined);
    }
  });

  it('serves Simple Dashboard HTML on /', async () => {
    const port = await getFreePort();
    const server = new HttpServer({
      host: '127.0.0.1',
      logger: createLogger(),
      requestHandler: renderWelcomePage,
    });
    servers.push(server);

    await server.start(port);

    const response = await fetch(`http://127.0.0.1:${port}/`);
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.match(body, /Simple Dashboard/);
    assert.match(body, /Client IP/);
    assert.match(body, /User Agent/);
    assert.match(body, /Method/);
    assert.match(body, /Timestamp/);
  });

  it('restarts on a new port and closes the previous socket', async () => {
    const firstPort = await getFreePort();
    const secondPort = await getFreePort();
    const server = new HttpServer({
      host: '127.0.0.1',
      logger: createLogger(),
      requestHandler: renderWelcomePage,
    });
    servers.push(server);

    await server.start(firstPort);
    await server.restart(secondPort);

    await assert.rejects(
      () => fetch(`http://127.0.0.1:${firstPort}/`),
      (error: unknown) => error instanceof TypeError,
    );

    const response = await fetch(`http://127.0.0.1:${secondPort}/`);
    assert.equal(response.status, 200);
  });

  it('reports port occupied errors', async () => {
    const port = await getFreePort();
    const blocker = http.createServer();
    await new Promise<void>((resolve) => {
      blocker.listen(port, '127.0.0.1', () => resolve());
    });

    const server = new HttpServer({
      host: '127.0.0.1',
      logger: createLogger(),
      requestHandler: renderWelcomePage,
    });
    servers.push(server);

    try {
      await assert.rejects(() => server.start(port), PortInUseError);
    } finally {
      await new Promise<void>((resolve, reject) => {
        blocker.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
