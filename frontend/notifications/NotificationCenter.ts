/**
 * Global Notification Center modal — carousel, one notification at a time.
 * Conceptually separate from WidgetControlOverlay; shares overlay UX patterns.
 */

import type { DisplayNotification } from '../../lib/notifications/types';
import type { NotificationController } from './NotificationController';
import { createNotificationIconElement } from './notificationIcons';
import { SwipeGestureRecognizer } from './SwipeGestureRecognizer';

export interface NotificationCenterCopy {
  readonly title: string;
  readonly close: string;
  readonly hide: string;
  readonly dismiss: string;
  readonly previous: string;
  readonly next: string;
  readonly noNotifications: string;
  readonly severityCritical: string;
  readonly severityWarning: string;
  readonly severitySuccess: string;
  readonly severityInfo: string;
  readonly position: string;
}

export interface NotificationCenterOptions {
  readonly controller: NotificationController;
  readonly copy: NotificationCenterCopy;
  readonly onDismiss: (notificationId: string) => void;
  readonly onOpened?: () => void;
  readonly parent?: HTMLElement;
}

export class NotificationCenter {
  private readonly root: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly header: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly body: HTMLElement;
  private readonly severityEl: HTMLElement;
  private readonly iconSlot: HTMLElement;
  private readonly notificationTitle: HTMLElement;
  private readonly messageEl: HTMLElement;
  private readonly footer: HTMLElement;
  private readonly positionEl: HTMLElement;
  private readonly prevButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly hideButton: HTMLButtonElement;
  private readonly dismissButton: HTMLButtonElement;

  private readonly controller: NotificationController;
  private copy: NotificationCenterCopy;
  private readonly onDismiss: (notificationId: string) => void;
  private readonly onOpened: (() => void) | null;
  private readonly unsubscribe: () => void;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private swipe: SwipeGestureRecognizer | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private wasOpen = false;

  public constructor(options: NotificationCenterOptions) {
    this.controller = options.controller;
    this.copy = options.copy;
    this.onDismiss = options.onDismiss;
    this.onOpened = options.onOpened ?? null;

    this.root = document.createElement('div');
    this.root.className = 'notification-center';
    this.root.hidden = true;
    this.root.setAttribute('aria-hidden', 'true');

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'notification-center__backdrop';

    this.dialog = document.createElement('div');
    this.dialog.className = 'notification-center__dialog';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');

    this.header = document.createElement('div');
    this.header.className = 'notification-center__header';

    this.titleEl = document.createElement('h2');
    this.titleEl.className = 'notification-center__heading';
    this.titleEl.id = 'notification-center-title';

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'notification-center__close';

    this.body = document.createElement('div');
    this.body.className = 'notification-center__body';

    this.severityEl = document.createElement('p');
    this.severityEl.className = 'notification-center__severity';

    this.iconSlot = document.createElement('div');
    this.iconSlot.className = 'notification-center__icon';
    this.iconSlot.hidden = true;

    this.notificationTitle = document.createElement('h3');
    this.notificationTitle.className = 'notification-center__title';
    this.notificationTitle.hidden = true;

    this.messageEl = document.createElement('div');
    this.messageEl.className = 'notification-center__message';

    this.footer = document.createElement('div');
    this.footer.className = 'notification-center__footer';

    this.prevButton = document.createElement('button');
    this.prevButton.type = 'button';
    this.prevButton.className =
      'notification-center__nav notification-center__nav--prev';

    this.positionEl = document.createElement('p');
    this.positionEl.className = 'notification-center__position';

    this.nextButton = document.createElement('button');
    this.nextButton.type = 'button';
    this.nextButton.className =
      'notification-center__nav notification-center__nav--next';

    this.hideButton = document.createElement('button');
    this.hideButton.type = 'button';
    this.hideButton.className = 'notification-center__hide';

    this.dismissButton = document.createElement('button');
    this.dismissButton.type = 'button';
    this.dismissButton.className = 'notification-center__dismiss';

    this.header.appendChild(this.titleEl);
    this.header.appendChild(this.closeButton);

    this.body.appendChild(this.severityEl);
    this.body.appendChild(this.iconSlot);
    this.body.appendChild(this.notificationTitle);
    this.body.appendChild(this.messageEl);

    this.footer.appendChild(this.prevButton);
    this.footer.appendChild(this.positionEl);
    this.footer.appendChild(this.nextButton);
    this.footer.appendChild(this.hideButton);
    this.footer.appendChild(this.dismissButton);

    this.dialog.appendChild(this.header);
    this.dialog.appendChild(this.body);
    this.dialog.appendChild(this.footer);
    this.dialog.setAttribute('aria-labelledby', 'notification-center-title');

    this.root.appendChild(this.backdrop);
    this.root.appendChild(this.dialog);
    (options.parent ?? document.body).appendChild(this.root);

    this.onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && this.controller.isCenterOpen()) {
        event.preventDefault();
        this.controller.closeCenter();
      }
    };

    this.backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === this.backdrop) {
        this.controller.closeCenter();
      }
    });
    this.closeButton.addEventListener('click', () => {
      this.controller.closeCenter();
    });
    this.prevButton.addEventListener('click', () => {
      this.controller.goPrevious();
    });
    this.nextButton.addEventListener('click', () => {
      this.controller.goNext();
    });
    this.hideButton.addEventListener('click', () => {
      // Hide the modal only — ribbon stays so the user can reopen.
      this.controller.closeCenter();
    });
    this.dismissButton.addEventListener('click', () => {
      const current = this.controller.getCurrent();
      if (current && current.dismissable) {
        this.onDismiss(current.id);
      }
    });

    this.swipe = new SwipeGestureRecognizer(this.body, {
      onSwipeLeft: () => {
        this.controller.goNext();
      },
      onSwipeRight: () => {
        this.controller.goPrevious();
      },
    });

    this.unsubscribe = this.controller.subscribe(() => {
      this.sync();
    });
    this.sync();
  }

  public setCopy(copy: NotificationCenterCopy): void {
    this.copy = copy;
    this.sync();
  }

  public destroy(): void {
    this.unsubscribe();
    this.swipe?.destroy();
    this.swipe = null;
    document.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private sync(): void {
    const open = this.controller.isCenterOpen();
    const current = this.controller.getCurrent();

    this.titleEl.textContent = this.copy.title;
    this.closeButton.setAttribute('aria-label', this.copy.close);
    this.closeButton.textContent = '×';
    this.prevButton.setAttribute('aria-label', this.copy.previous);
    this.prevButton.textContent = '‹';
    this.nextButton.setAttribute('aria-label', this.copy.next);
    this.nextButton.textContent = '›';
    this.hideButton.textContent = this.copy.hide;
    this.dismissButton.textContent = this.copy.dismiss;

    if (!open || !current) {
      if (this.wasOpen) {
        document.removeEventListener('keydown', this.onKeyDown);
        const restore = this.previouslyFocused;
        this.previouslyFocused = null;
        if (restore && document.contains(restore)) {
          restore.focus();
        }
      }
      this.wasOpen = false;
      this.root.hidden = true;
      this.root.setAttribute('aria-hidden', 'true');
      this.clearHighlight();
      return;
    }

    if (!this.wasOpen) {
      this.previouslyFocused =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      document.addEventListener('keydown', this.onKeyDown);
      this.onOpened?.();
      this.closeButton.focus();
    }
    this.wasOpen = true;

    this.root.hidden = false;
    this.root.setAttribute('aria-hidden', 'false');
    this.renderNotification(current);
  }

  private renderNotification(notification: DisplayNotification): void {
    this.dialog.dataset.severity = notification.severity;
    if (notification.highlight) {
      this.dialog.classList.add('notification-center__dialog--highlight');
    } else {
      this.dialog.classList.remove('notification-center__dialog--highlight');
    }

    this.severityEl.textContent = this.severityLabel(notification.severity);
    this.severityEl.dataset.severity = notification.severity;

    this.iconSlot.replaceChildren();
    if (notification.icon) {
      this.iconSlot.hidden = false;
      this.iconSlot.appendChild(createNotificationIconElement(notification.icon));
    } else {
      this.iconSlot.hidden = true;
    }

    if (notification.title) {
      this.notificationTitle.hidden = false;
      this.notificationTitle.textContent = notification.title;
    } else {
      this.notificationTitle.hidden = true;
      this.notificationTitle.textContent = '';
    }

    // Plain text only — never interpret HTML.
    this.messageEl.textContent = notification.message;

    const total = this.controller.getVisibleCount();
    const index = this.controller.getCurrentIndex() + 1;
    const multi = total > 1;

    this.positionEl.textContent = this.copy.position
      .replace('{current}', String(index))
      .replace('{total}', String(total));
    this.positionEl.hidden = !multi;

    this.prevButton.disabled = !this.controller.canGoPrevious();
    this.nextButton.disabled = !this.controller.canGoNext();
    this.prevButton.hidden = !multi;
    this.nextButton.hidden = !multi;

    // Primary dismiss-of-UI is the × / backdrop; footer hide stays as soft CTA.
    this.hideButton.hidden = false;
    if (notification.dismissable) {
      this.dismissButton.hidden = false;
    } else {
      this.dismissButton.hidden = true;
    }

    this.footer.dataset.multi = multi ? 'true' : 'false';
    this.footer.dataset.dismissable = notification.dismissable ? 'true' : 'false';

    const viewportHeight =
      typeof globalThis.window !== 'undefined'
        ? globalThis.window.innerHeight
        : 800;
    const viewportWidth =
      typeof globalThis.window !== 'undefined'
        ? globalThis.window.innerWidth
        : 480;
    this.dialog.style.maxHeight = `${Math.round(Math.min(viewportHeight * 0.9, 640))}px`;
    this.dialog.style.width = `${Math.round(Math.min(viewportWidth * 0.92, 440))}px`;
  }

  private clearHighlight(): void {
    this.dialog.classList.remove('notification-center__dialog--highlight');
    delete this.dialog.dataset.severity;
  }

  private severityLabel(
    severity: DisplayNotification['severity'],
  ): string {
    switch (severity) {
      case 'critical':
        return this.copy.severityCritical;
      case 'warning':
        return this.copy.severityWarning;
      case 'success':
        return this.copy.severitySuccess;
      case 'info':
        return this.copy.severityInfo;
      default:
        return severity;
    }
  }
}
