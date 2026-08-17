/**
 * Frontend-safe notification media descriptor.
 * Homey Device ids, tokens, credentials, and raw URLs never appear here.
 */

export const NOTIFICATION_MEDIA_TYPE_CAMERA = 'camera' as const;

export type NotificationMediaPlayback = 'video' | 'image' | 'unavailable';

export type NotificationMediaState =
  | 'idle'
  | 'loading'
  | 'image'
  | 'video'
  | 'fallback-image'
  | 'error'
  | 'stopped';

/**
 * Normalized media attached to a DisplayNotification (wire + UI).
 * Backend resolves Homey Device capabilities; the browser only learns
 * what it may attempt to display.
 */
export interface NotificationMedia {
  readonly type: typeof NOTIFICATION_MEDIA_TYPE_CAMERA;
  /**
   * Opaque binding id. Changes when the Homey Device changes so the
   * frontend can restart media without learning the Device id.
   */
  readonly sourceId?: string;
  readonly hasImage: boolean;
  readonly hasVideo: boolean;
  /**
   * True only when Homey exposes a source the Wall Display browser can
   * play without transcoding or credential leakage (today: never for
   * RTSP / RTMP / WebRTC / HLS / DASH).
   */
  readonly videoPlayable: boolean;
  readonly playback: NotificationMediaPlayback;
}

export interface NotificationMediaBinding {
  readonly deviceId: string;
}

export function isNotificationMediaPlayback(
  value: unknown,
): value is NotificationMediaPlayback {
  return value === 'video' || value === 'image' || value === 'unavailable';
}

export function isNotificationMedia(value: unknown): value is NotificationMedia {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as {
    readonly type?: unknown;
    readonly sourceId?: unknown;
    readonly hasImage?: unknown;
    readonly hasVideo?: unknown;
    readonly videoPlayable?: unknown;
    readonly playback?: unknown;
    readonly deviceId?: unknown;
    readonly url?: unknown;
    readonly token?: unknown;
  };
  if (candidate.type !== NOTIFICATION_MEDIA_TYPE_CAMERA) {
    return false;
  }
  if (
    candidate.sourceId !== undefined &&
    (typeof candidate.sourceId !== 'string' || candidate.sourceId.trim() === '')
  ) {
    return false;
  }
  if (typeof candidate.hasImage !== 'boolean') {
    return false;
  }
  if (typeof candidate.hasVideo !== 'boolean') {
    return false;
  }
  if (typeof candidate.videoPlayable !== 'boolean') {
    return false;
  }
  if (!isNotificationMediaPlayback(candidate.playback)) {
    return false;
  }
  // Reject leaked Homey/camera secrets on the wire.
  if (candidate.deviceId !== undefined || candidate.url !== undefined) {
    return false;
  }
  if (candidate.token !== undefined) {
    return false;
  }
  return true;
}

export function unavailableCameraMedia(): NotificationMedia {
  return {
    type: NOTIFICATION_MEDIA_TYPE_CAMERA,
    hasImage: false,
    hasVideo: false,
    videoPlayable: false,
    playback: 'unavailable',
  };
}

export function mediaFingerprint(media: NotificationMedia | undefined): string {
  if (!media) {
    return '';
  }
  return `${media.type}:${media.sourceId ?? ''}:${media.hasImage ? '1' : '0'}:${media.hasVideo ? '1' : '0'}:${media.videoPlayable ? '1' : '0'}:${media.playback}`;
}

/** Frontend-safe FNV-1a; never send the raw Homey Device id to the browser. */
export function createOpaqueMediaSourceId(deviceId: string): string {
  let hash = 2166136261;
  for (let i = 0; i < deviceId.length; i += 1) {
    hash ^= deviceId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `cam-${(hash >>> 0).toString(16)}`;
}
