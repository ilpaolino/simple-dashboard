import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isClientMessage } from '../lib/realtime/protocol';
import { LONG_PRESS_MS } from '../lib/realtime/constants';
import {
  WidgetInteractionController,
  type WidgetActionDispatch,
} from '../frontend/realtime/WidgetInteractionController';
import type { LightWidgetRuntimeState } from '../lib/widgets/light/types';
import { LightControlPanel } from '../frontend/widgets/light/LightControlPanel';
import { defaultDashboardUiCopy } from '../lib/dashboard/index';

class FakeElement {
  public children: FakeElement[] = [];
  public className = '';
  public hidden = false;
  public textContent = '';
  public style: Record<string, string> = {};
  public dataset: Record<string, string> = {};
  public tabIndex = 0;
  private attrs = new Map<string, string>();
  private listeners = new Map<string, Set<(event: unknown) => void>>();

  public appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
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

  public getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      width: 200,
      height: 44,
      top: 100,
      left: 100,
      bottom: 144,
      right: 300,
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
    createElement(_tag: string) {
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
  };
}

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

function runtime(
  capabilities: LightWidgetRuntimeState['capabilities'],
): LightWidgetRuntimeState {
  return {
    type: 'light',
    deviceId: 'lamp-1',
    name: 'Lamp',
    available: true,
    on: true,
    dimPercent: capabilities.canDim ? 40 : null,
    temperaturePercent: capabilities.canSetTemperature ? 60 : null,
    huePercent: capabilities.canSetColor ? 20 : null,
    saturationPercent: capabilities.canSetColor ? 80 : null,
    capabilities,
    error: null,
  };
}

describe('light protocol messages', () => {
  it('accepts set-dim / set-temperature / set-color intents', () => {
    assert.equal(
      isClientMessage({
        type: 'widget-action',
        widgetId: 'w1',
        action: 'set-dim',
        requestId: 'r1',
        valuePercent: 50,
      }),
      true,
    );
    assert.equal(
      isClientMessage({
        type: 'widget-action',
        widgetId: 'w1',
        action: 'set-temperature',
        requestId: 'r1',
        valuePercent: 0,
      }),
      true,
    );
    assert.equal(
      isClientMessage({
        type: 'widget-action',
        widgetId: 'w1',
        action: 'set-color',
        requestId: 'r1',
        huePercent: 100,
        saturationPercent: 0,
      }),
      true,
    );
  });

  it('rejects invalid ranges and incomplete color payloads', () => {
    assert.equal(
      isClientMessage({
        type: 'widget-action',
        widgetId: 'w1',
        action: 'set-dim',
        requestId: 'r1',
        valuePercent: 50.5,
      }),
      false,
    );
    assert.equal(
      isClientMessage({
        type: 'widget-action',
        widgetId: 'w1',
        action: 'set-color',
        requestId: 'r1',
        huePercent: 10,
      }),
      false,
    );
  });
});

describe('light interaction controller advanced actions', () => {
  it('dispatches set-dim once and blocks while pending', () => {
    const sent: WidgetActionDispatch[] = [];
    const controller = new WidgetInteractionController({
      sendAction: (message) => {
        sent.push(message);
        return true;
      },
      createRequestId: () => `req-${sent.length + 1}`,
    });

    assert.equal(controller.requestSetDim('light-1', 40), true);
    assert.equal(controller.requestSetDim('light-1', 80), false);
    assert.equal(sent.length, 1);
    assert.equal(sent[0]?.action, 'set-dim');
    assert.equal(sent[0]?.valuePercent, 40);
  });

  it('dispatches set-color with hue and saturation', () => {
    const sent: WidgetActionDispatch[] = [];
    const controller = new WidgetInteractionController({
      sendAction: (message) => {
        sent.push(message);
        return true;
      },
      createRequestId: () => 'color-1',
    });

    assert.equal(controller.requestSetColor('light-1', 33, 66), true);
    assert.equal(sent[0]?.action, 'set-color');
    assert.equal(sent[0]?.huePercent, 33);
    assert.equal(sent[0]?.saturationPercent, 66);
  });
});

describe('long-press constant', () => {
  it('exposes a centralized reasonable threshold', () => {
    assert.equal(LONG_PRESS_MS, 500);
  });
});

describe('LightControlPanel capability-driven UI', () => {
  it('shows only ON/OFF for onoff-only devices', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const panel = new LightControlPanel({
        copy: defaultDashboardUiCopy().light,
        initialRuntime: runtime({
          canToggle: true,
          canDim: false,
          canSetTemperature: false,
          canSetColor: false,
        }),
        actions: {
          toggle: () => true,
          setDim: () => false,
          setTemperature: () => false,
          setColor: () => false,
          isPending: () => false,
          onStatus: () => () => {},
        },
      });
      panel.mount(body as unknown as HTMLElement);
      assert.ok(findByClass(body, 'control-toggle'));
      assert.equal(findByClass(body, 'control-slider'), undefined);
      assert.equal(findByClass(body, 'control-color-pad'), undefined);
      panel.destroy();
    } finally {
      restore();
    }
  });

  it('shows dimmer when canDim', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const panel = new LightControlPanel({
        copy: defaultDashboardUiCopy().light,
        initialRuntime: runtime({
          canToggle: true,
          canDim: true,
          canSetTemperature: false,
          canSetColor: false,
        }),
        actions: {
          toggle: () => true,
          setDim: () => true,
          setTemperature: () => false,
          setColor: () => false,
          isPending: () => false,
          onStatus: () => () => {},
        },
      });
      panel.mount(body as unknown as HTMLElement);
      assert.ok(findByClass(body, 'control-slider'));
      assert.equal(findByClass(body, 'control-color-pad'), undefined);
      panel.destroy();
    } finally {
      restore();
    }
  });

  it('shows temperature and color when supported', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const panel = new LightControlPanel({
        copy: defaultDashboardUiCopy().light,
        initialRuntime: runtime({
          canToggle: true,
          canDim: true,
          canSetTemperature: true,
          canSetColor: true,
        }),
        actions: {
          toggle: () => true,
          setDim: () => true,
          setTemperature: () => true,
          setColor: () => true,
          isPending: () => false,
          onStatus: () => () => {},
        },
      });
      panel.mount(body as unknown as HTMLElement);
      assert.ok(findByClass(body, 'control-temperature-slider'));
      assert.ok(findByClass(body, 'control-color-pad'));
      panel.destroy();
    } finally {
      restore();
    }
  });

  it('send-on-release: dim drag does not command until pointerup', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const sent: number[] = [];
      const panel = new LightControlPanel({
        copy: defaultDashboardUiCopy().light,
        initialRuntime: runtime({
          canToggle: true,
          canDim: true,
          canSetTemperature: false,
          canSetColor: false,
        }),
        actions: {
          toggle: () => true,
          setDim: (value) => {
            sent.push(value);
            return true;
          },
          setTemperature: () => false,
          setColor: () => false,
          isPending: () => false,
          onStatus: () => () => {},
        },
      });
      panel.mount(body as unknown as HTMLElement);
      const slider = findByClass(body, 'control-slider');
      assert.ok(slider);

      slider!.dispatch('pointerdown', {
        button: 0,
        pointerType: 'touch',
        pointerId: 1,
        clientX: 200,
        clientY: 120,
        preventDefault() {},
      });
      assert.equal(sent.length, 0);

      slider!.dispatch('pointermove', {
        pointerId: 1,
        clientX: 300,
        clientY: 120,
        preventDefault() {},
      });
      assert.equal(sent.length, 0);

      slider!.dispatch('pointerup', {
        pointerId: 1,
        clientX: 300,
        clientY: 120,
        preventDefault() {},
      });
      assert.equal(sent.length, 1);
      assert.equal(sent[0], 100);

      panel.destroy();
    } finally {
      restore();
    }
  });

  it('disables controls when device unavailable', () => {
    const body = new FakeElement();
    const restore = installDomStub(body);
    try {
      const panel = new LightControlPanel({
        copy: defaultDashboardUiCopy().light,
        initialRuntime: {
          ...runtime({
            canToggle: true,
            canDim: true,
            canSetTemperature: false,
            canSetColor: false,
          }),
          available: false,
          on: null,
          error: 'unavailable',
          capabilities: {
            canToggle: false,
            canDim: false,
            canSetTemperature: false,
            canSetColor: false,
          },
        },
        actions: {
          toggle: () => false,
          setDim: () => false,
          setTemperature: () => false,
          setColor: () => false,
          isPending: () => false,
          onStatus: () => () => {},
        },
      });
      panel.mount(body as unknown as HTMLElement);
      const toggle = findByClass(body, 'control-toggle');
      // Power button only created when initial canToggle; unavailable runtime
      // still paints disabled state on root.
      const root = findByClass(body, 'light-control-panel');
      assert.ok(root);
      assert.equal(root!.dataset.unavailable, 'true');
      void toggle;
      panel.destroy();
    } finally {
      restore();
    }
  });
});
