/**
 * Resolves a Homey Device into a frontend-safe notification media descriptor.
 * Does not open streams, WebRTC sessions, or keep listeners.
 *
 * @see https://apps.developer.homey.app/advanced/images
 * @see https://apps.developer.homey.app/advanced/videos
 */

import {
  NOTIFICATION_MEDIA_IMAGE_FETCH_TIMEOUT_MS,
  NOTIFICATION_MEDIA_IMAGE_MAX_BYTES,
  NOTIFICATION_MEDIA_RESOLVE_TIMEOUT_MS,
} from '../notifications/mediaConstants';
import {
  createOpaqueMediaSourceId,
  unavailableCameraMedia,
  type NotificationMedia,
} from '../notifications/media';
import type { HomeyDeviceSnapshot } from './types';
import {
  isBrowserPlayableVideoKind,
  type HomeyDeviceImageRef,
  type HomeyVideoKind,
} from './parseHomeyMedia';

export interface HomeyImageBytes {
  readonly bytes: Buffer;
  readonly contentType: string;
}

export interface NotificationMediaResolveResult {
  readonly media: NotificationMedia;
  readonly deviceName: string | null;
  readonly deviceAvailable: boolean;
  readonly videoKind: HomeyVideoKind | null;
  readonly image: HomeyDeviceImageRef | null;
  readonly reason: string;
}

export interface NotificationMediaResolverOptions {
  readonly getDevice: (id: string) => Promise<HomeyDeviceSnapshot | null>;
  readonly fetchImage?: (url: string) => Promise<HomeyImageBytes | null>;
  readonly now?: () => number;
  readonly resolveTimeoutMs?: number;
}

export interface NotificationMediaResolverMetrics {
  resolveAttempts: number;
  resolveSuccess: number;
  resolveFailures: number;
}

export class NotificationMediaResolver {
  private readonly getDevice: NotificationMediaResolverOptions['getDevice'];
  private readonly fetchImage:
    | NonNullable<NotificationMediaResolverOptions['fetchImage']>
    | null;
  private readonly resolveTimeoutMs: number;

  public readonly metrics: NotificationMediaResolverMetrics = {
    resolveAttempts: 0,
    resolveSuccess: 0,
    resolveFailures: 0,
  };

  public constructor(options: NotificationMediaResolverOptions) {
    this.getDevice = options.getDevice;
    this.fetchImage = options.fetchImage ?? null;
    this.resolveTimeoutMs =
      options.resolveTimeoutMs ?? NOTIFICATION_MEDIA_RESOLVE_TIMEOUT_MS;
  }

  public async resolve(deviceId: string): Promise<NotificationMediaResolveResult> {
    this.metrics.resolveAttempts += 1;
    const trimmed = deviceId.trim();
    if (trimmed === '') {
      this.metrics.resolveFailures += 1;
      return emptyResult('invalid_device_id');
    }

    const sourceId = createOpaqueMediaSourceId(trimmed);

    try {
      const device = await withTimeout(
        this.getDevice(trimmed),
        this.resolveTimeoutMs,
      );
      if (!device) {
        this.metrics.resolveFailures += 1;
        return emptyResult('device_missing', sourceId);
      }

      const images = device.images ?? [];
      const videos = device.videos ?? [];
      const hasImage = images.length > 0;
      const hasVideo = videos.length > 0;
      const videoKind = videos[0]?.kind ?? null;
      const videoPlayable =
        hasVideo &&
        videoKind !== null &&
        isBrowserPlayableVideoKind(videoKind);

      let playback: NotificationMedia['playback'] = 'unavailable';
      let reason = 'no_compatible_media';
      if (videoPlayable && hasImage) {
        playback = 'video';
        reason = 'video_preferred_image_fallback';
      } else if (videoPlayable) {
        playback = 'video';
        reason = 'video_only';
      } else if (hasImage) {
        playback = 'image';
        reason = hasVideo
          ? 'video_not_browser_playable_image_fallback'
          : 'image_only';
      } else if (hasVideo) {
        reason = 'video_not_browser_playable';
      }

      this.metrics.resolveSuccess += 1;
      return {
        media: {
          type: 'camera',
          sourceId: createOpaqueMediaSourceId(trimmed),
          hasImage,
          hasVideo,
          videoPlayable,
          playback,
        },
        deviceName: device.name,
        deviceAvailable: device.available,
        videoKind,
        image: images[0] ?? null,
        reason,
      };
    } catch {
      this.metrics.resolveFailures += 1;
      return emptyResult('resolve_failed', sourceId);
    }
  }

  public async loadImage(
    image: HomeyDeviceImageRef,
  ): Promise<HomeyImageBytes | null> {
    if (!this.fetchImage) {
      return null;
    }
    try {
      const result = await withTimeout(
        this.fetchImage(image.url),
        NOTIFICATION_MEDIA_IMAGE_FETCH_TIMEOUT_MS,
      );
      if (!result) {
        return null;
      }
      if (result.bytes.byteLength > NOTIFICATION_MEDIA_IMAGE_MAX_BYTES) {
        return null;
      }
      return result;
    } catch {
      return null;
    }
  }
}

function emptyResult(
  reason: string,
  sourceId?: string,
): NotificationMediaResolveResult {
  return {
    media: sourceId
      ? { ...unavailableCameraMedia(), sourceId }
      : unavailableCameraMedia(),
    deviceName: null,
    deviceAvailable: false,
    videoKind: null,
    image: null,
    reason,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('media_resolve_timeout'));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
