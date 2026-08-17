/**
 * Defensive parsers for Homey Web API Device.images / Device.videos.
 * Shapes vary by Homey version and camera app; unknown fields are ignored.
 *
 * @see https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerDevices.Device.html
 * @see https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerImages.html
 * @see https://apps.developer.homey.app/advanced/videos
 */

export type HomeyVideoKind =
  | 'webrtc'
  | 'hls'
  | 'dash'
  | 'rtsp'
  | 'rtmp'
  | 'other'
  | 'unknown';

export interface HomeyDeviceImageRef {
  readonly id: string;
  readonly url: string;
}

export interface HomeyDeviceVideoRef {
  readonly id: string;
  readonly kind: HomeyVideoKind;
}

export function parseDeviceClassName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function parseDeviceImages(value: unknown): readonly HomeyDeviceImageRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const images: HomeyDeviceImageRef[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const parsed = parseOneImage(item);
    if (!parsed || seen.has(parsed.id)) {
      continue;
    }
    seen.add(parsed.id);
    images.push(parsed);
  }
  return images;
}

export function parseDeviceVideos(value: unknown): readonly HomeyDeviceVideoRef[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const videos: HomeyDeviceVideoRef[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const parsed = parseOneVideo(item);
    if (!parsed || seen.has(parsed.id)) {
      continue;
    }
    seen.add(parsed.id);
    videos.push(parsed);
  }
  return videos;
}

function parseOneImage(value: unknown): HomeyDeviceImageRef | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const nested =
    typeof candidate.imageObj === 'object' && candidate.imageObj !== null
      ? (candidate.imageObj as Record<string, unknown>)
      : null;

  const url = firstNonEmptyString(
    nested?.url,
    nested?.localUrl,
    candidate.url,
    candidate.localUrl,
  );
  if (!url) {
    return null;
  }

  const id = firstNonEmptyString(nested?.id, candidate.id, url);
  if (!id) {
    return null;
  }

  return { id, url };
}

function parseOneVideo(value: unknown): HomeyDeviceVideoRef | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const id = firstNonEmptyString(
    candidate.id,
    candidate.videoId,
    candidate.name,
  );
  if (!id) {
    return null;
  }
  return {
    id,
    kind: parseVideoKind(
      candidate.type ?? candidate.kind ?? candidate.protocol,
    ),
  };
}

export function parseVideoKind(value: unknown): HomeyVideoKind {
  if (typeof value !== 'string') {
    return 'unknown';
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.includes('webrtc')) {
    return 'webrtc';
  }
  if (normalized.includes('hls') || normalized.includes('m3u8')) {
    return 'hls';
  }
  if (normalized.includes('dash') || normalized.includes('mpd')) {
    return 'dash';
  }
  if (normalized.includes('rtsp')) {
    return 'rtsp';
  }
  if (normalized.includes('rtmp')) {
    return 'rtmp';
  }
  if (normalized === 'other' || normalized.includes('mp4')) {
    return 'other';
  }
  return 'unknown';
}

function firstNonEmptyString(...values: readonly unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }
  return null;
}

/**
 * Progressive HTTP(S) MP4 without userinfo could theoretically play in
 * `<video>`. Homey camera apps almost never expose this; RTSP/WebRTC/HLS
 * are not browser-playable on the Wall Display without transcoding.
 */
export function isBrowserPlayableVideoKind(kind: HomeyVideoKind): boolean {
  return kind === 'other';
}
