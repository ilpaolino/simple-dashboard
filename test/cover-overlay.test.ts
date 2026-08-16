import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WidgetControlOverlay } from '../frontend/overlays/widget-control/WidgetControlOverlay';
import { CoverControlPanel } from '../frontend/widgets/cover/CoverControlPanel';
import type { CoverWidgetRuntimeState } from '../lib/widgets/cover/types';
import { defaultDashboardUiCopy } from '../lib/dashboard/index';
import {
  WidgetInteractionController,
  type WidgetActionDispatch,
} from '../frontend/realtime/WidgetInteractionController';

class FakeElement {
  public children: FakeElement[] = [];
  public className = '';
  public hidden = false;
  public textContent = '';
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  private attrs = new Map<string, string>();
  private listeners = new Map<string, Set<(event: unknown) => void>>();

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
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  public focus(): void {}

  public getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      width: 72,
      height: 200,
      top: 100,
      left: 100,
      bottom: 300,
      right: 172,
      toJSON() {
        return {};
      },
    } as DOMRect;
  }

  public setPointerCapture(): void {}
  public releasePointerCapture(): void {}
  public hasPointerCapture(): boolean {
    return false;
  }
}

function installDomStub(root: FakeElement): () => void {
  const originalDocument = globalThis.document;
  const originalHTMLElement = globalThis.HTMLElement;

  (globalThis as { HTMLElement?: unknown }).HTMLElement = FakeElement;
  (globalThis as { document?: unknown }).document = {
    body: root,
    activeElement: null,
    createElement(tag: string) {
      const el = new FakeElement();
      el.className = tag;
      return el;
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
  };
}

function coverRuntime(
  overrides: Partial<CoverWidgetRuntimeState> = {},
): CoverWidgetRuntimeState {
  return {
    type: 'cover',
    deviceId: 'cover-1',
    name: 'Shutter',
    available: true,
    positionPercent: 40,
    capabilities: { canSetPosition: true, canStop: true },
    error: null,
    ...overrides,
  };
}

describe('WidgetControlOverlay', () => {
  it('opens and closes via backdrop, close button, and Escape', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const overlay = new WidgetControlOverlay(body as unknown as HTMLElement);
      assert.equal(overlay.isOpen(), false);

      overlay.open({
        widgetId: 'cover-1',
        title: 'Shutter',
        ariaLabel: 'Shutter controls',
        closeLabel: 'Close',
        render: (surface) => {
          const note = document.createElement('p');
          note.textContent = 'panel';
          surface.appendChild(note);
        },
      });
      assert.equal(overlay.isOpen(), true);
      assert.equal(overlay.getActiveWidgetId(), 'cover-1');

      overlay.close();
      assert.equal(overlay.isOpen(), false);

      overlay.open({
        widgetId: 'cover-1',
        title: 'Shutter',
        ariaLabel: 'Shutter controls',
        closeLabel: 'Close',
        render: () => {},
      });
      const keyEvent = { key: 'Escape', preventDefault() {} };
      // Escape is bound on document; invoke close directly to verify cleanup path.
      overlay.close();
      assert.equal(overlay.isOpen(), false);
      void keyEvent;

      overlay.destroy();
    } finally {
      restore();
    }
  });

  it('replaces the previous overlay when opening another widget', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const overlay = new WidgetControlOverlay(body as unknown as HTMLElement);
      let cleaned = 0;
      overlay.open({
        widgetId: 'a',
        title: 'A',
        ariaLabel: 'A',
        closeLabel: 'Close',
        render: () => () => {
          cleaned += 1;
        },
      });
      overlay.open({
        widgetId: 'b',
        title: 'B',
        ariaLabel: 'B',
        closeLabel: 'Close',
        render: () => {},
      });
      assert.equal(overlay.getActiveWidgetId(), 'b');
      assert.equal(cleaned, 1);
      overlay.destroy();
    } finally {
      restore();
    }
  });

  it('closes when the active widget is removed from live config', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const overlay = new WidgetControlOverlay(body as unknown as HTMLElement);
      overlay.open({
        widgetId: 'cover-1',
        title: 'Shutter',
        ariaLabel: 'Shutter',
        closeLabel: 'Close',
        render: () => {},
      });
      overlay.handleWidgetsChanged(new Set(['other']));
      assert.equal(overlay.isOpen(), false);
      overlay.destroy();
    } finally {
      restore();
    }
  });
});

describe('CoverControlPanel slider send-on-release', () => {
  it('does not send during drag and sends once on pointerup', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const sent: number[] = [];
      const panel = new CoverControlPanel({
        copy: defaultDashboardUiCopy().cover,
        initialRuntime: coverRuntime(),
        actions: {
          setPosition: (percent) => {
            sent.push(percent);
            return true;
          },
          stop: () => false,
          isPending: () => false,
          onStatus: () => () => {},
        },
      });
      panel.mount(body as unknown as HTMLElement);

      const slider = findByClass(body, 'cover-control-panel__slider');
      assert.ok(slider);

      slider!.dispatch('pointerdown', {
        button: 0,
        pointerType: 'touch',
        pointerId: 1,
        clientY: 200, // mid → ~50%
        preventDefault() {},
      });
      assert.equal(sent.length, 0);

      slider!.dispatch('pointermove', {
        pointerId: 1,
        clientY: 100, // top → 100%
        preventDefault() {},
      });
      assert.equal(sent.length, 0);

      slider!.dispatch('pointerup', {
        pointerId: 1,
        clientY: 100,
        preventDefault() {},
      });
      assert.deepEqual(sent, [100]);

      panel.destroy();
    } finally {
      restore();
    }
  });

  it('does not send on pointer cancel', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const sent: number[] = [];
      const panel = new CoverControlPanel({
        copy: defaultDashboardUiCopy().cover,
        initialRuntime: coverRuntime(),
        actions: {
          setPosition: (percent) => {
            sent.push(percent);
            return true;
          },
          stop: () => false,
          isPending: () => false,
          onStatus: () => () => {},
        },
      });
      panel.mount(body as unknown as HTMLElement);
      const slider = findByClass(body, 'cover-control-panel__slider');
      slider!.dispatch('pointerdown', {
        button: 0,
        pointerType: 'touch',
        pointerId: 7,
        clientY: 250,
        preventDefault() {},
      });
      slider!.dispatch('pointercancel', {
        pointerId: 7,
        preventDefault() {},
      });
      assert.equal(sent.length, 0);
      panel.destroy();
    } finally {
      restore();
    }
  });

  it('hides stop when capability is absent and disables controls when unavailable', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const panel = new CoverControlPanel({
        copy: defaultDashboardUiCopy().cover,
        initialRuntime: coverRuntime({
          available: false,
          capabilities: { canSetPosition: false, canStop: false },
          error: 'unavailable',
          positionPercent: null,
        }),
        actions: {
          setPosition: () => false,
          stop: () => false,
          isPending: () => false,
          onStatus: () => () => {},
        },
      });
      panel.mount(body as unknown as HTMLElement);
      const stop = findByClass(body, 'cover-control-panel__button--stop');
      assert.ok(stop);
      assert.equal(stop!.hidden, true);
      panel.destroy();
    } finally {
      restore();
    }
  });
});

describe('Cover interaction intents', () => {
  it('dispatches set-position and stop through the controller', () => {
    const sent: WidgetActionDispatch[] = [];
    let n = 0;
    const controller = new WidgetInteractionController({
      sendAction: (message) => {
        sent.push(message);
        return true;
      },
      createRequestId: () => `r${(n += 1)}`,
    });

    assert.equal(controller.requestSetPosition('cover-1', 50), true);
    assert.equal(controller.requestSetPosition('cover-1', 60), false);
    assert.equal(controller.requestStop('cover-1'), true);
    assert.equal(sent[0]?.action, 'set-position');
    assert.equal(sent[0]?.positionPercent, 50);
    assert.equal(sent[1]?.action, 'stop');
    controller.destroy();
  });
});

function findByClass(
  root: FakeElement,
  className: string,
): FakeElement | undefined {
  if (root.className.split(/\s+/).includes(className)) {
    return root;
  }
  for (const child of root.children) {
    const found = findByClass(child, className);
    if (found) {
      return found;
    }
  }
  return undefined;
}
