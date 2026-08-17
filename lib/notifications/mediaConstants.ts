/**
 * Centralized media timeouts and limits. Not Homey user settings.
 */

/** Homey Images are documented at max 5 MB. */
export const NOTIFICATION_MEDIA_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Backend resolve of Homey Device images/videos. */
export const NOTIFICATION_MEDIA_RESOLVE_TIMEOUT_MS = 4_000;

/** Frontend `<img>` load. */
export const NOTIFICATION_MEDIA_IMAGE_LOAD_TIMEOUT_MS = 8_000;

/** Frontend `<video>` startup before fallback. */
export const NOTIFICATION_MEDIA_VIDEO_START_TIMEOUT_MS = 8_000;

/** HTTP fetch of a Homey-managed snapshot. */
export const NOTIFICATION_MEDIA_IMAGE_FETCH_TIMEOUT_MS = 8_000;

/**
 * Live snapshot refresh while the Center shows an image (or video fallback).
 * Matches typical Homey camera `Image.update()` cadence (~3s) so we do not
 * refetch the same JPEG. One request in flight; the next starts when the
 * previous finishes, waiting only the remainder of this interval.
 * Stops when the Center closes.
 */
export const NOTIFICATION_MEDIA_IMAGE_REFRESH_MS = 3_000;

/** Reuse the resolved Homey image URL so refresh does not re-list devices. */
export const NOTIFICATION_MEDIA_IMAGE_REF_CACHE_MS = 4_000;
