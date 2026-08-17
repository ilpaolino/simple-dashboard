import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NotificationCenter } from '../frontend/notifications/NotificationCenter';
import { NotificationController } from '../frontend/notifications/NotificationController';
import { NotificationIndicator } from '../frontend/notifications/NotificationIndicator';
import { SwipeGestureRecognizer } from '../frontend/notifications/SwipeGestureRecognizer';
import { defaultDashboardUiCopy } from '../lib/dashboard/index';
import type { DisplayNotification } from '../lib/notifications/types';

class FakeElement {
  public children: FakeElement[] = [];
  public className = '';
  public hidden = false;
  public textContent = '';
  public innerHTML = '';
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  public disabled = false;
  public offsetWidth = 1;
  private attrs = new Map<string, string>();
  private listeners = new Map<string, Set<(event: unknown) => void>>();
  private captured: number | null = null;

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
  }

  public getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  public removeAttribute(name: string): void {
    this.attrs.delete(name);
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

  public dispatch(type: string, event: unknown): void {
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

  public setPointerCapture(id: number): void {
    this.captured = id;
  }

  public releasePointerCapture(): void {
    this.captured = null;
  }

  public hasPointerCapture(id: number): boolean {
    return this.captured === id;
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

describe('Notification UI', () => {
  it('shows corner ribbon only when notifications exist with max severity color', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      const indicator = new NotificationIndicator(
        controller,
        defaultDashboardUiCopy().notifications,
        body as unknown as HTMLElement,
      );

      const button = body.children[0] as FakeElement;
      assert.equal(button.hidden, true);
      assert.equal(
        (button.children[0] as FakeElement).className,
        'notification-indicator__ribbon',
      );

      controller.addNotification(
        note({ id: 'i', message: 'i', severity: 'info' }),
      );
      assert.equal(button.hidden, false);
      assert.equal(button.dataset.severity, 'info');

      controller.addNotification(
        note({ id: 'w', message: 'w', severity: 'warning', publishedAt: 2 }),
      );
      assert.equal(button.dataset.severity, 'warning');

      controller.addNotification(
        note({ id: 'c', message: 'c', severity: 'critical', publishedAt: 3 }),
      );
      assert.equal(button.dataset.severity, 'critical');

      controller.removeNotification('c');
      assert.equal(button.dataset.severity, 'warning');

      controller.applySnapshot([]);
      assert.equal(button.hidden, true);
      indicator.destroy();
    } finally {
      restore();
    }
  });

  it('renders plain text (no HTML) and applies highlight class', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      let dismissed: string | null = null;
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: (id) => {
          dismissed = id;
          controller.dismissLocal(id);
        },
        onAction: () => undefined,
      });

      controller.applySnapshot([
        note({
          id: 'html',
          title: '<b>Title</b>',
          message: '<img src=x onerror=alert(1)>',
          severity: 'critical',
          icon: 'error',
          highlight: true,
        }),
      ]);
      controller.openCenter();

      const root = body.children[0] as FakeElement;
      const dialog = root.querySelector('.notification-center__dialog');
      assert.ok(dialog);
      assert.equal(
        dialog!.classList.contains('notification-center__dialog--highlight'),
        true,
      );
      assert.equal(dialog!.dataset.severity, 'critical');

      const message = root.querySelector('.notification-center__message');
      assert.equal(message?.textContent, '<img src=x onerror=alert(1)>');

      const title = root.querySelector('.notification-center__title');
      assert.equal(title?.textContent, '<b>Title</b>');

      const hide = root.querySelector('.notification-center__hide');
      assert.equal(hide?.hidden, false);
      assert.equal(hide?.textContent, 'Hide');

      const dismiss = root.querySelector('.notification-center__dismiss');
      assert.equal(dismiss?.hidden, false);
      dismiss?.click();
      assert.equal(dismissed, 'html');

      center.destroy();
    } finally {
      restore();
    }
  });

  it('places icon, severity, and title in the header', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: () => undefined,
      });
      controller.applySnapshot([
        note({
          id: 'door',
          title: 'Front door',
          message: 'Someone is here',
          severity: 'warning',
          icon: 'bell',
        }),
      ]);
      controller.openCenter();
      const root = body.children[0] as FakeElement;
      const header = root.querySelector('.notification-center__header');
      assert.ok(header);
      assert.equal(
        header!.querySelector('.notification-center__severity')?.textContent,
        'Warning',
      );
      assert.equal(
        header!.querySelector('.notification-center__title')?.textContent,
        'Front door',
      );
      assert.equal(
        header!.querySelector('.notification-center__icon')?.hidden,
        false,
      );
      const panel = root.querySelector('.notification-center__body');
      assert.equal(panel?.querySelector('.notification-center__title'), null);
      assert.equal(
        panel?.querySelector('.notification-center__message')?.textContent,
        'Someone is here',
      );
      const content = root.querySelector('.notification-center__content');
      assert.ok(content);
      assert.ok(content!.querySelector('.notification-center__footer'));
      assert.ok(content!.querySelector('.notification-center__media'));
      assert.equal(
        root.querySelector('.notification-center__header')?.querySelector(
          '.notification-center__footer',
        ),
        null,
      );
      center.destroy();
    } finally {
      restore();
    }
  });

  it('hide closes the center but keeps the ribbon available', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      const indicator = new NotificationIndicator(
        controller,
        defaultDashboardUiCopy().notifications,
        body as unknown as HTMLElement,
      );
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: () => undefined,
      });

      controller.applySnapshot([
        note({ id: 'keep', message: 'keep me', severity: 'warning' }),
      ]);
      controller.openCenter();
      assert.equal(controller.isCenterOpen(), true);

      const centerRoot = body.children[1] as FakeElement;
      const hide = centerRoot.querySelector('.notification-center__hide');
      assert.equal(hide?.textContent, 'Hide');
      hide?.click();

      assert.equal(controller.isCenterOpen(), false);
      assert.equal(controller.getVisibleCount(), 1);
      const ribbon = body.children[0] as FakeElement;
      assert.equal(ribbon.hidden, false);
      assert.equal(ribbon.dataset.severity, 'warning');

      center.destroy();
      indicator.destroy();
    } finally {
      restore();
    }
  });

  it('hides carousel chrome when only one notification is visible', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: () => undefined,
      });
      controller.applySnapshot([
        note({ id: 'solo', message: 'only one', severity: 'info' }),
      ]);
      controller.openCenter();
      const root = body.children[0] as FakeElement;
      const footer = root.querySelector('.notification-center__footer');
      assert.equal(footer?.dataset.multi, 'false');
      assert.equal(
        root.querySelector('.notification-center__nav--prev')?.hidden,
        true,
      );
      assert.equal(
        root.querySelector('.notification-center__position')?.hidden,
        true,
      );
      center.destroy();
    } finally {
      restore();
    }
  });

  it('hides dismiss for non-dismissable notifications', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: () => undefined,
      });
      controller.applySnapshot([
        note({
          id: 'locked',
          message: 'locked',
          severity: 'info',
          dismissable: false,
        }),
      ]);
      controller.openCenter();
      const root = body.children[0] as FakeElement;
      const hide = root.querySelector('.notification-center__hide');
      const close = root.querySelector('.notification-center__close');
      const dismiss = root.querySelector('.notification-center__dismiss');
      const backdrop = root.querySelector('.notification-center__backdrop');
      assert.equal(hide?.hidden, true);
      assert.equal(close?.hidden, true);
      assert.equal(dismiss?.hidden, true);

      hide?.click();
      close?.click();
      backdrop?.dispatch('pointerdown', { target: backdrop });
      assert.equal(controller.isCenterOpen(), true);
      assert.equal(controller.getVisibleCount(), 1);

      center.destroy();
    } finally {
      restore();
    }
  });

  it('does not auto-close a non-dismissable notification', async () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: () => undefined,
      });
      controller.applySnapshot([
        note({
          id: 'alarm',
          message: 'Stay open',
          severity: 'critical',
          dismissable: false,
          autoCloseSeconds: 1,
        }),
      ]);
      controller.openCenter();
      center.scheduleAutoClose(1);
      assert.equal(center.hasActiveAutoCloseTimer(), false);
      assert.equal(controller.isCenterOpen(), true);
      center.destroy();
    } finally {
      restore();
    }
  });

  it('recognizes swipe left/right and ignores vertical / short / cancelled moves', () => {
    const el = new FakeElement();
    let left = 0;
    let right = 0;
    const swipe = new SwipeGestureRecognizer(el as unknown as HTMLElement, {
      onSwipeLeft: () => {
        left += 1;
      },
      onSwipeRight: () => {
        right += 1;
      },
    });

    el.dispatch('pointerdown', {
      button: 0,
      pointerType: 'touch',
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      target: el,
    });
    el.dispatch('pointerup', {
      pointerId: 1,
      clientX: 40,
      clientY: 105,
    });
    assert.equal(left, 1);

    el.dispatch('pointerdown', {
      button: 0,
      pointerType: 'touch',
      pointerId: 2,
      clientX: 100,
      clientY: 100,
      target: el,
    });
    el.dispatch('pointerup', {
      pointerId: 2,
      clientX: 160,
      clientY: 102,
    });
    assert.equal(right, 1);

    el.dispatch('pointerdown', {
      button: 0,
      pointerType: 'touch',
      pointerId: 3,
      clientX: 100,
      clientY: 100,
      target: el,
    });
    el.dispatch('pointerup', {
      pointerId: 3,
      clientX: 110,
      clientY: 100,
    });
    assert.equal(left + right, 2);

    el.dispatch('pointerdown', {
      button: 0,
      pointerType: 'touch',
      pointerId: 4,
      clientX: 100,
      clientY: 100,
      target: el,
    });
    el.dispatch('pointerup', {
      pointerId: 4,
      clientX: 40,
      clientY: 180,
    });
    assert.equal(left, 1);

    el.dispatch('pointerdown', {
      button: 0,
      pointerType: 'touch',
      pointerId: 5,
      clientX: 100,
      clientY: 100,
      target: el,
    });
    el.dispatch('pointercancel', { pointerId: 5 });
    el.dispatch('pointerup', {
      pointerId: 5,
      clientX: 20,
      clientY: 100,
    });
    assert.equal(left, 1);

    swipe.destroy();
  });
});

describe('M12 Notification Center action + auto-close', () => {
  it('renders action text and CTA only when action is present', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      const actions: string[] = [];
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: (input) => {
          actions.push(input.actionId);
        },
      });

      controller.applySnapshot([
        note({
          id: 'with-action',
          message: 'Ring',
          severity: 'warning',
          action: {
            actionId: 'open-gate',
            label: 'Open gate',
            text: 'Press to open the pedestrian gate',
          },
        }),
      ]);
      controller.openCenter();

      const root = body.children[0] as FakeElement;
      const actionText = root.querySelector('.notification-center__action-text');
      const actionBtn = root.querySelector('.notification-center__action');
      assert.equal(actionText?.hidden, false);
      assert.equal(
        actionText?.textContent,
        'Press to open the pedestrian gate',
      );
      assert.equal(actionBtn?.hidden, false);
      assert.equal(actionBtn?.textContent, 'Open gate');

      actionBtn?.click();
      assert.deepEqual(actions, ['open-gate']);
      assert.equal(actionBtn?.disabled, true);

      center.destroy();
    } finally {
      restore();
    }
  });

  it('hides action UI when notification has no action', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: () => undefined,
      });
      controller.applySnapshot([
        note({ id: 'plain', message: 'No CTA', severity: 'info' }),
      ]);
      controller.openCenter();
      const root = body.children[0] as FakeElement;
      assert.equal(
        root.querySelector('.notification-center__action')?.hidden,
        true,
      );
      assert.equal(
        root.querySelector('.notification-center__action-text')?.hidden,
        true,
      );
      center.destroy();
    } finally {
      restore();
    }
  });

  it('schedules and cancels auto-close timer without orphan timers', async () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      let autoClosed = 0;
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: () => undefined,
        onAutoClosed: () => {
          autoClosed += 1;
        },
      });
      controller.applySnapshot([
        note({
          id: 'timed',
          message: 'Auto',
          severity: 'info',
          autoCloseSeconds: 1,
        }),
      ]);
      controller.openCenter();
      center.scheduleAutoClose(1);
      assert.equal(center.hasActiveAutoCloseTimer(), true);
      center.cancelAutoClose('user-interaction');
      assert.equal(center.hasActiveAutoCloseTimer(), false);
      assert.equal(controller.isCenterOpen(), true);

      center.scheduleAutoClose(0.05);
      await new Promise((resolve) => setTimeout(resolve, 80));
      assert.equal(controller.isCenterOpen(), false);
      assert.equal(autoClosed, 1);
      assert.equal(center.hasActiveAutoCloseTimer(), false);
      center.destroy();
    } finally {
      restore();
    }
  });

  it('shows remaining auto-close time and hides it when cancelled', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const controller = new NotificationController();
      const center = new NotificationCenter({
        controller,
        copy: defaultDashboardUiCopy().notifications,
        parent: body as unknown as HTMLElement,
        onDismiss: () => undefined,
        onAction: () => undefined,
      });
      controller.applySnapshot([
        note({
          id: 'timed',
          message: 'Auto',
          severity: 'info',
          autoCloseSeconds: 60,
        }),
      ]);
      controller.openCenter();
      const root = body.children[0] as FakeElement;
      const countdown = root.querySelector('.notification-center__countdown');
      assert.equal(countdown?.hidden, true);

      center.scheduleAutoClose(60);
      assert.equal(countdown?.hidden, false);
      assert.equal(countdown?.textContent, '60s');

      center.cancelAutoClose('user-interaction');
      assert.equal(countdown?.hidden, true);
      assert.equal(countdown?.textContent, '');
      center.destroy();
    } finally {
      restore();
    }
  });
});
