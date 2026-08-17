import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GenericWebDisplayAdapter } from '../lib/adapters/GenericWebDisplayAdapter';
import { ADAPTER_IDS } from '../lib/adapters/types';
import { DisplayRegistry } from '../lib/display/DisplayRegistry';
import { DISPLAY_TYPE_IDS } from '../lib/display/types';
import { emptyDashboardConfiguration } from '../lib/widgets';
import {
  GenericDisplayPairingManager,
  GenericCodePairingFlow,
  parseGenericClientHello,
  PairingRealtimeSessionManager,
} from '../lib/pairing';
import { LAYOUT_IDS } from '../lib/adapters/types';

class MemorySession {
  public readonly handlers = new Map<
    string,
    (data: unknown) => Promise<unknown>
  >();

  public setHandler(
    event: string,
    handler: (data: unknown) => Promise<unknown>,
  ): void {
    this.handlers.set(event, handler);
  }

  public async emit(event: string, data?: unknown): Promise<unknown> {
    const handler = this.handlers.get(event);
    if (!handler) {
      throw new Error(`Missing handler ${event}`);
    }
    return handler(data);
  }
}

const translations: Record<string, string> = {
  'errors.pairingCodeInvalid': 'Invalid pairing code.',
  'errors.pairingCodeExpired': 'Pairing code expired.',
  'errors.pairingIpTaken': 'IP already used.',
  'device.notAvailable': 'Not available',
  'device.defaultNameGeneric': 'Generic Web Display',
  'adapters.generic_web_display': 'Generic Web Display',
};

describe('GenericDisplayPairingManager', () => {
  it('creates a six-digit code for an unknown IP', () => {
    let counter = 0;
    const manager = new GenericDisplayPairingManager({
      enableCleanupTimer: false,
      randomCode: () => {
        counter += 1;
        return String(100000 + counter);
      },
      now: () => new Date('2026-08-18T10:00:00.000Z'),
    });

    const session = manager.getOrCreateForIp('192.168.1.60');
    assert.ok(session);
    assert.match(session.code, /^\d{6}$/);
    assert.equal(session.ipAddress, '192.168.1.60');
    manager.destroy();
  });

  it('reuses the same code for repeated requests from one IP', () => {
    const manager = new GenericDisplayPairingManager({
      enableCleanupTimer: false,
      randomCode: () => '483921',
      now: () => new Date('2026-08-18T10:00:00.000Z'),
    });

    const first = manager.getOrCreateForIp('192.168.1.60');
    const second = manager.getOrCreateForIp('192.168.1.60');
    assert.equal(first?.code, second?.code);
    manager.destroy();
  });

  it('creates distinct sessions for different IPs', () => {
    let counter = 0;
    const manager = new GenericDisplayPairingManager({
      enableCleanupTimer: false,
      randomCode: () => {
        counter += 1;
        return String(100000 + counter);
      },
      now: () => new Date('2026-08-18T10:00:00.000Z'),
    });

    const a = manager.getOrCreateForIp('192.168.1.60');
    const b = manager.getOrCreateForIp('192.168.1.61');
    assert.notEqual(a?.code, b?.code);
    manager.destroy();
  });

  it('regenerates on code collision', () => {
    let counter = 0;
    const manager = new GenericDisplayPairingManager({
      enableCleanupTimer: false,
      randomCode: () => {
        counter += 1;
        return counter === 1 ? '111111' : '222222';
      },
      now: () => new Date('2026-08-18T10:00:00.000Z'),
    });

    manager.getOrCreateForIp('192.168.1.60');
    const second = manager.getOrCreateForIp('192.168.1.61');
    assert.equal(second?.code, '222222');
    manager.destroy();
  });

  it('expires sessions and allows a new code afterwards', () => {
    let nowMs = Date.parse('2026-08-18T10:00:00.000Z');
    let counter = 0;
    const manager = new GenericDisplayPairingManager({
      enableCleanupTimer: false,
      expiryMs: 60_000,
      randomCode: () => {
        counter += 1;
        return String(200000 + counter);
      },
      now: () => new Date(nowMs),
    });

    const first = manager.getOrCreateForIp('192.168.1.60');
    nowMs += 61_000;
    assert.equal(manager.validateCode(first!.code).ok, false);

    const second = manager.getOrCreateForIp('192.168.1.60');
    assert.notEqual(first?.code, second?.code);
    manager.destroy();
  });

  it('consumes a session and prevents reuse', () => {
    const manager = new GenericDisplayPairingManager({
      enableCleanupTimer: false,
      randomCode: () => '483921',
      now: () => new Date('2026-08-18T10:00:00.000Z'),
    });

    const session = manager.getOrCreateForIp('192.168.1.60');
    assert.ok(manager.consume(session!.code));
    assert.equal(manager.lookupByCode(session!.code), null);
    assert.equal(manager.pendingCount(), 0);
    manager.destroy();
  });
});

describe('GenericCodePairingFlow', () => {
  function createFlow(registry: DisplayRegistry, manager: GenericDisplayPairingManager) {
    const flow = new GenericCodePairingFlow({
      pairingManager: manager,
      registry,
      adapter: new GenericWebDisplayAdapter(),
      translate: (key) => translations[key] ?? key,
      createId: () => 'generated-uuid',
    });
    const session = new MemorySession();
    flow.bind(session);
    return session;
  }

  it('pairs with a valid code and stores IP only', async () => {
    const manager = new GenericDisplayPairingManager({
      enableCleanupTimer: false,
      randomCode: () => '483921',
    });
    const registry = new DisplayRegistry();
    const session = createFlow(registry, manager);
    manager.getOrCreateForIp('192.168.1.60');

    await session.emit('validate_code', { code: '483921' });
    const preview = (await session.emit('get_pairing_preview')) as {
      ipAddress: string;
    };
    assert.equal(preview.ipAddress, '192.168.1.60');

    const device = (await session.emit('get_pairing_device')) as {
      data: { id: string };
      settings: { ip: string };
      store: { adapterId: string };
    };
    assert.equal(device.settings.ip, '192.168.1.60');
    assert.equal(device.store.adapterId, ADAPTER_IDS.GENERIC_WEB_DISPLAY);
    assert.equal('code' in device.settings, false);

    await session.emit('consume_pairing');
    assert.equal(manager.lookupByCode('483921'), null);
    manager.destroy();
  });

  it('rejects invalid and expired codes', async () => {
    let nowMs = Date.parse('2026-08-18T10:00:00.000Z');
    const manager = new GenericDisplayPairingManager({
      enableCleanupTimer: false,
      expiryMs: 1000,
      randomCode: () => '483921',
      now: () => new Date(nowMs),
    });
    const session = createFlow(new DisplayRegistry(), manager);
    manager.getOrCreateForIp('192.168.1.60');

    await assert.rejects(
      () => session.emit('validate_code', { code: '000000' }),
      /Invalid pairing code/,
    );

    nowMs += 2000;
    await assert.rejects(
      () => session.emit('validate_code', { code: '483921' }),
      /expired/i,
    );
    manager.destroy();
  });

  it('rejects codes when IP is already configured', async () => {
    const manager = new GenericDisplayPairingManager({
      enableCleanupTimer: false,
      randomCode: () => '483921',
    });
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'existing',
        name: 'Kitchen',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.60',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
        dashboard: emptyDashboardConfiguration(),
      },
    ]);
    const session = createFlow(registry, manager);
    manager.getOrCreateForIp('192.168.1.60');

    await assert.rejects(
      () => session.emit('validate_code', { code: '483921' }),
      /IP already used/,
    );
    manager.destroy();
  });
});

describe('Generic browser capabilities', () => {
  it('parses a valid generic-client-hello', () => {
    const parsed = parseGenericClientHello({
      type: 'generic-client-hello',
      capabilities: {
        touch: true,
        fullscreen: false,
        audioPlayback: true,
        canReloadPage: true,
      },
      viewport: { width: 1280, height: 800, devicePixelRatio: 2 },
    });
    assert.ok(parsed);
    assert.equal(parsed?.capabilities.touch, true);
    assert.equal(parsed?.viewport.width, 1280);
  });

  it('rejects malformed hello payloads', () => {
    assert.equal(parseGenericClientHello({ type: 'client-ready' }), null);
    assert.equal(
      parseGenericClientHello({
        type: 'generic-client-hello',
        capabilities: { touch: 'yes' },
        viewport: { width: 1, height: 1, devicePixelRatio: 1 },
      }),
      null,
    );
  });
});

describe('Pairing identity after virtual browser wipe', () => {
  it('still recognizes a display by IP without persisted browser state', () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'gen-1',
        name: 'Office',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.60',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
        dashboard: emptyDashboardConfiguration(),
      },
    ]);

    assert.ok(registry.findByIp('192.168.1.60'));
    assert.equal(registry.findByIp('192.168.1.61'), null);
  });
});

describe('IP change recovery', () => {
  it('shows unknown until device settings IP is updated', () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'gen-1',
        name: 'Office',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.60',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
        dashboard: emptyDashboardConfiguration(),
      },
    ]);

    assert.equal(registry.findByIp('192.168.1.61'), null);

    registry.upsert({
      displayId: 'gen-1',
      name: 'Office',
      typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
      ipAddress: '192.168.1.61',
      hardwareId: null,
      layoutId: LAYOUT_IDS.GRID_2X4,
      dashboard: emptyDashboardConfiguration(),
    });

    assert.ok(registry.findByIp('192.168.1.61'));
  });
});

describe('PairingRealtimeSessionManager leak cycles', () => {
  it('cleans up pairing sockets after notify and close', () => {
    const manager = new PairingRealtimeSessionManager();
    const sockets = [
      { readyState: 1, send() {}, on() {}, close() {} } as unknown as import('ws').WebSocket,
    ];
    manager.register('192.168.1.60', sockets[0]!);
    assert.equal(manager.activeCount(), 1);
    manager.notifyPairingCompleted('192.168.1.60');
    manager.clear();
    assert.equal(manager.activeCount(), 0);
  });
});
