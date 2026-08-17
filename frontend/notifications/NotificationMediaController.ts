/**
 * Isolated live-media controller for one Notification Center.
 * At most one live session: start() always stops the previous first.
 */

import {
  NOTIFICATION_MEDIA_IMAGE_LOAD_TIMEOUT_MS,
  NOTIFICATION_MEDIA_IMAGE_REFRESH_MS,
  NOTIFICATION_MEDIA_VIDEO_START_TIMEOUT_MS,
} from '../../lib/notifications/mediaConstants';
import { mediaFingerprint } from '../../lib/notifications/media';
import type {
  NotificationMediaState,
} from '../../lib/notifications/media';
import type { DisplayNotification } from '../../lib/notifications/types';

export interface NotificationMediaCopy {
  readonly loadingCamera: string;
  readonly cameraUnavailable: string;
  readonly videoUnavailable: string;
  readonly imageUnavailable: string;
  readonly retry: string;
}

export interface NotificationMediaControllerOptions {
  readonly host: HTMLElement;
  readonly copy: NotificationMediaCopy;
  readonly onUserInteraction?: () => void;
  readonly onStart?: (notificationId: string) => void;
  readonly onStop?: (notificationId: string) => void;
  readonly onTelemetry?: (
    notificationId: string,
    event: 'image-loaded' | 'video-ready' | 'video-failed' | 'image-fallback',
  ) => void;
  readonly imageUrl?: (notificationId: string) => string;
  readonly videoUrl?: (notificationId: string) => string;
  /** Override live snapshot interval; 0 disables refresh (tests). */
  readonly imageRefreshMs?: number;
}

export class NotificationMediaController {
  private readonly host: HTMLElement;
  private copy: NotificationMediaCopy;
  private readonly onUserInteraction: (() => void) | null;
  private readonly onStart: ((notificationId: string) => void) | null;
  private readonly onStop: ((notificationId: string) => void) | null;
  private readonly onTelemetry: NotificationMediaControllerOptions['onTelemetry'];
  private readonly imageUrl: (notificationId: string) => string;
  private readonly videoUrl: (notificationId: string) => string;
  private readonly imageRefreshMs: number;

  private readonly frame: HTMLElement;
  private imageEl: HTMLImageElement;
  private imageBufferEl: HTMLImageElement;
  private readonly videoEl: HTMLVideoElement;
  private readonly loadingEl: HTMLElement;
  private readonly errorEl: HTMLElement;
  private readonly retryButton: HTMLButtonElement;

  private state: NotificationMediaState = 'idle';
  private activeNotificationId: string | null = null;
  private activeFingerprint = '';
  private imageTimer: ReturnType<typeof setTimeout> | null = null;
  private videoTimer: ReturnType<typeof setTimeout> | null = null;
  private imageRefreshTimer: ReturnType<typeof setTimeout> | null = null;
  private imageRefreshInFlight = false;
  private imageRefreshStartedAt = 0;
  private lastNotification: DisplayNotification | null = null;
  private retryUsed = false;
  private destroyed = false;

  private readonly onImageLoad: (event: Event) => void;
  private readonly onImageError: (event: Event) => void;
  private readonly onVideoReady: () => void;
  private readonly onVideoError: () => void;

  public constructor(options: NotificationMediaControllerOptions) {
    this.host = options.host;
    this.copy = options.copy;
    this.onUserInteraction = options.onUserInteraction ?? null;
    this.onStart = options.onStart ?? null;
    this.onStop = options.onStop ?? null;
    this.onTelemetry = options.onTelemetry;
    this.imageUrl =
      options.imageUrl ??
      ((id) => `/notification-media/${encodeURIComponent(id)}/image`);
    this.videoUrl =
      options.videoUrl ??
      ((id) => `/notification-media/${encodeURIComponent(id)}/video`);
    this.imageRefreshMs =
      options.imageRefreshMs ?? NOTIFICATION_MEDIA_IMAGE_REFRESH_MS;

    this.frame = document.createElement('div');
    this.frame.className = 'notification-media';
    this.frame.hidden = true;

    this.imageEl = this.createImageElement(false);
    this.imageBufferEl = this.createImageElement(true);

    this.videoEl = document.createElement('video');
    this.videoEl.className = 'notification-media__video';
    this.videoEl.hidden = true;
    this.videoEl.muted = true;
    if ('playsInline' in this.videoEl) {
      this.videoEl.playsInline = true;
    }
    this.videoEl.setAttribute('playsinline', 'true');
    this.videoEl.setAttribute('webkit-playsinline', 'true');
    this.videoEl.autoplay = true;
    this.videoEl.controls = false;

    this.loadingEl = document.createElement('p');
    this.loadingEl.className = 'notification-media__loading';
    this.loadingEl.hidden = true;

    this.errorEl = document.createElement('p');
    this.errorEl.className = 'notification-media__error';
    this.errorEl.hidden = true;

    this.retryButton = document.createElement('button');
    this.retryButton.type = 'button';
    this.retryButton.className = 'notification-media__retry';
    this.retryButton.hidden = true;

    this.frame.appendChild(this.imageEl);
    this.frame.appendChild(this.imageBufferEl);
    this.frame.appendChild(this.videoEl);
    this.frame.appendChild(this.loadingEl);
    this.frame.appendChild(this.errorEl);
    this.frame.appendChild(this.retryButton);
    this.host.appendChild(this.frame);

    this.onImageLoad = (event: Event): void => {
      if (event.target === this.imageBufferEl) {
        this.commitRefreshedImage();
        return;
      }
      if (this.state !== 'loading' && this.state !== 'fallback-image') {
        if (this.state === 'video') {
          return;
        }
      }
      this.clearImageTimer();
      if (this.activeNotificationId) {
        this.onTelemetry?.(this.activeNotificationId, 'image-loaded');
      }
      if (this.state === 'loading' && this.videoEl.hidden) {
        this.setState('image');
      } else if (this.state === 'fallback-image' || this.state === 'loading') {
        this.imageEl.hidden = false;
        if (this.state === 'fallback-image') {
          this.startImageRefresh();
        }
      }
    };
    this.onImageError = (event: Event): void => {
      if (event.target === this.imageBufferEl) {
        this.imageRefreshInFlight = false;
        this.armImageRefresh(this.imageRefreshMs);
        return;
      }
      this.clearImageTimer();
      if (this.state === 'video') {
        return;
      }
      if (!this.videoEl.hidden && this.state === 'loading') {
        return;
      }
      if (this.state === 'image' || this.state === 'fallback-image') {
        return;
      }
      this.setState('error');
    };
    this.onVideoReady = (): void => {
      this.clearVideoTimer();
      if (this.activeNotificationId) {
        this.onTelemetry?.(this.activeNotificationId, 'video-ready');
      }
      this.setState('video');
    };
    this.onVideoError = (): void => {
      this.handleVideoFailure();
    };

    this.imageEl.addEventListener('load', this.onImageLoad);
    this.imageEl.addEventListener('error', this.onImageError);
    this.imageBufferEl.addEventListener('load', this.onImageLoad);
    this.imageBufferEl.addEventListener('error', this.onImageError);
    this.videoEl.addEventListener('playing', this.onVideoReady);
    this.videoEl.addEventListener('loadeddata', this.onVideoReady);
    this.videoEl.addEventListener('error', this.onVideoError);
    this.retryButton.addEventListener('click', () => {
      this.onUserInteraction?.();
      this.retry();
    });

    this.syncCopy();
  }

  public getState(): NotificationMediaState {
    return this.state;
  }

  public getActiveNotificationId(): string | null {
    return this.activeNotificationId;
  }

  public setCopy(copy: NotificationMediaCopy): void {
    this.copy = copy;
    this.syncCopy();
  }

  public sync(notification: DisplayNotification | null, centerOpen: boolean): void {
    if (!centerOpen || !notification?.media) {
      this.stop();
      return;
    }
    const fingerprint = mediaFingerprint(notification.media);
    if (
      this.activeNotificationId === notification.id &&
      this.activeFingerprint === fingerprint &&
      this.state !== 'idle' &&
      this.state !== 'stopped'
    ) {
      return;
    }
    this.start(notification);
  }

  public start(notification: DisplayNotification, isRetry = false): void {
    this.stop();
    if (this.destroyed || !notification.media) {
      return;
    }

    this.activeNotificationId = notification.id;
    this.activeFingerprint = mediaFingerprint(notification.media);
    this.lastNotification = notification;
    this.retryUsed = isRetry;
    this.frame.hidden = false;
    this.onStart?.(notification.id);
    this.setState('loading');

    const media = notification.media;
    if (media.hasImage) {
      this.imageEl.hidden = false;
      this.imageEl.src = this.imageUrl(notification.id);
      this.imageTimer = setTimeout(() => {
        this.imageTimer = null;
        if (this.state === 'loading' && this.videoEl.hidden) {
          this.setState('error');
        }
      }, NOTIFICATION_MEDIA_IMAGE_LOAD_TIMEOUT_MS);
    }

    if (media.videoPlayable && media.playback === 'video') {
      this.videoEl.hidden = false;
      this.videoEl.src = this.videoUrl(notification.id);
      this.videoTimer = setTimeout(() => {
        this.videoTimer = null;
        this.handleVideoFailure();
      }, NOTIFICATION_MEDIA_VIDEO_START_TIMEOUT_MS);
      const playResult = this.videoEl.play();
      if (playResult !== undefined && typeof playResult.catch === 'function') {
        void playResult.catch(() => {
          this.handleVideoFailure();
        });
      }
    } else if (!media.hasImage) {
      this.setState('error');
    }
  }

  public stop(): void {
    const previousId = this.activeNotificationId;
    this.clearImageTimer();
    this.clearVideoTimer();
    this.stopImageRefresh();
    this.teardownPlayback();
    this.activeNotificationId = null;
    this.activeFingerprint = '';
    this.lastNotification = null;
    this.frame.hidden = true;
    if (this.state !== 'idle' && this.state !== 'stopped') {
      this.state = 'stopped';
    } else {
      this.state = 'idle';
    }
    if (previousId) {
      this.onStop?.(previousId);
    }
  }

  public destroy(): void {
    this.stop();
    this.destroyed = true;
    this.imageEl.removeEventListener('load', this.onImageLoad);
    this.imageEl.removeEventListener('error', this.onImageError);
    this.imageBufferEl.removeEventListener('load', this.onImageLoad);
    this.imageBufferEl.removeEventListener('error', this.onImageError);
    this.videoEl.removeEventListener('playing', this.onVideoReady);
    this.videoEl.removeEventListener('loadeddata', this.onVideoReady);
    this.videoEl.removeEventListener('error', this.onVideoError);
    this.frame.remove();
  }

  private retry(): void {
    if (this.retryUsed || !this.lastNotification) {
      return;
    }
    this.start(this.lastNotification, true);
  }

  private handleVideoFailure(): void {
    this.clearVideoTimer();
    this.unloadVideo();
    if (this.activeNotificationId) {
      this.onTelemetry?.(this.activeNotificationId, 'video-failed');
    }
    const imageSrc =
      this.imageEl.getAttribute('src') ||
      this.imageEl.currentSrc ||
      this.imageEl.src;
    if (!this.imageEl.hidden && imageSrc) {
      if (this.activeNotificationId) {
        this.onTelemetry?.(this.activeNotificationId, 'image-fallback');
      }
      this.setState('fallback-image');
      return;
    }
    this.setState('error');
  }

  private setState(next: NotificationMediaState): void {
    this.state = next;
    const loading = next === 'loading';
    const error = next === 'error';
    this.loadingEl.hidden = !loading;
    this.errorEl.hidden = !error;
    this.retryButton.hidden = !error || this.retryUsed;
    if (error) {
      this.errorEl.textContent = this.errorCopyFor(this.lastNotification);
    }

    if (next === 'video') {
      this.stopImageRefresh();
      this.videoEl.hidden = false;
      this.imageEl.hidden = true;
    } else if (next === 'image' || next === 'fallback-image') {
      this.videoEl.hidden = true;
      this.startImageRefresh();
    } else if (next === 'loading') {
      this.videoEl.hidden = this.videoEl.src === '';
    } else {
      this.stopImageRefresh();
    }

    this.frame.dataset.state = next;
  }

  private errorCopyFor(notification: DisplayNotification | null): string {
    const media = notification?.media;
    if (!media) {
      return this.copy.cameraUnavailable;
    }
    if (media.hasVideo && !media.hasImage) {
      return this.copy.videoUnavailable;
    }
    if (media.hasImage && !media.hasVideo) {
      return this.copy.imageUnavailable;
    }
    if (media.hasVideo) {
      return this.copy.videoUnavailable;
    }
    return this.copy.cameraUnavailable;
  }

  private teardownPlayback(): void {
    this.stopImageRefresh();
    this.imageEl.removeAttribute('src');
    this.imageEl.hidden = true;
    this.imageBufferEl.removeAttribute('src');
    this.imageBufferEl.hidden = true;
    this.unloadVideo();
    this.loadingEl.hidden = true;
    this.errorEl.hidden = true;
    this.retryButton.hidden = true;
    delete this.frame.dataset.state;
  }

  private unloadVideo(): void {
    if (typeof this.videoEl.pause === 'function') {
      this.videoEl.pause();
    }
    this.videoEl.removeAttribute('src');
    if (typeof this.videoEl.load === 'function') {
      this.videoEl.load();
    }
    this.videoEl.hidden = true;
  }

  private clearImageTimer(): void {
    if (this.imageTimer !== null) {
      clearTimeout(this.imageTimer);
      this.imageTimer = null;
    }
  }

  private clearVideoTimer(): void {
    if (this.videoTimer !== null) {
      clearTimeout(this.videoTimer);
      this.videoTimer = null;
    }
  }

  private createImageElement(buffer: boolean): HTMLImageElement {
    const image = document.createElement('img');
    image.className = buffer
      ? 'notification-media__image notification-media__image--buffer'
      : 'notification-media__image';
    image.alt = '';
    image.hidden = !buffer;
    image.setAttribute('draggable', 'false');
    if (buffer) {
      image.setAttribute('aria-hidden', 'true');
    }
    return image;
  }

  private startImageRefresh(): void {
    this.stopImageRefresh();
    if (
      this.imageRefreshMs <= 0 ||
      this.destroyed ||
      !this.activeNotificationId
    ) {
      return;
    }
    this.armImageRefresh(this.imageRefreshMs);
  }

  private stopImageRefresh(): void {
    if (this.imageRefreshTimer !== null) {
      clearTimeout(this.imageRefreshTimer);
      this.imageRefreshTimer = null;
    }
    this.imageRefreshInFlight = false;
  }

  private armImageRefresh(delayMs: number): void {
    if (
      this.imageRefreshMs <= 0 ||
      this.destroyed ||
      (this.state !== 'image' && this.state !== 'fallback-image')
    ) {
      return;
    }
    if (this.imageRefreshTimer !== null) {
      clearTimeout(this.imageRefreshTimer);
    }
    this.imageRefreshTimer = setTimeout(() => {
      this.imageRefreshTimer = null;
      this.refreshImageFrame();
    }, Math.max(0, delayMs));
  }

  private refreshImageFrame(): void {
    if (
      this.imageRefreshInFlight ||
      this.destroyed ||
      (this.state !== 'image' && this.state !== 'fallback-image')
    ) {
      return;
    }
    const id = this.activeNotificationId;
    if (!id) {
      return;
    }
    this.imageRefreshInFlight = true;
    this.imageRefreshStartedAt = Date.now();
    // Must stay in layout (not `hidden`) so the Wall Display WebView loads it.
    this.imageBufferEl.hidden = false;
    this.imageBufferEl.src = `${this.imageUrl(id)}?t=${Date.now()}`;
  }

  private commitRefreshedImage(): void {
    this.imageRefreshInFlight = false;
    if (this.state !== 'image' && this.state !== 'fallback-image') {
      return;
    }
    this.imageEl.hidden = true;
    this.imageBufferEl.hidden = false;
    const previous = this.imageEl;
    this.imageEl = this.imageBufferEl;
    this.imageBufferEl = previous;
    this.imageEl.className = 'notification-media__image';
    this.imageEl.hidden = false;
    this.imageEl.removeAttribute('aria-hidden');
    this.imageBufferEl.className =
      'notification-media__image notification-media__image--buffer';
    this.imageBufferEl.hidden = false;
    this.imageBufferEl.setAttribute('aria-hidden', 'true');
    const elapsed = Date.now() - this.imageRefreshStartedAt;
    this.armImageRefresh(this.imageRefreshMs - elapsed);
  }

  private syncCopy(): void {
    this.loadingEl.textContent = this.copy.loadingCamera;
    this.errorEl.textContent = this.copy.cameraUnavailable;
    this.retryButton.textContent = this.copy.retry;
    this.retryButton.setAttribute('aria-label', this.copy.retry);
  }
}
