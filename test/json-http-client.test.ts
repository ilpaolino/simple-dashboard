import assert from 'node:assert/strict';
import http from 'node:http';
import { after, describe, it } from 'node:test';
import {
  FetchJsonHttpClient,
  HttpStatusError,
} from '../lib/http/JsonHttpClient';

describe('FetchJsonHttpClient', () => {
  const servers: http.Server[] = [];

  after(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
  });

  it('returns parsed JSON from a successful GET', async () => {
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: true }));
    });
    servers.push(server);

    const port = await listen(server);
    const client = new FetchJsonHttpClient();
    const payload = await client.getJson(`http://127.0.0.1:${port}/rpc/Shelly.GetDeviceInfo`);
    assert.deepEqual(payload, { ok: true });
  });

  it('throws on non-OK HTTP status', async () => {
    const server = http.createServer((_request, response) => {
      response.writeHead(401);
      response.end();
    });
    servers.push(server);

    const port = await listen(server);
    const client = new FetchJsonHttpClient();
    await assert.rejects(
      () => client.getJson(`http://127.0.0.1:${port}/rpc/Shelly.GetDeviceInfo`),
      HttpStatusError,
    );
  });
});

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to allocate free port'));
        return;
      }
      resolve(address.port);
    });
  });
}
