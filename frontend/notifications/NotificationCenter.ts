/**
 * Global Notification Center modal — carousel, one notification at a time.
 * Conceptually separate from WidgetControlOverlay; shares overlay UX patterns.
 *
 * Auto-close is presentation-only (never removes/dismisses).
 * At most one semantic action CTA per notification.
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
  readonly actionSent: string;
  readonly actionFailed: string;
  readonly autoCloseHint: string;
}

export interface NotificationCenterOptions {
  readonly controller: NotificationController;
  readonly copy: NotificationCenterCopy;
  readonly onDismiss: (notificationId: string) => void;
  readonly onAction: (input: {
    readonly notificationId: string;
    readonly notificationKey: string;
    readonly actionId: string;
  }) => void;
  readonly onOpened?: () => void;
  readonly onAutoClosed?: () => void;
  readonly parent?: HTMLElement;
}

export class NotificationCenter {
  private readonly root: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly header: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly autoCloseTrack: HTMLElement;
  private readonly autoCloseBar: HTMLElement;
  private readonly body: HTMLElement;
  private readonly severityEl: HTMLElement;
  private readonly iconSlot: HTMLElement;
  private readonly notificationTitle: HTMLElement;
  private readonly messageEl: HTMLElement;
  private readonly actionTextEl: HTMLElement;
  private readonly actionFeedbackEl: HTMLElement;
  private readonly footer: HTMLElement;
  private readonly positionEl: HTMLElement;
  private readonly prevButton: HTMLButtonElement;
  private readonly nextButton: HTMLButtonElement;
  private readonly actionButton: HTMLButtonElement;
  private readonly hideButton: HTMLButtonElement;
  private readonly dismissButton: HTMLButtonElement;

  private readonly controller: NotificationController;
  private copy: NotificationCenterCopy;
  private readonly onDismiss: (notificationId: string) => void;
  private readonly onAction: NotificationCenterOptions['onAction'];
  private readonly onOpened: (() => void) | null;
  private readonly onAutoClosed: (() => void) | null;
  private readonly unsubscribe: () => void;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private swipe: SwipeGestureRecognizer | null = null;
  private previouslyFocused: HTMLElement | null = null;
  private wasOpen = false;
  private renderedNotificationId: string | null = null;
  private autoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private autoCloseActive = false;
  private actionPending = false;
  private actionFeedbackTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor(options: NotificationCenterOptions) {
    this.controller = options.controller;
    this.copy = options.copy;
    this.onDismiss = options.onDismiss;
    this.onAction = options.onAction;
    this.onOpened = options.onOpened ?? null;
    this.onAutoClosed = options.onAutoClosed ?? null;

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
    this.dialog.tabIndex = -1;

    this.header = document.createElement('div');
    this.header.className = 'notification-center__header';

    this.titleEl = document.createElement('h2');
    this.titleEl.className = 'notification-center__heading';
    this.titleEl.id = 'notification-center-title';

    this.closeButton = document.createElement('button');
    this.closeButton.type = 'button';
    this.closeButton.className = 'notification-center__close';

    this.autoCloseTrack = document.createElement('div');
    this.autoCloseTrack.className = 'notification-center__auto-close';
    this.autoCloseTrack.hidden = true;
    this.autoCloseTrack.setAttribute('aria-hidden', 'true');

    this.autoCloseBar = document.createElement('div');
    this.autoCloseBar.className = 'notification-center__auto-close-bar';
    this.autoCloseTrack.appendChild(this.autoCloseBar);

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

    this.actionTextEl = document.createElement('p');
    this.actionTextEl.className = 'notification-center__action-text';
    this.actionTextEl.hidden = true;

    this.actionFeedbackEl = document.createElement('p');
    this.actionFeedbackEl.className = 'notification-center__action-feedback';
    this.actionFeedbackEl.hidden = true;

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

    this.actionButton = document.createElement('button');
    this.actionButton.type = 'button';
    this.actionButton.className = 'notification-center__action';
    this.actionButton.hidden = true;

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
    this.body.appendChild(this.actionTextEl);
    this.body.appendChild(this.actionFeedbackEl);

    this.footer.appendChild(this.prevButton);
    this.footer.appendChild(this.positionEl);
    this.footer.appendChild(this.nextButton);
    this.footer.appendChild(this.actionButton);
    this.footer.appendChild(this.hideButton);
    this.footer.appendChild(this.dismissButton);

    this.dialog.appendChild(this.autoCloseTrack);
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
        this.requestClose();
      }
    };

    this.backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === this.backdrop) {
        this.requestClose();
      }
    });
    this.closeButton.addEventListener('click', () => {
      this.requestClose();
    });
    this.prevButton.addEventListener('click', () => {
      this.cancelAutoClose('user-interaction');
      this.controller.goPrevious();
    });
    this.nextButton.addEventListener('click', () => {
      this.cancelAutoClose('user-interaction');
      this.controller.goNext();
    });
    this.hideButton.addEventListener('click', () => {
      this.requestClose();
    });
    this.dismissButton.addEventListener('click', () => {
      const current = this.controller.getCurrent();
      if (current && current.dismissable) {
        this.cancelAutoClose('dismiss');
        this.onDismiss(current.id);
      }
    });
    this.actionButton.addEventListener('click', () => {
      this.handleActionPress();
    });
    this.body.addEventListener(
      'scroll',
      () => {
        if (this.autoCloseActive) {
          this.cancelAutoClose('user-interaction');
        }
      },
      { passive: true },
    );

    this.swipe = new SwipeGestureRecognizer(this.body, {
      onSwipeLeft: () => {
        this.cancelAutoClose('user-interaction');
        this.controller.goNext();
      },
      onSwipeRight: () => {
        this.cancelAutoClose('user-interaction');
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

  /**
   * Start presentation auto-close for the current notification.
   * Only call after an auto-open (not manual ribbon open).
   */
  public scheduleAutoClose(seconds: number): void {
    this.cancelAutoClose('reschedule');
    if (
      !(seconds > 0) ||
      !this.controller.isCenterOpen() ||
      !this.canManuallyClose()
    ) {
      return;
    }

    this.autoCloseActive = true;
    this.autoCloseTrack.hidden = false;
    this.autoCloseTrack.setAttribute('aria-label', this.copy.autoCloseHint);
    this.autoCloseBar.style.animationDuration = `${seconds}s`;
    this.autoCloseBar.classList.remove(
      'notification-center__auto-close-bar--running',
    );
    // Force reflow so restarting the CSS animation is reliable.
    void this.autoCloseBar.offsetWidth;
    this.autoCloseBar.classList.add(
      'notification-center__auto-close-bar--running',
    );

    this.autoCloseTimer = setTimeout(() => {
      this.autoCloseTimer = null;
      this.autoCloseActive = false;
      this.clearAutoCloseVisual();
      if (this.controller.isCenterOpen()) {
        this.controller.closeCenter();
        this.onAutoClosed?.();
      }
    }, seconds * 1000);
  }

  public cancelAutoClose(_reason?: string): void {
    if (this.autoCloseTimer !== null) {
      clearTimeout(this.autoCloseTimer);
      this.autoCloseTimer = null;
    }
    this.autoCloseActive = false;
    this.clearAutoCloseVisual();
  }

  public hasActiveAutoCloseTimer(): boolean {
    return this.autoCloseTimer !== null;
  }

  public setActionPending(pending: boolean): void {
    this.actionPending = pending;
    this.actionButton.disabled = pending;
  }

  public showActionFeedback(kind: 'sent' | 'failed'): void {
    if (this.actionFeedbackTimer !== null) {
      clearTimeout(this.actionFeedbackTimer);
      this.actionFeedbackTimer = null;
    }
    this.actionFeedbackEl.hidden = false;
    this.actionFeedbackEl.dataset.kind = kind;
    this.actionFeedbackEl.textContent =
      kind === 'sent' ? this.copy.actionSent : this.copy.actionFailed;
    this.actionFeedbackTimer = setTimeout(() => {
      this.actionFeedbackTimer = null;
      this.actionFeedbackEl.hidden = true;
      this.actionFeedbackEl.textContent = '';
      delete this.actionFeedbackEl.dataset.kind;
    }, 2500);
  }

  public destroy(): void {
    this.cancelAutoClose('destroy');
    if (this.actionFeedbackTimer !== null) {
      clearTimeout(this.actionFeedbackTimer);
      this.actionFeedbackTimer = null;
    }
    this.unsubscribe();
    this.swipe?.destroy();
    this.swipe = null;
    document.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private handleActionPress(): void {
    if (this.actionPending) {
      return;
    }
    const current = this.controller.getCurrent();
    if (!current?.action) {
      return;
    }
    this.cancelAutoClose('user-interaction');
    this.setActionPending(true);
    this.onAction({
      notificationId: current.id,
      notificationKey: current.notificationKey ?? '',
      actionId: current.action.actionId,
    });
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
      this.renderedNotificationId = null;
      this.cancelAutoClose('closed');
      this.setActionPending(false);
      this.root.hidden = true;
      this.root.setAttribute('aria-hidden', 'true');
      this.clearHighlight();
      return;
    }

    const justOpened = !this.wasOpen;
    if (justOpened) {
      this.previouslyFocused =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      document.addEventListener('keydown', this.onKeyDown);
      this.onOpened?.();
    }
    this.wasOpen = true;

    this.root.hidden = false;
    this.root.setAttribute('aria-hidden', 'false');

    if (this.renderedNotificationId !== current.id) {
      // Carousel / content change must not inherit another notification's timer.
      if (this.renderedNotificationId !== null) {
        this.cancelAutoClose('carousel-change');
      }
      this.renderedNotificationId = current.id;
      this.setActionPending(false);
    }

    this.renderNotification(current);
    if (justOpened) {
      this.focusInitialControl();
    }
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

    if (notification.action?.text) {
      this.actionTextEl.hidden = false;
      this.actionTextEl.textContent = notification.action.text;
    } else {
      this.actionTextEl.hidden = true;
      this.actionTextEl.textContent = '';
    }

    if (notification.action) {
      this.actionButton.hidden = false;
      this.actionButton.textContent = notification.action.label;
      this.actionButton.disabled = this.actionPending;
    } else {
      this.actionButton.hidden = true;
      this.actionButton.textContent = '';
      this.actionButton.disabled = false;
    }

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

    this.closeButton.hidden = !notification.dismissable;
    this.hideButton.hidden = !notification.dismissable;
    this.dismissButton.hidden = !notification.dismissable;

    this.footer.dataset.multi = multi ? 'true' : 'false';
    this.footer.dataset.dismissable = notification.dismissable ? 'true' : 'false';
    this.footer.dataset.hasAction = notification.action ? 'true' : 'false';

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

  private clearAutoCloseVisual(): void {
    this.autoCloseTrack.hidden = true;
    this.autoCloseBar.classList.remove(
      'notification-center__auto-close-bar--running',
    );
    this.autoCloseBar.style.animationDuration = '';
  }

  /**
   * dismissable=false is blocking: Hide, X, backdrop, Escape, and auto-close
   * must not put the Center away. Homey remove / empty list still closes it.
   */
  private canManuallyClose(): boolean {
    return this.controller.getCurrent()?.dismissable === true;
  }

  private requestClose(): void {
    if (!this.canManuallyClose()) {
      return;
    }
    this.cancelAutoClose('manual-close');
    this.controller.closeCenter();
  }

  private focusInitialControl(): void {
    const current = this.controller.getCurrent();
    if (current?.dismissable === false) {
      if (current.action) {
        this.actionButton.focus();
        return;
      }
      this.dialog.focus();
      return;
    }
    this.closeButton.focus();
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
