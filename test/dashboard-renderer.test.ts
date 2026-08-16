import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatDateTime, normalizeLocale } from '../frontend/widgets/date-time/DateTimeWidget';
import { DashboardRenderer } from '../frontend/layout/DashboardRenderer';
import {
  placementGridArea,
  layoutVariantClass,
  widgetChromeClass,
  type WidgetRenderer,
} from '../frontend/widgets/types';
import { createFrontendWidgetRegistry } from '../frontend/widgets/registry/WidgetRegistry';
import type { DashboardEmptyStateCopy } from '../lib/dashboard/types';
import type { LightWidgetConfig } from '../lib/widgets/light/types';
import type { WidgetInstance } from '../lib/widgets/types';

const emptyState: DashboardEmptyStateCopy = {
  heading: 'No widgets configured',
  lead: 'Configure from app settings',
  nameLabel: 'Name',
  typeLabel: 'Type',
  idLabel: 'ID',
  layoutLabel: 'Layout',
  gridLabel: 'Grid size',
};

describe('DateTimeWidget helpers', () => {
  const sample = new Date(2026, 4, 25, 11, 43, 5);

  it('formats time mode as hours and minutes', () => {
    const formatted = formatDateTime(sample, 'time', 'en-US');
    assert.equal(formatted.date, '');
    assert.equal(formatted.weekday, '');
    assert.match(formatted.time, /11:43/);
    assert.doesNotMatch(formatted.time, /:\d{2}:\d{2}/);
  });

  it('formats date mode with compact and split labels', () => {
    const formatted = formatDateTime(sample, 'date', 'en-US');
    assert.equal(formatted.time, '');
    assert.equal(formatted.weekday, 'Monday');
    assert.equal(formatted.dayMonth, '25th May');
    assert.equal(formatted.date, 'Monday, May 25');
  });

  it('formats date-time mode in Italian without ordinals', () => {
    const formatted = formatDateTime(sample, 'date-time', 'it-IT');
    assert.match(formatted.time, /11:43/);
    assert.equal(formatted.weekday, 'Lunedì');
    assert.equal(formatted.dayMonth, '25 Maggio');
    assert.match(formatted.date, /Lunedì/i);
  });

  it('normalizes locales', () => {
    assert.equal(normalizeLocale('it'), 'it-IT');
    assert.equal(normalizeLocale('en'), 'en-US');
  });
});

describe('Widget layout helpers', () => {
  it('builds CSS grid areas for multi-cell widgets', () => {
    assert.equal(
      placementGridArea({ row: 1, column: 1, rowSpan: 1, columnSpan: 2 }),
      '2 / 2 / 3 / 4',
    );
    assert.equal(
      layoutVariantClass({ row: 0, column: 0, rowSpan: 1, columnSpan: 3 }),
      'widget-layout-3x1',
    );
  });
});

describe('DashboardRenderer applyConfiguration', () => {
  it('shows empty state with display data when no widgets are configured', () => {
    installDomShim();
    const root = document.createElement('div');
    const renderer = new DashboardRenderer(root);

    renderer.applyConfiguration({
      displayId: 'disp-1',
      displayName: 'Kitchen',
      typeLabel: 'Shelly Wall Display',
      layoutId: '2x2',
      layout: { rows: 2, columns: 2 },
      widgets: [],
      locale: 'en',
      emptyState,
    });

    assert.equal(renderer.getMountedCount(), 0);
    const fakeRoot = root as unknown as FakeElement;
    assert.equal(fakeRoot.children.length, 2);
    const grid = fakeRoot.children[0];
    const panel = fakeRoot.children[1];
    assert.ok(grid);
    assert.ok(panel);
    assert.match(grid!.className, /grid--empty/);
    assert.equal(grid!.children.length, 4);
    assert.match(panel!.className, /dashboard-empty/);
    assert.match(panel!.children[0]!.textContent, /No widgets configured/);
    assert.equal(fakeRoot.dataset.theme, 'dark');
    renderer.destroy();
  });

  it('replaces previous widgets and clears timers on destroy', () => {
    const timers = installDomShim();
    const root = document.createElement('div');
    const renderer = new DashboardRenderer(root);

    const first: WidgetInstance = {
      id: 'w1',
      type: 'title',
      placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
      config: { text: 'One', alignment: 'left' },
    };

    renderer.applyConfiguration({
      displayId: 'disp-1',
      displayName: 'Kitchen',
      typeLabel: 'Shelly Wall Display',
      layoutId: '2x2',
      layout: { rows: 2, columns: 2 },
      widgets: [first],
      locale: 'en',
      emptyState,
    });
    assert.equal(renderer.getMountedCount(), 1);

    const second: WidgetInstance = {
      id: 'w2',
      type: 'date-time',
      placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
      config: { mode: 'time' },
    };

    renderer.applyConfiguration({
      displayId: 'disp-1',
      displayName: 'Kitchen',
      typeLabel: 'Shelly Wall Display',
      layoutId: '2x2',
      layout: { rows: 2, columns: 2 },
      widgets: [second],
      locale: 'en',
      emptyState,
    });
    assert.equal(renderer.getMountedCount(), 1);
    assert.ok(timers.active.size >= 1);

    renderer.destroy();
    assert.equal(renderer.getMountedCount(), 0);
    assert.equal(timers.active.size, 0);
  });

  it('mounts multi-cell widgets with layout class', () => {
    installDomShim();
    const root = document.createElement('div');
    const renderer = new DashboardRenderer(root);

    renderer.applyConfiguration({
      displayId: 'disp-1',
      displayName: 'Kitchen',
      typeLabel: 'Shelly Wall Display',
      layoutId: '3x3',
      layout: { rows: 3, columns: 3 },
      widgets: [
        {
          id: 'title-1',
          type: 'title',
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 3 },
          config: { text: 'Wide', alignment: 'center' },
        },
      ],
      locale: 'en',
      emptyState,
    });

    assert.equal(renderer.getMountedCount(), 1);
    const grid = (root as unknown as FakeElement).children[0];
    assert.ok(grid);
    const widget = grid!.children[0];
    assert.ok(widget);
    assert.equal(widget!.style.gridArea, '1 / 1 / 2 / 4');
    assert.match(widget!.className, /widget-layout-3x1/);
    assert.match(widget!.className, /widget--plain/);
    renderer.destroy();
  });

  it('applies card chrome when configured', () => {
    installDomShim();
    const root = document.createElement('div');
    const renderer = new DashboardRenderer(root);

    renderer.applyConfiguration({
      displayId: 'disp-1',
      displayName: 'Kitchen',
      typeLabel: 'Shelly Wall Display',
      layoutId: '2x2',
      layout: { rows: 2, columns: 2 },
      widgets: [
        {
          id: 'clock-1',
          type: 'date-time',
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
          config: { mode: 'time', chrome: 'card' },
        },
      ],
      locale: 'en',
      emptyState,
    });

    const grid = (root as unknown as FakeElement).children[0];
    const widget = grid!.children[0];
    assert.match(widget!.className, /widget--card/);
    renderer.destroy();
  });

  it('applies light theme on the dashboard root', () => {
    installDomShim();
    const root = document.createElement('div');
    const renderer = new DashboardRenderer(root);

    renderer.applyConfiguration({
      displayId: 'disp-1',
      displayName: 'Kitchen',
      typeLabel: 'Shelly Wall Display',
      layoutId: '2x2',
      layout: { rows: 2, columns: 2 },
      widgets: [],
      theme: 'light',
      locale: 'en',
      emptyState,
    });

    assert.equal((root as unknown as FakeElement).dataset.theme, 'light');
    renderer.destroy();
  });

  it('lets widgets inherit the display theme from the dashboard grid', () => {
    installDomShim();
    const root = document.createElement('div');
    const renderer = new DashboardRenderer(root);

    renderer.applyConfiguration({
      displayId: 'disp-1',
      displayName: 'Kitchen',
      typeLabel: 'Shelly Wall Display',
      layoutId: '2x2',
      layout: { rows: 2, columns: 2 },
      widgets: [
        {
          id: 'title-1',
          type: 'title',
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
          config: { text: 'Kitchen', alignment: 'left' },
        },
      ],
      theme: 'light',
      locale: 'en',
      emptyState,
    });

    const fakeRoot = root as unknown as FakeElement;
    assert.equal(fakeRoot.dataset.theme, 'light');
    const grid = fakeRoot.children[0];
    assert.ok(grid);
    assert.equal(grid!.dataset.theme, 'light');
    const widget = grid!.children[0];
    assert.ok(widget);
    assert.match(widget!.className, /widget-title/);
    renderer.destroy();
  });
});

describe('LightWidget renderer', () => {
  it('renders ON and OFF from runtime state without timers', () => {
    const timers = installDomShim();
    const root = document.createElement('div');
    const renderer = new DashboardRenderer(root);

    renderer.applyConfiguration({
      displayId: 'disp-1',
      displayName: 'Kitchen',
      typeLabel: 'Shelly Wall Display',
      layoutId: '2x2',
      layout: { rows: 2, columns: 2 },
      widgets: [
        {
          id: 'light-1',
          type: 'light',
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
          config: { deviceId: 'dev-1' },
        },
      ],
      widgetRuntime: {
        'light-1': {
          type: 'light',
          deviceId: 'dev-1',
          name: 'Lampada tavolo',
          available: true,
          on: true,
          error: null,
        },
      },
      locale: 'en',
      emptyState,
    });

    const grid = (root as unknown as FakeElement).children[0];
    const widget = grid!.children[0];
    assert.match(widget!.className, /widget-light--state-on/);
    assert.match(widget!.className, /device-widget/);
    assert.match(widget!.children[0]!.className, /device-widget__icon/);
    assert.equal(widget!.children[1]!.textContent, 'On');
    assert.equal(widget!.children[2]!.children[1]!.textContent, 'Lampada tavolo');
    assert.equal(timers.active.size, 0);

    renderer.updateWidgetState('light-1', {
      type: 'light',
      deviceId: 'dev-1',
      name: 'Lampada tavolo',
      available: true,
      on: false,
      error: null,
    });

    assert.match(widget!.className, /widget-light--state-off/);
    assert.equal(widget!.children[1]!.textContent, 'Off');
    renderer.destroy();
  });

  it('renders CoverWidget percent, bar, icon, and unavailable without rebuild', () => {
    const timers = installDomShim();
    const root = document.createElement('div');
    const renderer = new DashboardRenderer(root);

    renderer.applyConfiguration({
      displayId: 'disp-1',
      displayName: 'Kitchen',
      typeLabel: 'Shelly Wall Display',
      layoutId: '2x2',
      layout: { rows: 2, columns: 2 },
      widgets: [
        {
          id: 'cover-1',
          type: 'cover',
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
          config: { deviceId: 'dev-cover' },
        },
        {
          id: 'title-1',
          type: 'title',
          placement: { row: 0, column: 1, rowSpan: 1, columnSpan: 1 },
          config: { text: 'Stay', alignment: 'left' },
        },
      ],
      widgetRuntime: {
        'cover-1': {
          type: 'cover',
          deviceId: 'dev-cover',
          name: 'Tapparella cucina',
          available: true,
          positionPercent: 20,
          capabilities: { canSetPosition: true, canStop: false },
          error: null,
        },
      },
      locale: 'en',
      emptyState,
    });

    const grid = (root as unknown as FakeElement).children[0];
    const cover = grid!.children.find((child) =>
      child.className.includes('widget-cover'),
    );
    const title = grid!.children.find((child) =>
      child.className.includes('widget-title'),
    );
    assert.ok(cover);
    assert.ok(title);
    assert.match(cover!.className, /device-widget/);
    assert.match(cover!.children[0]!.className, /device-widget__icon/);
    assert.equal(cover!.children[1]!.textContent, 'Tapparella cucina');
    const body = cover!.children[2]!;
    assert.equal(body.children[0]!.textContent, '20%');
    assert.equal(body.children[1]!.children[0]!.style.height, '20%');
    assert.equal(timers.active.size, 0);

    const titleBefore = title!.textContent;
    renderer.updateWidgetState('cover-1', {
      type: 'cover',
      deviceId: 'dev-cover',
      name: 'Tapparella cucina',
      available: true,
      positionPercent: 70,
      capabilities: { canSetPosition: true, canStop: false },
      error: null,
    });
    assert.equal(body.children[0]!.textContent, '70%');
    assert.equal(body.children[1]!.children[0]!.style.height, '70%');
    assert.equal(title!.textContent, titleBefore);

    renderer.updateWidgetState('cover-1', {
      type: 'cover',
      deviceId: 'dev-cover',
      name: 'Tapparella cucina',
      available: false,
      positionPercent: null,
      capabilities: { canSetPosition: false, canStop: false },
      error: 'missing_device',
    });
    assert.match(cover!.className, /widget-cover--state-unavailable/);
    assert.equal(body.children[0]!.textContent, 'Device unavailable');
    renderer.destroy();
  });

  it('keeps other widgets when a LightWidget renderer throws', () => {
    installDomShim();
    const registry = createFrontendWidgetRegistry();
    const throwing: WidgetRenderer<LightWidgetConfig> = {
      type: 'light',
      mount() {
        throw new Error('boom');
      },
    };
    registry.registerRenderer(throwing);

    const root = document.createElement('div');
    const renderer = new DashboardRenderer(root, registry);

    renderer.applyConfiguration({
      displayId: 'disp-1',
      displayName: 'Kitchen',
      typeLabel: 'Shelly Wall Display',
      layoutId: '2x2',
      layout: { rows: 2, columns: 2 },
      widgets: [
        {
          id: 'title-1',
          type: 'title',
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
          config: { text: 'Kitchen', alignment: 'left' },
        },
        {
          id: 'light-1',
          type: 'light',
          placement: { row: 1, column: 0, rowSpan: 1, columnSpan: 1 },
          config: { deviceId: 'dev-1' },
        },
      ],
      locale: 'en',
      emptyState,
    });

    assert.equal(renderer.getMountedCount(), 2);
    const grid = (root as unknown as FakeElement).children[0];
    assert.equal(grid!.children.length, 2);
    assert.match(grid!.children[0]!.className, /widget-title/);
    assert.match(grid!.children[1]!.className, /widget--failed/);
    renderer.destroy();
  });
});

describe('Widget chrome helper', () => {
  it('defaults omitted chrome to plain', () => {
    assert.equal(widgetChromeClass({}), 'widget--plain');
    assert.equal(widgetChromeClass({ chrome: 'card' }), 'widget--card');
  });
});

interface TimerBag {
  readonly active: Set<number>;
}

class FakeElement {
  public children: FakeElement[] = [];
  public style: FakeStyle = new FakeStyle();
  public className = '';
  public textContent = '';
  public dataset: Record<string, string> = {};
  public hidden = false;
  public tabIndex = -1;
  private readonly attrs = new Map<string, string>();
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  public setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  public addEventListener(
    type: string,
    listener: (event: Event) => void,
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
    listener: (event: Event) => void,
  ): void {
    this.listeners.get(type)?.delete(listener);
  }

  public appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  public replaceChildren(...nodes: FakeElement[]): void {
    this.children = [...nodes];
  }

  public remove(): void {
    this.children = [];
  }
}

class FakeStyle {
  public gridArea = '';
  public height = '';
  private readonly props = new Map<string, string>();

  public setProperty(name: string, value: string): void {
    this.props.set(name, value);
  }
}

function installDomShim(): TimerBag {
  let nextTimer = 1;
  const active = new Set<number>();

  const doc = {
    createElement(_tag: string): FakeElement {
      return new FakeElement();
    },
  };

  const win = {
    innerWidth: 800,
    innerHeight: 600,
    setInterval(handler: () => void): number {
      const id = nextTimer;
      nextTimer += 1;
      active.add(id);
      void handler;
      return id;
    },
    clearInterval(id: number): void {
      active.delete(id);
    },
  };

  (globalThis as { document?: unknown }).document = doc;
  (globalThis as { window?: unknown }).window = win;
  (globalThis as { HTMLElement?: unknown }).HTMLElement = FakeElement;

  return { active };
}
