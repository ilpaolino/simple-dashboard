import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { SHELLY_REBOOT_IDS } from '../lib/flow/registerShellyHardwareFlowCards';
import type { JsonHttpClient } from '../lib/http/JsonHttpClient';
import {
  ShellyHardwareCoordinator,
  ShellyHardwareProfileStore,
} from '../lib/shelly';
import { featureChanges, mapMethodsToFeatures, unknownFeatures } from '../lib/shelly/mapFeatures';
import { parseListMethodsResponse } from '../lib/shelly/parseListMethods';
import { SHELLY_RPC_METHODS } from '../lib/shelly/rpcMethods';
import {
  ShellyWallDisplayRpcClient,
  buildRpcUrl,
} from '../lib/shelly/ShellyWallDisplayRpcClient';
import { ShellyWallDisplayHardwareService } from '../lib/shelly/ShellyWallDisplayHardwareService';
import { ShellyRpcError } from '../lib/shelly/types';

class MockJsonHttpClient implements JsonHttpClient {
  public constructor(
    private readonly impl: (url: string) => Promise<unknown>,
  ) {}

  public getJson(url: string): Promise<unknown> {
    return this.impl(url);
  }
}

describe('Shelly ListMethods parsing', () => {
  it('parses a valid methods list', () => {
    const parsed = parseListMethodsResponse({
      methods: ['Shelly.Reboot', 'Shelly.GetDeviceInfo'],
    });
    assert.deepEqual(parsed.methods, ['Shelly.Reboot', 'Shelly.GetDeviceInfo']);
  });

  it('rejects missing methods array', () => {
    assert.throws(
      () => parseListMethodsResponse({}),
      (error: unknown) =>
        error instanceof ShellyRpcError && error.code === 'malformed_response',
    );
  });

  it('rejects malformed method entries', () => {
    assert.throws(
      () => parseListMethodsResponse({ methods: ['', 1] }),
      (error: unknown) =>
        error instanceof ShellyRpcError && error.code === 'malformed_response',
    );
  });

  it('rejects RPC error payloads', () => {
    assert.throws(
      () => parseListMethodsResponse({ error: { message: 'denied' } }),
      (error: unknown) => error instanceof ShellyRpcError && error.code === 'rpc_error',
    );
  });
});

describe('Shelly feature mapping', () => {
  it('maps Shelly.Reboot to supported when discovery succeeded', () => {
    const features = mapMethodsToFeatures([SHELLY_RPC_METHODS.REBOOT], true);
    assert.equal(features.reboot, 'supported');
  });

  it('maps absent reboot method to unsupported when discovery succeeded', () => {
    const features = mapMethodsToFeatures(['Shelly.GetDeviceInfo'], true);
    assert.equal(features.reboot, 'unsupported');
  });

  it('marks reboot unknown when discovery failed', () => {
    const features = mapMethodsToFeatures([], false);
    assert.equal(features.reboot, 'unknown');
  });

  it('distinguishes unknown vs unsupported', () => {
    assert.equal(mapMethodsToFeatures([], false).reboot, 'unknown');
    assert.equal(mapMethodsToFeatures([], true).reboot, 'unsupported');
  });

  it('logs feature transitions', () => {
    const changes = featureChanges(
      { reboot: 'unsupported' },
      { reboot: 'supported' },
    );
    assert.equal(changes.length, 1);
    assert.equal(changes[0]?.feature, 'reboot');
  });
});

describe('ShellyWallDisplayRpcClient', () => {
  it('calls ListMethods over HTTP GET', async () => {
    const client = new ShellyWallDisplayRpcClient({
      httpClient: new MockJsonHttpClient(async (url) => {
        assert.equal(url, buildRpcUrl('192.168.1.50', SHELLY_RPC_METHODS.LIST_METHODS));
        return { methods: [SHELLY_RPC_METHODS.REBOOT] };
      }),
    });

    const methods = await client.listMethods('192.168.1.50');
    assert.deepEqual(methods, [SHELLY_RPC_METHODS.REBOOT]);
  });

  it('accepts null reboot responses', async () => {
    const client = new ShellyWallDisplayRpcClient({
      httpClient: new MockJsonHttpClient(async () => null),
    });

    await client.reboot('192.168.1.50');
  });

  it('maps HTTP status errors', async () => {
    const client = new ShellyWallDisplayRpcClient({
      httpClient: new MockJsonHttpClient(async () => {
        throw new ShellyRpcError('http_status', 'HTTP 401');
      }),
    });

    await assert.rejects(
      () => client.listMethods('192.168.1.50'),
      (error: unknown) =>
        error instanceof ShellyRpcError && error.code === 'http_status',
    );
  });

  it('maps network failures', async () => {
    const client = new ShellyWallDisplayRpcClient({
      fetchImpl: async () => {
        throw new TypeError('fetch failed');
      },
    });

    await assert.rejects(
      () => client.listMethods('192.168.1.50'),
      (error: unknown) =>
        error instanceof ShellyRpcError && error.code === 'network',
    );
  });
});

describe('ShellyWallDisplayHardwareService reboot', () => {
  it('reboots when supported', async () => {
    let called = false;
    const service = new ShellyWallDisplayHardwareService({
      rpcClient: new ShellyWallDisplayRpcClient({
        httpClient: new MockJsonHttpClient(async (url) => {
          assert.equal(url, buildRpcUrl('192.168.1.50', SHELLY_RPC_METHODS.REBOOT));
          called = true;
          return null;
        }),
      }),
    });

    const result = await service.reboot('192.168.1.50', { reboot: 'supported' });
    assert.equal(result.ok, true);
    assert.equal(called, true);
  });

  it('rejects reboot when unsupported', async () => {
    const service = new ShellyWallDisplayHardwareService();
    const result = await service.reboot('192.168.1.50', { reboot: 'unsupported' });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'unsupported_method');
  });

  it('rejects reboot when unknown', async () => {
    const service = new ShellyWallDisplayHardwareService();
    const result = await service.reboot('192.168.1.50', unknownFeatures());
    assert.equal(result.ok, false);
    assert.equal(result.message, 'reboot_unknown');
  });

  it('maps offline reboot attempts', async () => {
    const service = new ShellyWallDisplayHardwareService({
      rpcClient: new ShellyWallDisplayRpcClient({
        httpClient: new MockJsonHttpClient(async () => {
          throw new ShellyRpcError('timeout', 'timeout');
        }),
      }),
    });

    const result = await service.reboot('192.168.1.50', { reboot: 'supported' });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'timeout');
  });
});

describe('ShellyHardwareCoordinator', () => {
  it('discovers capabilities and stores runtime profile', async () => {
    const store = new ShellyHardwareProfileStore();
    const coordinator = new ShellyHardwareCoordinator({
      store,
      hardwareService: new ShellyWallDisplayHardwareService({
        rpcClient: new ShellyWallDisplayRpcClient({
          httpClient: new MockJsonHttpClient(async () => ({
            methods: [SHELLY_RPC_METHODS.REBOOT, 'Switch.GetStatus'],
          })),
        }),
      }),
    });

    const state = await coordinator.discoverForDisplay(
      { displayId: 'shelly-1', ipAddress: '192.168.1.50', name: 'Kitchen' },
      'manual',
    );

    assert.equal(state.discoveryStatus, 'successful');
    assert.equal(state.profile?.features.reboot, 'supported');
    assert.equal(state.rpcMethodCount, 2);
  });

  it('keeps previous profile when rediscovery fails', async () => {
    let calls = 0;
    const coordinator = new ShellyHardwareCoordinator({
      hardwareService: new ShellyWallDisplayHardwareService({
        rpcClient: new ShellyWallDisplayRpcClient({
          httpClient: new MockJsonHttpClient(async () => {
            calls += 1;
            if (calls === 1) {
              return { methods: [SHELLY_RPC_METHODS.REBOOT] };
            }
            throw new ShellyRpcError('network', 'offline');
          }),
        }),
      }),
    });

    const device = {
      displayId: 'shelly-1',
      ipAddress: '192.168.1.50',
      name: 'Kitchen',
    };

    await coordinator.discoverForDisplay(device, 'manual');
    const afterFailure = await coordinator.discoverForDisplay(device, 'manual');

    assert.equal(afterFailure.discoveryStatus, 'device_offline');
    assert.equal(afterFailure.profile?.features.reboot, 'supported');
  });

  it('simulates firmware adding reboot support without re-pairing', async () => {
    let phase = 1;
    const coordinator = new ShellyHardwareCoordinator({
      hardwareService: new ShellyWallDisplayHardwareService({
        rpcClient: new ShellyWallDisplayRpcClient({
          httpClient: new MockJsonHttpClient(async () => ({
            methods:
              phase === 1
                ? ['Shelly.GetDeviceInfo']
                : ['Shelly.GetDeviceInfo', SHELLY_RPC_METHODS.REBOOT],
          })),
        }),
      }),
    });

    const device = {
      displayId: 'shelly-1',
      ipAddress: '192.168.1.50',
      name: 'Kitchen',
    };

    const first = await coordinator.discoverForDisplay(device, 'startup');
    assert.equal(first.profile?.features.reboot, 'unsupported');

    phase = 2;
    const second = await coordinator.discoverForDisplay(device, 'manual');
    assert.equal(second.profile?.features.reboot, 'supported');
  });

  it('processes each display once during startup discovery', async () => {
    const seen: string[] = [];
    const coordinator = new ShellyHardwareCoordinator({
      listDevices: () => [
        { displayId: 'a', ipAddress: '192.168.1.10', name: 'A' },
        { displayId: 'b', ipAddress: '192.168.1.11', name: 'B' },
      ],
      hardwareService: new ShellyWallDisplayHardwareService({
        rpcClient: new ShellyWallDisplayRpcClient({
          httpClient: new MockJsonHttpClient(async (url) => {
            seen.push(url);
            return { methods: [SHELLY_RPC_METHODS.REBOOT] };
          }),
        }),
      }),
    });

    await coordinator.runStartupDiscovery();
    assert.equal(seen.length, 2);
  });

  it('does not register periodic discovery timers', async () => {
    const originalSetInterval = globalThis.setInterval;
    let intervalCount = 0;
    globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
      intervalCount += 1;
      return originalSetInterval(...args);
    }) as typeof setInterval;

    try {
      const coordinator = new ShellyHardwareCoordinator({
        listDevices: () => [
          { displayId: 'a', ipAddress: '192.168.1.10', name: 'A' },
        ],
        hardwareService: new ShellyWallDisplayHardwareService({
          rpcClient: new ShellyWallDisplayRpcClient({
            httpClient: new MockJsonHttpClient(async () => ({
              methods: [SHELLY_RPC_METHODS.REBOOT],
            })),
          }),
        }),
      });

      await coordinator.runStartupDiscovery();
      await coordinator.discoverForDisplay(
        { displayId: 'a', ipAddress: '192.168.1.10', name: 'A' },
        'manual',
      );
      assert.equal(intervalCount, 0);
    } finally {
      globalThis.setInterval = originalSetInterval;
    }
  });
});

describe('Generic Web Display isolation', () => {
  it('does not expose Shelly reboot Flow card on generic driver compose', () => {
    const generic = readFileSync(
      'drivers/generic_web_display/driver.flow.compose.json',
      'utf8',
    );
    assert.equal(generic.includes('shelly_reboot_display'), false);
    assert.equal(generic.includes('reboot'), false);
  });

  it('exposes Shelly reboot card only on Shelly driver compose', () => {
    const shelly = readFileSync(
      'drivers/shelly_wall_display/driver.flow.compose.json',
      'utf8',
    );
    assert.equal(shelly.includes('shelly_reboot_display'), true);
  });

  it('registers reboot card ids only for Shelly flow module', () => {
    assert.deepEqual(SHELLY_REBOOT_IDS, ['shelly_reboot_display']);
  });
});
