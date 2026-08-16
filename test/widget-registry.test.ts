import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createDefaultWidgetRegistry,
  isTitleWidgetConfig,
  isDateTimeWidgetConfig,
  isLightWidgetConfig,
  validateDashboardConfiguration,
  validatePlacementAgainstWidgets,
  buildOccupancyMap,
  occupiedCellIds,
  createWidgetId,
  parseDashboardConfiguration,
  type WidgetInstance,
} from '../lib/widgets';

describe('WidgetRegistry', () => {
  it('registers title, date-time, light and cover widgets', () => {
    const registry = createDefaultWidgetRegistry();
    assert.ok(registry.has('title'));
    assert.ok(registry.has('date-time'));
    assert.ok(registry.has('light'));
    assert.ok(registry.has('cover'));
    assert.equal(registry.list().length, 4);
  });

  it('returns null for unknown types', () => {
    const registry = createDefaultWidgetRegistry();
    assert.equal(registry.get('unknown'), null);
    assert.equal(registry.allowedSpans('unknown'), null);
  });

  it('exposes supported spans', () => {
    const registry = createDefaultWidgetRegistry();
    assert.deepEqual(registry.allowedSpans('title'), [
      { rowSpan: 1, columnSpan: 2 },
      { rowSpan: 1, columnSpan: 3 },
    ]);
    assert.deepEqual(registry.allowedSpans('date-time'), [
      { rowSpan: 1, columnSpan: 1 },
      { rowSpan: 1, columnSpan: 2 },
    ]);
    assert.deepEqual(registry.allowedSpans('light'), [
      { rowSpan: 1, columnSpan: 1 },
    ]);
    assert.deepEqual(registry.allowedSpans('cover'), [
      { rowSpan: 1, columnSpan: 1 },
    ]);
  });
});

describe('Widget placement', () => {
  const grid = { rows: 3, columns: 3 };

  it('accepts valid 1x1, 2x1 and 3x1 placements', () => {
    assert.equal(
      validatePlacementAgainstWidgets({
        grid,
        placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 1 },
        widgets: [],
      }).ok,
      true,
    );
    assert.equal(
      validatePlacementAgainstWidgets({
        grid,
        placement: { row: 1, column: 0, rowSpan: 1, columnSpan: 2 },
        widgets: [],
      }).ok,
      true,
    );
    assert.equal(
      validatePlacementAgainstWidgets({
        grid,
        placement: { row: 2, column: 0, rowSpan: 1, columnSpan: 3 },
        widgets: [],
      }).ok,
      true,
    );
  });

  it('rejects out of bounds placements', () => {
    const result = validatePlacementAgainstWidgets({
      grid,
      placement: { row: 2, column: 2, rowSpan: 1, columnSpan: 2 },
      widgets: [],
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'out_of_bounds');
    }
  });

  it('rejects collisions and allows adjacent widgets', () => {
    const existing: WidgetInstance = {
      id: 'a',
      type: 'date-time',
      placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
      config: { mode: 'time' },
    };

    const collision = validatePlacementAgainstWidgets({
      grid,
      placement: { row: 0, column: 1, rowSpan: 1, columnSpan: 1 },
      widgets: [existing],
    });
    assert.equal(collision.ok, false);
    if (!collision.ok) {
      assert.equal(collision.error, 'overlap');
    }

    const adjacent = validatePlacementAgainstWidgets({
      grid,
      placement: { row: 0, column: 2, rowSpan: 1, columnSpan: 1 },
      widgets: [existing],
    });
    assert.equal(adjacent.ok, true);
  });

  it('frees cells after widget removal', () => {
    const widgets: WidgetInstance[] = [
      {
        id: 'a',
        type: 'title',
        placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
        config: { text: 'Hello', alignment: 'left' },
      },
    ];
    const before = buildOccupancyMap(widgets);
    assert.equal(before.get('r0c0'), 'a');
    assert.equal(before.get('r0c1'), 'a');

    const afterRemoval = buildOccupancyMap([]);
    assert.equal(afterRemoval.size, 0);
    assert.deepEqual(
      occupiedCellIds(widgets[0]!.placement),
      ['r0c0', 'r0c1'],
    );
  });

  it('validates span changes for edit operations', () => {
    const widgets: WidgetInstance[] = [
      {
        id: 'a',
        type: 'title',
        placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
        config: { text: 'Hello', alignment: 'center' },
      },
      {
        id: 'b',
        type: 'date-time',
        placement: { row: 0, column: 2, rowSpan: 1, columnSpan: 1 },
        config: { mode: 'date' },
      },
    ];

    const validSpanChange = validatePlacementAgainstWidgets({
      grid,
      placement: { row: 1, column: 0, rowSpan: 1, columnSpan: 3 },
      widgets,
      ignoreWidgetId: 'a',
      allowedSpans: [
        { rowSpan: 1, columnSpan: 2 },
        { rowSpan: 1, columnSpan: 3 },
      ],
    });
    assert.equal(validSpanChange.ok, true);

    const invalidSpanChange = validatePlacementAgainstWidgets({
      grid,
      placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 3 },
      widgets,
      ignoreWidgetId: 'a',
      allowedSpans: [
        { rowSpan: 1, columnSpan: 2 },
        { rowSpan: 1, columnSpan: 3 },
      ],
    });
    assert.equal(invalidSpanChange.ok, false);
  });
});

describe('Widget configuration', () => {
  it('validates TitleWidget config', () => {
    assert.equal(
      isTitleWidgetConfig({ text: 'Hello', alignment: 'left' }),
      true,
    );
    assert.equal(isTitleWidgetConfig({ text: '', alignment: 'left' }), false);
    assert.equal(
      isTitleWidgetConfig({ text: 'Hello', alignment: 'middle' }),
      false,
    );
    assert.equal(
      isTitleWidgetConfig({ text: 'Hello', alignment: 'left', chrome: 'card' }),
      true,
    );
    assert.equal(
      isTitleWidgetConfig({
        text: 'Hello',
        alignment: 'left',
        chrome: 'boxed',
      }),
      false,
    );
  });

  it('validates DateTimeWidget config', () => {
    assert.equal(isDateTimeWidgetConfig({ mode: 'time' }), true);
    assert.equal(isDateTimeWidgetConfig({ mode: 'date' }), true);
    assert.equal(isDateTimeWidgetConfig({ mode: 'date-time' }), true);
    assert.equal(isDateTimeWidgetConfig({ mode: 'clock' }), false);
    assert.equal(
      isDateTimeWidgetConfig({ mode: 'time', chrome: 'plain' }),
      true,
    );
    assert.equal(
      isDateTimeWidgetConfig({ mode: 'time', chrome: 'framed' }),
      false,
    );
  });

  it('validates LightWidget config', () => {
    assert.equal(isLightWidgetConfig({ deviceId: 'dev-1' }), true);
    assert.equal(isLightWidgetConfig({ deviceId: '' }), false);
    assert.equal(isLightWidgetConfig({ deviceId: '   ' }), false);
    assert.equal(isLightWidgetConfig({}), false);
    assert.equal(isLightWidgetConfig({ name: 'Lamp' }), false);
  });

  it('rejects LightWidget spans other than 1x1', () => {
    const result = validateDashboardConfiguration({
      grid: { rows: 3, columns: 3 },
      configuration: {
        version: 1,
        widgets: [
          {
            id: 'light-1',
            type: 'light',
            placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
            config: { deviceId: 'dev-1' },
          },
        ],
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, 'unsupported_span');
    }
  });

  it('validates a full dashboard configuration', () => {
    const configuration = {
      version: 1 as const,
      widgets: [
        {
          id: createWidgetId(),
          type: 'title' as const,
          placement: { row: 0, column: 0, rowSpan: 1, columnSpan: 2 },
          config: { text: 'Kitchen', alignment: 'left' as const },
        },
        {
          id: createWidgetId(),
          type: 'date-time' as const,
          placement: { row: 0, column: 2, rowSpan: 1, columnSpan: 1 },
          config: { mode: 'time' as const },
        },
      ],
    };

    const result = validateDashboardConfiguration({
      grid: { rows: 3, columns: 3 },
      configuration,
    });
    assert.equal(result.ok, true);
  });

  it('parses dashboard theme and rejects invalid values', () => {
    const parsed = parseDashboardConfiguration({
      version: 1,
      theme: 'light',
      widgets: [],
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.configuration.theme, 'light');
    }

    const omitted = parseDashboardConfiguration({
      version: 1,
      widgets: [],
    });
    assert.equal(omitted.ok, true);
    if (omitted.ok) {
      assert.equal(omitted.configuration.theme, 'dark');
    }

    const invalid = parseDashboardConfiguration({
      version: 1,
      theme: 'auto',
      widgets: [],
    });
    assert.equal(invalid.ok, false);
  });
});
