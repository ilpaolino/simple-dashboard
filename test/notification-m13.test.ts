/**
 * Milestone 13 — optional Homey camera media inside existing Notifications.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AdapterRegistry } from '../lib/adapters/AdapterRegistry';
import { GenericWebDisplayAdapter } from '../lib/adapters/GenericWebDisplayAdapter';
import { LAYOUT_IDS } from '../lib/adapters/types';
import { defaultDashboardUiCopy } from '../lib/dashboard/index';
import { DiagnosticsLog } from '../lib/diagnostics/DiagnosticsLog';
import { DisplayRegistry } from '../lib/display/DisplayRegistry';
import { DISPLAY_TYPE_IDS } from '../lib/display/types';
import {
  parseShowAction,
  registerNotificationFlowCards,
  resolveShowMedia,
} from '../lib/flow/registerNotificationFlowCards';
import { NotificationMediaResolver } from '../lib/homey/NotificationMediaResolver';
import { HomeyDeviceRepository } from '../lib/homey/HomeyDeviceRepository';
import {
  isBrowserPlayableVideoKind,
  parseDeviceImages,
  parseDeviceVideos,
  parseVideoKind,
} from '../lib/homey/parseHomeyMedia';
import type { HomeyApiDeviceDto, HomeyWebApi } from '../lib/homey/types';
import { DisplayRequestHandler } from '../lib/http/DisplayRequestHandler';
import { DashboardAssetStore } from '../lib/http/DashboardAssetStore';
import {
  createOpaqueMediaSourceId,
  isNotificationMedia,
  NotificationManager,
  NotificationMediaSessionManager,
  normalizePublishInput,
  parseFlowMediaArgument,
  unavailableCameraMedia,
} from '../lib/notifications';
import type { DisplayNotification } from '../lib/notifications/types';
import { parseNotificationMediaPath } from '../lib/http/DisplayRequestHandler';
import { RealtimeGateway } from '../lib/realtime/RealtimeGateway';
import { isDisplayNotification } from '../lib/realtime/protocol';
import { NotificationCenter } from '../frontend/notifications/NotificationCenter';
import { NotificationController } from '../frontend/notifications/NotificationController';
import { NotificationMediaController } from '../frontend/notifications/NotificationMediaController';
import type { Logger, RequestInfo } from '../lib/types';
import { emptyDashboardConfiguration } from '../lib/widgets';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const imageOnlyMedia = {
  type: 'camera' as const,
  sourceId: 'cam-a',
  hasImage: true,
  hasVideo: false,
  videoPlayable: false,
  playback: 'image' as const,
};

const videoAndImageMedia = {
  type: 'camera' as const,
  sourceId: 'cam-v',
  hasImage: true,
  hasVideo: true,
  videoPlayable: true,
  playback: 'video' as const,
};

const videoOnlyMedia = {
  type: 'camera' as const,
  sourceId: 'cam-vo',
  hasImage: false,
  hasVideo: true,
  videoPlayable: true,
  playback: 'video' as const,
};

function note(
  partial: Partial<DisplayNotification> &
    Pick<DisplayNotification, 'id' | 'message' | 'severity'>,
): DisplayNotification {
  return {
    dismissable: true,
    highlight: false,
    publishedAt: 1,
    autoOpen: true,
    ...partial,
  };
}

class FakeElement {
  public children: FakeElement[] = [];
  public className = '';
  public hidden = false;
  public textContent = '';
  public innerHTML = '';
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  public disabled = false;
  public muted = false;
  public autoplay = false;
  public controls = false;
  public paused = true;
  public offsetWidth = 1;
  public currentSrc = '';
  private _src = '';
  private readonly attrs = new Map<string, string>();
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();
  public playShouldFail = false;

  public get src(): string {
    return this._src;
  }

  public set src(value: string) {
    this._src = value;
    this.currentSrc = value;
    this.attrs.set('src', value);
  }

  public appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  public replaceChildren(...nodes: FakeElement[]): void {
    this.children = nodes;
  }

  public remove(): void {
    this.children = [];
  }

  public setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
    if (name === 'src') {
      this._src = value;
      this.currentSrc = value;
    }
  }

  public getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  public removeAttribute(name: string): void {
    this.attrs.delete(name);
    if (name === 'src') {
      this._src = '';
      this.currentSrc = '';
    }
  }

  public addEventListener(
    type: string,
    listener: (event: unknown) => void,
  ): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);
  }

  public removeEventListener(
    type: string,
    listener: (event: unknown) => void,
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  public dispatch(type: string, event: unknown = {}): void {
    const payload =
      event && typeof event === 'object'
        ? { target: this, ...(event as Record<string, unknown>) }
        : { target: this };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(payload);
    }
  }

  public click(): void {
    this.dispatch('click', {});
  }

  public focus(): void {}

  public closest(): null {
    return null;
  }

  public play(): Promise<void> {
    if (this.playShouldFail) {
      return Promise.reject(new Error('play_failed'));
    }
    this.paused = false;
    return Promise.resolve();
  }

  public pause(): void {
    this.paused = true;
  }

  public load(): void {
    this.paused = true;
  }

  public querySelector(selector: string): FakeElement | null {
    if (this.matches(selector)) {
      return this;
    }
    for (const child of this.children) {
      const found = child.querySelector(selector);
      if (found) {
        return found;
      }
    }
    return null;
  }

  public matches(selector: string): boolean {
    if (selector.startsWith('.')) {
      return this.className.split(/\s+/).includes(selector.slice(1));
    }
    return false;
  }

  public classList = {
    add: (name: string): void => {
      const parts = new Set(this.className.split(/\s+/).filter(Boolean));
      parts.add(name);
      this.className = [...parts].join(' ');
    },
    remove: (name: string): void => {
      const parts = new Set(this.className.split(/\s+/).filter(Boolean));
      parts.delete(name);
      this.className = [...parts].join(' ');
    },
    contains: (name: string): boolean =>
      this.className.split(/\s+/).includes(name),
  };

  public setPointerCapture(): void {}
  public releasePointerCapture(): void {}
  public hasPointerCapture(): boolean {
    return false;
  }
}

function installDomStub(root: FakeElement): () => void {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;
  const originalWindow = (globalThis as { window?: unknown }).window;

  (globalThis as { HTMLElement?: unknown }).HTMLElement = FakeElement;
  (globalThis as { window?: unknown }).window = {
    innerHeight: 800,
    innerWidth: 480,
  };
  (globalThis as { document?: unknown }).document = {
    body: root,
    activeElement: null,
    createElement(_tag: string) {
      return new FakeElement();
    },
    createElementNS(_ns: string, _tag: string) {
      return new FakeElement();
    },
    addEventListener() {},
    removeEventListener() {},
    contains() {
      return true;
    },
  };

  return () => {
    (globalThis as { document?: unknown }).document = originalDocument;
    (globalThis as { HTMLElement?: unknown }).HTMLElement = originalHTMLElement;
    (globalThis as { window?: unknown }).window = originalWindow;
  };
}

const silentLogger: Logger = {
  info() {},
  warn() {},
  error() {},
};

function cameraDevice(
  id: string,
  options: {
    readonly name?: string;
    readonly available?: boolean;
    readonly images?: boolean;
    readonly videos?: readonly string[];
    readonly className?: string | null;
  } = {},
): HomeyApiDeviceDto {
  return {
    id,
    name: options.name ?? id,
    zoneId: null,
    available: options.available !== false,
    capabilities: [],
    capabilityValues: {},
    className: options.className ?? 'camera',
    images: options.images
      ? [{ id: `${id}-img`, url: `http://127.0.0.1/img/${id}.jpg` }]
      : [],
    videos: (options.videos ?? []).map((kind, index) => ({
      id: `${id}-vid-${index}`,
      kind: parseVideoKind(kind),
    })),
  };
}

function mockApi(devices: readonly HomeyApiDeviceDto[]): HomeyWebApi {
  return {
    async getDevices() {
      return devices;
    },
    async getDevice(id: string) {
      return devices.find((item) => item.id === id) ?? null;
    },
    async getZones() {
      return {};
    },
    async subscribeCapability() {
      return { destroy() {} };
    },
    async setCapabilityValue() {},
  };
}

describe('M13 media model', () => {
  it('publish without media keeps media undefined (M11/M12 regression)', () => {
    const normalized = normalizePublishInput({
      message: 'Laundry done',
      severity: 'success',
      displayIds: ['display-a'],
    });
    assert.equal(normalized.ok, true);
    if (!normalized.ok) {
      return;
    }
    assert.equal(normalized.value.media, undefined);
    assert.equal(normalized.value.mediaDeviceId, undefined);
  });

  it('rejects leaked deviceId / url / token on the wire', () => {
    assert.equal(
      isNotificationMedia({
        type: 'camera',
        hasImage: true,
        hasVideo: false,
        videoPlayable: false,
        playback: 'image',
        deviceId: 'secret-camera',
      }),
      false,
    );
    assert.equal(
      isNotificationMedia({
        type: 'camera',
        hasImage: true,
        hasVideo: false,
        videoPlayable: false,
        playback: 'image',
        url: 'rtsp://user:pass@cam/stream',
      }),
      false,
    );
    assert.equal(isNotificationMedia(imageOnlyMedia), true);
    assert.equal(isDisplayNotification(note({ id: 'n', message: 'x', severity: 'info' })), true);
  });

  it('legacy Flow media arg omitted parses as null', () => {
    const parsed = parseFlowMediaArgument(undefined);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value, null);
    }
  });

  it('Flow autocomplete {id,name} parses as deviceId', () => {
    const parsed = parseFlowMediaArgument({ id: 'cam-1', name: 'Ingresso' });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value?.deviceId, 'cam-1');
    }
  });
});

describe('M13 Homey media parsing', () => {
  it('detects image / video kinds without assuming brand APIs', () => {
    const images = parseDeviceImages([
      { id: 'snap', url: 'http://127.0.0.1/i.jpg' },
    ]);
    assert.equal(images.length, 1);
    assert.equal(parseVideoKind('rtsp'), 'rtsp');
    assert.equal(parseVideoKind('hls'), 'hls');
    assert.equal(parseVideoKind('video/mp4.m3u8'), 'hls');
    assert.equal(isBrowserPlayableVideoKind('rtsp'), false);
    assert.equal(isBrowserPlayableVideoKind('webrtc'), false);
    assert.equal(isBrowserPlayableVideoKind('hls'), false);
    assert.equal(isBrowserPlayableVideoKind('dash'), false);
    assert.equal(isBrowserPlayableVideoKind('other'), true);
    assert.equal(parseDeviceVideos([{ id: 'v', type: 'rtsp' }])[0]?.kind, 'rtsp');
  });
});

describe('M13 NotificationMediaResolver', () => {
  it('image-only → playback image, not video', async () => {
    const resolver = new NotificationMediaResolver({
      getDevice: async (id) => {
        const dto = cameraDevice(id, { images: true });
        return {
          ...dto,
          zoneName: null,
          className: dto.className ?? null,
          images: dto.images ?? [],
          videos: dto.videos ?? [],
        };
      },
    });
    const result = await resolver.resolve('cam-1');
    assert.equal(result.media.playback, 'image');
    assert.equal(result.media.videoPlayable, false);
    assert.equal(result.media.hasImage, true);
    assert.equal(result.reason, 'image_only');
    assert.equal(result.media.sourceId, createOpaqueMediaSourceId('cam-1'));
  });

  it('RTSP video + image → image fallback, not browser video', async () => {
    const resolver = new NotificationMediaResolver({
      getDevice: async () => ({
        id: 'cam-2',
        name: 'Door',
        zoneId: null,
        zoneName: null,
        available: true,
        capabilities: [],
        capabilityValues: {},
        className: 'camera',
        images: [{ id: 'i', url: 'http://127.0.0.1/i.jpg' }],
        videos: [{ id: 'v', kind: 'rtsp' }],
      }),
    });
    const result = await resolver.resolve('cam-2');
    assert.equal(result.media.hasVideo, true);
    assert.equal(result.media.videoPlayable, false);
    assert.equal(result.media.playback, 'image');
    assert.equal(result.reason, 'video_not_browser_playable_image_fallback');
  });

  it('progressive other video + image prefers video', async () => {
    const resolver = new NotificationMediaResolver({
      getDevice: async () => ({
        id: 'cam-3',
        name: 'Yard',
        zoneId: null,
        zoneName: null,
        available: true,
        capabilities: [],
        capabilityValues: {},
        className: 'camera',
        images: [{ id: 'i', url: 'http://127.0.0.1/i.jpg' }],
        videos: [{ id: 'v', kind: 'other' }],
      }),
    });
    const result = await resolver.resolve('cam-3');
    assert.equal(result.media.playback, 'video');
    assert.equal(result.media.videoPlayable, true);
    assert.equal(result.reason, 'video_preferred_image_fallback');
  });

  it('missing device → unavailable, no throw', async () => {
    const resolver = new NotificationMediaResolver({
      getDevice: async () => null,
    });
    const result = await resolver.resolve('gone');
    assert.equal(result.media.playback, 'unavailable');
    assert.equal(result.reason, 'device_missing');
  });

  it('does not keep streams open (resolve is descriptive only)', async () => {
    let calls = 0;
    const resolver = new NotificationMediaResolver({
      getDevice: async () => {
        calls += 1;
        return {
          id: 'cam',
          name: 'Cam',
          zoneId: null,
          zoneName: null,
          available: true,
          capabilities: [],
          capabilityValues: {},
          className: 'camera',
          images: [],
          videos: [],
        };
      },
    });
    await resolver.resolve('cam');
    await resolver.resolve('cam');
    assert.equal(calls, 2);
    assert.equal(resolver.metrics.resolveAttempts, 2);
  });
});

describe('M13 NotificationManager media upsert', () => {
  it('stores public media without deviceId and keeps backend binding', () => {
    const manager = new NotificationManager({
      createId: () => 'id-1',
      now: () => 100,
    });
    const published = manager.publishNotification({
      message: 'Doorbell',
      severity: 'warning',
      displayIds: ['d1'],
      media: imageOnlyMedia,
      mediaDeviceId: 'homey-cam-a',
    });
    assert.equal(published.ok, true);
    if (!published.ok) {
      return;
    }
    assert.equal(published.value.media?.playback, 'image');
    assert.equal(
      (published.value as { deviceId?: unknown }).deviceId,
      undefined,
    );
    assert.deepEqual(manager.getMediaBinding('id-1'), {
      deviceId: 'homey-cam-a',
    });
    assert.equal(manager.getDiagnostics().notificationsWithMedia, 1);
  });

  it('upsert can replace camera A with camera B and clear media', () => {
    const manager = new NotificationManager({
      createId: () => 'id-1',
      now: () => 100,
    });
    manager.upsertForDisplay({
      displayId: 'd1',
      notificationKey: 'doorbell',
      message: 'Someone',
      severity: 'warning',
      media: { ...imageOnlyMedia, sourceId: 'cam-a' },
      mediaDeviceId: 'device-a',
    });
    const updated = manager.upsertForDisplay({
      displayId: 'd1',
      notificationKey: 'doorbell',
      message: 'Someone',
      severity: 'warning',
      media: { ...imageOnlyMedia, sourceId: 'cam-b' },
      mediaDeviceId: 'device-b',
    });
    assert.equal(updated.ok, true);
    if (!updated.ok) {
      return;
    }
    assert.equal(updated.value.media?.sourceId, 'cam-b');
    assert.equal(manager.getMediaBinding(updated.value.id)?.deviceId, 'device-b');

    const cleared = manager.upsertForDisplay({
      displayId: 'd1',
      notificationKey: 'doorbell',
      message: 'Someone',
      severity: 'warning',
      media: null,
      mediaDeviceId: null,
    });
    assert.equal(cleared.ok, true);
    if (!cleared.ok) {
      return;
    }
    assert.equal(cleared.value.media, undefined);
    assert.equal(manager.getMediaBinding(cleared.value.id), null);
  });
});

describe('M13 media session manager', () => {
  it('keeps at most one live session per Display', () => {
    const sessions = new NotificationMediaSessionManager(() => 1);
    sessions.start({
      displayId: 'd1',
      notificationId: 'n1',
      playback: 'image',
    });
    sessions.start({
      displayId: 'd1',
      notificationId: 'n2',
      playback: 'image',
    });
    assert.equal(sessions.getActiveCount(), 1);
    assert.equal(sessions.get('d1')?.notificationId, 'n2');
    sessions.stop('d1', 'n2');
    assert.equal(sessions.getActiveCount(), 0);
  });
});

describe('M13 Flow media argument', () => {
  it('omitted media does not require camera and clears binding', async () => {
    const result = await resolveShowMedia(
      {},
      {
        upsertDisplayNotification: () => ({
          ok: true,
          created: true,
          notificationId: 'x',
        }),
        removeDisplayNotificationByKey: () => ({ ok: true, removed: false }),
        removeAllDisplayNotifications: () => ({ ok: true, removedCount: 0 }),
        recordFlowNotificationError() {},
        async triggerNotificationActionPressed() {},
      },
      (key) => key,
    );
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.media, null);
      assert.equal(result.mediaDeviceId, null);
    }
  });

  it('M12 action parsing is unchanged when media is present', () => {
    const parsed = parseShowAction(
      {
        enable_action: true,
        action_id: 'open-gate',
        action_label: 'Apri cancello',
        action_text: 'Premi per aprire',
      },
      (key) => key,
    );
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.action?.actionId, 'open-gate');
    }
  });

  it('Flow Camera/Media autocomplete keeps app this (Homey calls it unbound)', async () => {
    const autocomplete = new Map<
      string,
      (query: string) => Promise<readonly { readonly id: string; readonly name: string }[]>
    >();

    const dummyCard = {
      registerRunListener() {
        return dummyCard;
      },
      registerArgumentAutocompleteListener(
        name: string,
        listener: (query: string) => Promise<readonly { readonly id: string; readonly name: string }[]>,
      ) {
        autocomplete.set(name, listener);
        return dummyCard;
      },
    };

    const dummyTrigger = {
      registerRunListener() {
        return dummyTrigger;
      },
      async trigger() {
        return undefined;
      },
    };

    const app = {
      logger: { error() {} },
      listedQuery: '',
      upsertDisplayNotification() {
        return { ok: true as const, created: true, notificationId: 'x' };
      },
      removeDisplayNotificationByKey() {
        return { ok: true as const, removed: false };
      },
      removeAllDisplayNotifications() {
        return { ok: true as const, removedCount: 0 };
      },
      recordFlowNotificationError() {},
      async triggerNotificationActionPressed() {},
      async listNotificationMediaDevices(this: { logger: unknown; listedQuery: string }, query: string) {
        if (this.logger === undefined) {
          throw new Error("Cannot read properties of undefined (reading 'logger')");
        }
        this.listedQuery = query;
        return [{ id: 'cam-1', name: 'Ingresso', zoneName: 'Hall' }];
      },
    };

    registerNotificationFlowCards({
      homey: {
        flow: {
          getActionCard: () => dummyCard,
          getDeviceTriggerCard: () => dummyTrigger,
        },
      },
      app,
      logger: silentLogger,
      translate: (key) => key,
    });

    const listener = autocomplete.get('media');
    assert.ok(listener);
    const results = await listener('ing');
    assert.equal(app.listedQuery, 'ing');
    assert.equal(results.length, 1);
    assert.equal(results[0]?.id, 'cam-1');
    assert.equal(results[0]?.name, 'Ingresso');
  });
});

describe('M13 HTTP media security', () => {
  it('parses only scoped image/video paths (no arbitrary URL proxy)', () => {
    assert.deepEqual(parseNotificationMediaPath('/notification-media/n1/image'), {
      notificationId: 'n1',
      kind: 'image',
    });
    assert.equal(parseNotificationMediaPath('/proxy?url=https://evil'), null);
    assert.equal(parseNotificationMediaPath('/notification-media/n1/image?url=x'), null);
  });

  it('Display A cannot fetch Display B notification image', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'display-a',
        name: 'A',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.10',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
        dashboard: emptyDashboardConfiguration(),
      },
      {
        displayId: 'display-b',
        name: 'B',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '192.168.1.11',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_2X4,
        dashboard: emptyDashboardConfiguration(),
      },
    ]);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm13-assets-'));
    fs.writeFileSync(path.join(dir, 'dashboard.css'), '/* test */');
    fs.writeFileSync(path.join(dir, 'dashboard.js'), '/* test */');

    const handler = new DisplayRequestHandler({
      registry,
      adapters: new AdapterRegistry([new GenericWebDisplayAdapter()]),
      diagnosticsLog: new DiagnosticsLog(),
      logger: silentLogger,
      translate: (key) => key,
      getLanguage: () => 'en',
      isDiagnosticsEnabled: () => true,
      isServerListening: () => true,
      getPort: () => 7999,
      getUptimeSeconds: () => 1,
      assets: new DashboardAssetStore(dir),
      serveNotificationMedia: async (input) => {
        if (input.displayId !== 'display-a' || input.notificationId !== 'n-a') {
          return {
            statusCode: 404,
            contentType: 'text/plain; charset=utf-8',
            body: 'Not Found',
          };
        }
        return {
          statusCode: 200,
          contentType: 'image/jpeg',
          body: '',
          binaryBody: Buffer.from('img'),
        };
      },
    });

    const asB: RequestInfo = {
      clientIp: '192.168.1.11',
      userAgent: 'test',
      method: 'GET',
      url: '/notification-media/n-a/image',
      timestamp: '2026-08-17T00:00:00.000Z',
    };
    const denied = await handler.handle(asB);
    assert.equal(denied.statusCode, 404);

    const unknown: RequestInfo = {
      ...asB,
      clientIp: '10.0.0.9',
    };
    const unknownDenied = await handler.handle(unknown);
    assert.equal(unknownDenied.statusCode, 404);
  });
});

describe('M13 gateway image scoping', () => {
  it('serves image only for the owning Display + binding, video is 415', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'd1',
        name: 'Kitchen',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '127.0.0.1',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_3X3,
        dashboard: emptyDashboardConfiguration(),
      },
    ]);
    const api = mockApi([
      cameraDevice('cam-1', { images: true, name: 'Ingresso' }),
    ]);
    const repository = new HomeyDeviceRepository(api);
    const resolver = new NotificationMediaResolver({
      getDevice: (id) => repository.getDevice(id),
      fetchImage: async (url) => {
        assert.match(url, /127\.0\.0\.1/);
        return { bytes: Buffer.from('jpeg'), contentType: 'image/jpeg' };
      },
    });
    const gateway = new RealtimeGateway({
      registry,
      deviceRepository: repository,
      capabilitySubscriber: {
        subscribeCapability: (options) =>
          repository.subscribeCapability(options),
      },
      logger: silentLogger,
      translate: (key) => key,
      getLanguage: () => 'en',
      mediaResolver: resolver,
    });

    const published = gateway.publishNotification({
      id: 'n1',
      message: 'Doorbell',
      severity: 'warning',
      displayIds: ['d1'],
      media: imageOnlyMedia,
      mediaDeviceId: 'cam-1',
    });
    assert.equal(published.ok, true);

    const ok = await gateway.serveNotificationImage('d1', 'n1');
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.contentType, 'image/jpeg');
    assert.equal(ok.cacheControl, 'private, no-store');
    assert.ok(ok.binaryBody && ok.binaryBody.byteLength > 0);

    const foreign = await gateway.serveNotificationImage('d2', 'n1');
    assert.equal(foreign.statusCode, 404);

    gateway.removeNotification('n1');
    const stale = await gateway.serveNotificationImage('d1', 'n1');
    assert.equal(stale.statusCode, 404);

    const video = gateway.serveNotificationVideo();
    assert.equal(video.statusCode, 415);

    await gateway.destroy();
    assert.equal(gateway.mediaSessions.getActiveCount(), 0);
  });

  it('media start is rejected for a foreign Display notification', async () => {
    const registry = new DisplayRegistry();
    registry.rebuild([
      {
        displayId: 'd1',
        name: 'A',
        typeId: DISPLAY_TYPE_IDS.GENERIC_WEB_DISPLAY,
        ipAddress: '127.0.0.1',
        hardwareId: null,
        layoutId: LAYOUT_IDS.GRID_3X3,
        dashboard: emptyDashboardConfiguration(),
      },
    ]);
    const repository = new HomeyDeviceRepository(mockApi([]));
    const gateway = new RealtimeGateway({
      registry,
      deviceRepository: repository,
      capabilitySubscriber: {
        subscribeCapability: () => Promise.resolve(null),
      },
      logger: silentLogger,
      translate: (key) => key,
      getLanguage: () => 'en',
    });
    gateway.publishNotification({
      id: 'n1',
      message: 'Hi',
      severity: 'info',
      displayIds: ['d1'],
      media: imageOnlyMedia,
      mediaDeviceId: 'cam-1',
    });
    assert.equal(
      gateway.notifications.notificationTargetsDisplay('n1', 'd-other'),
      false,
    );
    await gateway.destroy();
  });
});

describe('M13 frontend media controller', () => {
  it('does not start a live session for notifications without media', () => {
    const host = new FakeElement();
    const restore = installDomStub(host);
    try {
      let starts = 0;
      const controller = new NotificationMediaController({
        host: host as unknown as HTMLElement,
        copy: defaultDashboardUiCopy().notifications,
        onStart: () => {
          starts += 1;
        },
      });
      controller.sync(
        note({ id: 'plain', message: 'Hello', severity: 'info' }),
        true,
      );
      assert.equal(controller.getState(), 'idle');
      assert.equal(starts, 0);
      controller.destroy();
    } finally {
      restore();
    }
  });

  it('image-only loads image and never attempts video', () => {
    const host = new FakeElement();
    const restore = installDomStub(host);
    try {
      const media = new NotificationMediaController({
        host: host as unknown as HTMLElement,
        copy: defaultDashboardUiCopy().notifications,
      });
      media.start(
        note({
          id: 'n-img',
          message: 'Door',
          severity: 'warning',
          media: imageOnlyMedia,
        }),
      );
      const frame = host.querySelector('.notification-media') as FakeElement;
      const image = frame.querySelector(
        '.notification-media__image',
      ) as FakeElement;
      const video = frame.querySelector(
        '.notification-media__video',
      ) as FakeElement;
      assert.equal(image.hidden, false);
      assert.match(image.src, /n-img\/image/);
      assert.equal(video.src, '');
      image.dispatch('load');
      assert.equal(media.getState(), 'image');
      media.stop();
      assert.ok(media.getState() === 'stopped' || media.getState() === 'idle');
      assert.equal(media.getActiveNotificationId(), null);
      media.destroy();
    } finally {
      restore();
    }
  });

  it('refreshes the snapshot while visible and stops refresh on close', async () => {
    const host = new FakeElement();
    const restore = installDomStub(host);
    try {
      const media = new NotificationMediaController({
        host: host as unknown as HTMLElement,
        copy: defaultDashboardUiCopy().notifications,
        imageRefreshMs: 20,
      });
      media.start(
        note({
          id: 'n-live',
          message: 'Door',
          severity: 'warning',
          media: imageOnlyMedia,
        }),
      );
      const frame = host.querySelector('.notification-media') as FakeElement;
      const image = frame.querySelector(
        '.notification-media__image',
      ) as FakeElement;
      image.dispatch('load');
      assert.equal(media.getState(), 'image');
      await new Promise((resolve) => {
        setTimeout(resolve, 30);
      });
      const buffer = frame.querySelector(
        '.notification-media__image--buffer',
      ) as FakeElement;
      assert.match(buffer.src, /n-live\/image\?t=/);
      media.stop();
      assert.equal(buffer.src, '');
      const srcAfterStop = buffer.src;
      await new Promise((resolve) => {
        setTimeout(resolve, 30);
      });
      assert.equal(buffer.src, srcAfterStop);
      media.destroy();
    } finally {
      restore();
    }
  });

  it('video + image: placeholder then video ready', () => {
    const host = new FakeElement();
    const restore = installDomStub(host);
    try {
      const events: string[] = [];
      const media = new NotificationMediaController({
        host: host as unknown as HTMLElement,
        copy: defaultDashboardUiCopy().notifications,
        onTelemetry: (_id, event) => {
          events.push(event);
        },
      });
      media.start(
        note({
          id: 'n-vid',
          message: 'Door',
          severity: 'warning',
          media: videoAndImageMedia,
        }),
      );
      const frame = host.querySelector('.notification-media') as FakeElement;
      const image = frame.querySelector(
        '.notification-media__image',
      ) as FakeElement;
      const video = frame.querySelector(
        '.notification-media__video',
      ) as FakeElement;
      image.dispatch('load');
      video.dispatch('playing');
      assert.equal(media.getState(), 'video');
      assert.ok(events.includes('image-loaded'));
      assert.ok(events.includes('video-ready'));
      media.destroy();
    } finally {
      restore();
    }
  });

  it('video failure with image falls back to snapshot', () => {
    const host = new FakeElement();
    const restore = installDomStub(host);
    try {
      const events: string[] = [];
      const media = new NotificationMediaController({
        host: host as unknown as HTMLElement,
        copy: defaultDashboardUiCopy().notifications,
        onTelemetry: (_id, event) => {
          events.push(event);
        },
      });
      media.start(
        note({
          id: 'n-fb',
          message: 'Door',
          severity: 'warning',
          media: videoAndImageMedia,
        }),
      );
      const frame = host.querySelector('.notification-media') as FakeElement;
      const video = frame.querySelector(
        '.notification-media__video',
      ) as FakeElement;
      video.dispatch('error');
      assert.equal(media.getState(), 'fallback-image');
      assert.ok(events.includes('video-failed'));
      assert.ok(events.includes('image-fallback'));
      media.destroy();
    } finally {
      restore();
    }
  });

  it('video-only failure shows unavailable, not a broken player', () => {
    const host = new FakeElement();
    const restore = installDomStub(host);
    try {
      const media = new NotificationMediaController({
        host: host as unknown as HTMLElement,
        copy: defaultDashboardUiCopy().notifications,
      });
      media.start(
        note({
          id: 'n-vo',
          message: 'Door',
          severity: 'warning',
          media: videoOnlyMedia,
        }),
      );
      const frame = host.querySelector('.notification-media') as FakeElement;
      const video = frame.querySelector(
        '.notification-media__video',
      ) as FakeElement;
      video.dispatch('error');
      assert.equal(media.getState(), 'error');
      const error = frame.querySelector(
        '.notification-media__error',
      ) as FakeElement;
      assert.equal(error.hidden, false);
      assert.equal(error.textContent, 'Video unavailable');
      media.destroy();
    } finally {
      restore();
    }
  });
});

describe('M13 Notification Center media lifecycle', () => {
  it('open starts one session; close / auto-close / carousel stop it', async () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const starts: string[] = [];
      const stops: string[] = [];
      const controller = new NotificationController();
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: () => undefined,
        onMediaStart: (id) => {
          starts.push(id);
        },
        onMediaStop: (id) => {
          stops.push(id);
        },
      });

      controller.applySnapshot([
        note({
          id: 'a',
          message: 'Cam A',
          severity: 'warning',
          media: { ...imageOnlyMedia, sourceId: 'a' },
          publishedAt: 1,
        }),
        note({
          id: 'b',
          message: 'Cam B',
          severity: 'info',
          media: { ...imageOnlyMedia, sourceId: 'b' },
          publishedAt: 2,
        }),
        note({
          id: 'c',
          message: 'No cam',
          severity: 'success',
          publishedAt: 3,
        }),
      ]);
      controller.openCenter();
      assert.equal(controller.getCurrent()?.id, 'a');
      assert.equal(starts.at(-1), 'a');

      controller.goNext();
      assert.equal(controller.getCurrent()?.id, 'c');
      assert.ok(stops.includes('a'));
      assert.equal(starts.at(-1), 'a');

      controller.goNext();
      assert.equal(controller.getCurrent()?.id, 'b');
      assert.equal(starts.at(-1), 'b');
      assert.ok(stops.includes('a'));

      controller.closeCenter();
      assert.ok(stops.includes('b'));
      const startsAfterClose = starts.length;
      controller.openCenter();
      assert.ok(starts.length > startsAfterClose);

      controller.closeCenter();
      center.scheduleAutoClose(60);
      assert.equal(center.hasActiveAutoCloseTimer(), false);

      controller.applySnapshot([
        note({
          id: 'doorbell',
          message: 'Someone',
          severity: 'warning',
          highlight: true,
          autoOpen: true,
          autoCloseSeconds: 60,
          media: imageOnlyMedia,
          action: {
            actionId: 'open-gate',
            label: 'Apri cancello',
            text: 'Premi per aprire il cancello pedonale',
          },
        }),
      ]);
      controller.openCenter(true);
      center.scheduleAutoClose(0.05);
      assert.equal(center.hasActiveAutoCloseTimer(), true);
      await new Promise((resolve) => {
        setTimeout(resolve, 80);
      });
      assert.equal(controller.isCenterOpen(), false);
      center.destroy();
    } finally {
      restore();
    }
  });

  it('action CTA remains usable when media is in error', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      let actionId: string | null = null;
      const controller = new NotificationController();
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: (input) => {
          actionId = input.actionId;
        },
      });
      controller.applySnapshot([
        note({
          id: 'doorbell',
          notificationKey: 'doorbell',
          message: 'Someone',
          severity: 'warning',
          media: unavailableCameraMedia(),
          action: { actionId: 'open-gate', label: 'Apri cancello' },
        }),
      ]);
      controller.openCenter();
      const actionButton = body.querySelector(
        '.notification-center__action',
      ) as FakeElement;
      assert.equal(actionButton.hidden, false);
      actionButton.click();
      assert.equal(actionId, 'open-gate');
      center.destroy();
    } finally {
      restore();
    }
  });

  it('no-media notification does not create a live media start', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      let starts = 0;
      const controller = new NotificationController();
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: () => undefined,
        onMediaStart: () => {
          starts += 1;
        },
      });
      controller.applySnapshot([
        note({ id: 'plain', message: 'Hello', severity: 'info' }),
      ]);
      controller.openCenter();
      assert.equal(starts, 0);
      center.destroy();
    } finally {
      restore();
    }
  });
});

describe('M13 Homey device listing', () => {
  it('lists camera-class or image/video devices, not brand-specific ids', async () => {
    const repository = new HomeyDeviceRepository(
      mockApi([
        cameraDevice('cam-1', { name: 'Ingresso', images: true }),
        {
          id: 'lamp-1',
          name: 'Lamp',
          zoneId: null,
          available: true,
          capabilities: ['onoff'],
          capabilityValues: { onoff: true },
        },
      ]),
    );
    const listed = await repository.listMediaCompatibleDevices('');
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.id, 'cam-1');
  });
});
