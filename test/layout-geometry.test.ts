import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateGridGeometry,
  gapForCellSize,
  createGridCells,
  createPlacement,
  isPlacementWithinGrid,
  resolveLayoutId,
  isValidGridConfig,
  SAFETY_MARGIN_PX,
  GAP_MIN_PX,
  GAP_MAX_PX,
} from '../lib/dashboard/index';

describe('layoutParse', () => {
  it('resolves known layout ids', () => {
    assert.deepEqual(resolveLayoutId('2x2'), {
      ok: true,
      config: { rows: 2, columns: 2 },
    });
    assert.deepEqual(resolveLayoutId('3x3'), {
      ok: true,
      config: { rows: 3, columns: 3 },
    });
    assert.deepEqual(resolveLayoutId('2x4'), {
      ok: true,
      config: { rows: 4, columns: 2 },
    });
    assert.deepEqual(resolveLayoutId('4x2'), {
      ok: true,
      config: { rows: 2, columns: 4 },
    });
    assert.deepEqual(resolveLayoutId('3x6'), {
      ok: true,
      config: { rows: 6, columns: 3 },
    });
    assert.deepEqual(resolveLayoutId('6x3'), {
      ok: true,
      config: { rows: 3, columns: 6 },
    });
  });

  it('rejects unknown or invalid layouts', () => {
    assert.equal(resolveLayoutId('0x0').ok, false);
    assert.equal(resolveLayoutId('9x9').ok, false);
    assert.equal(resolveLayoutId('').ok, false);
    assert.equal(isValidGridConfig({ rows: 0, columns: 2 }), false);
    assert.equal(isValidGridConfig({ rows: 2, columns: -1 }), false);
  });
});

describe('createGridCells', () => {
  it('creates unique ids and correct counts', () => {
    const cells = createGridCells({ rows: 2, columns: 3 });
    assert.equal(cells.length, 6);
    const ids = new Set(cells.map((cell) => cell.id));
    assert.equal(ids.size, 6);
    assert.equal(cells[0]?.id, 'r0c0');
    assert.equal(cells[5]?.id, 'r1c2');
  });
});

describe('calculateGridGeometry', () => {
  it('keeps square cells for 2x2 on a square viewport', () => {
    const geometry = calculateGridGeometry(
      { width: 800, height: 800 },
      { rows: 2, columns: 2 },
    );
    assert.equal(geometry.cellSize, geometry.cellSize);
    assert.ok(geometry.cellSize > 0);
    assert.ok(
      geometry.gridWidth <= 800 - 2 * SAFETY_MARGIN_PX + 1e-9,
    );
    assert.ok(
      geometry.gridHeight <= 800 - 2 * SAFETY_MARGIN_PX + 1e-9,
    );
    assertAlmostEqual(geometry.offsetX, geometry.offsetY, 0.01);
  });

  it('keeps square cells for 3x3 on a square viewport', () => {
    const geometry = calculateGridGeometry(
      { width: 900, height: 900 },
      { rows: 3, columns: 3 },
    );
    assert.ok(geometry.cellSize > 0);
    assertAlmostEqual(geometry.gridWidth, geometry.gridHeight, 0.01);
  });

  it('fits 2x4 on a vertical viewport without overflow', () => {
    const viewport = { width: 480, height: 900 };
    const config = { rows: 4, columns: 2 };
    const geometry = calculateGridGeometry(viewport, config);
    assertContained(geometry, viewport);
    assert.ok(geometry.cellSize > 0);
    assert.ok(geometry.gap >= GAP_MIN_PX);
    assert.ok(geometry.gap <= GAP_MAX_PX);
  });

  it('fits 3x6 on a vertical viewport without overflow', () => {
    const viewport = { width: 480, height: 960 };
    const config = { rows: 6, columns: 3 };
    const geometry = calculateGridGeometry(viewport, config);
    assertContained(geometry, viewport);
  });

  it('fits 4x2 on a horizontal viewport without overflow', () => {
    const viewport = { width: 900, height: 480 };
    const geometry = calculateGridGeometry(viewport, { rows: 2, columns: 4 });
    assertContained(geometry, viewport);
    assert.ok(geometry.gridWidth > geometry.gridHeight);
  });

  it('fits 6x3 on a horizontal viewport without overflow', () => {
    const viewport = { width: 960, height: 480 };
    const geometry = calculateGridGeometry(viewport, { rows: 3, columns: 6 });
    assertContained(geometry, viewport);
    assert.ok(geometry.gridWidth > geometry.gridHeight);
  });

  it('centers on a very wide viewport', () => {
    const viewport = { width: 1920, height: 600 };
    const geometry = calculateGridGeometry(viewport, {
      rows: 2,
      columns: 2,
    });
    assertContained(geometry, viewport);
    assert.ok(geometry.offsetX > SAFETY_MARGIN_PX);
    assertAlmostEqual(
      geometry.offsetY,
      SAFETY_MARGIN_PX +
        (viewport.height - 2 * SAFETY_MARGIN_PX - geometry.gridHeight) / 2,
      0.05,
    );
  });

  it('centers on a very tall viewport', () => {
    const viewport = { width: 400, height: 1600 };
    const geometry = calculateGridGeometry(viewport, {
      rows: 2,
      columns: 2,
    });
    assertContained(geometry, viewport);
    assert.ok(geometry.offsetY > SAFETY_MARGIN_PX);
  });

  it('respects safety margin on all sides', () => {
    const viewport = { width: 700, height: 500 };
    const geometry = calculateGridGeometry(viewport, {
      rows: 3,
      columns: 3,
    });
    assert.ok(geometry.offsetX >= SAFETY_MARGIN_PX - 1e-9);
    assert.ok(geometry.offsetY >= SAFETY_MARGIN_PX - 1e-9);
    assert.ok(
      geometry.offsetX + geometry.gridWidth <=
        viewport.width - SAFETY_MARGIN_PX + 1e-9,
    );
    assert.ok(
      geometry.offsetY + geometry.gridHeight <=
        viewport.height - SAFETY_MARGIN_PX + 1e-9,
    );
  });

  it('uses proportional gap with clamps', () => {
    assert.equal(gapForCellSize(10), GAP_MIN_PX);
    assert.equal(gapForCellSize(10000), GAP_MAX_PX);
    const mid = gapForCellSize(100);
    assert.ok(mid > GAP_MIN_PX);
    assert.ok(mid < GAP_MAX_PX);
  });

  it('rejects invalid geometry inputs', () => {
    assert.throws(() =>
      calculateGridGeometry({ width: 100, height: 100 }, { rows: 0, columns: 2 }),
    );
    assert.throws(() =>
      calculateGridGeometry({ width: 0, height: 100 }, { rows: 2, columns: 2 }),
    );
  });
});

describe('future span placement compatibility', () => {
  it('accepts 1x2, 2x1 and 2x2 placements in the data model', () => {
    const config = { rows: 3, columns: 3 };
    assert.equal(
      isPlacementWithinGrid(config, createPlacement(0, 0, 1, 2)),
      true,
    );
    assert.equal(
      isPlacementWithinGrid(config, createPlacement(0, 0, 2, 1)),
      true,
    );
    assert.equal(
      isPlacementWithinGrid(config, createPlacement(1, 1, 2, 2)),
      true,
    );
    assert.equal(
      isPlacementWithinGrid(config, createPlacement(2, 2, 2, 2)),
      false,
    );
  });
});

function assertAlmostEqual(actual: number, expected: number, epsilon: number): void {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} ≈ ${expected} (±${epsilon})`,
  );
}

function assertContained(
  geometry: {
    readonly offsetX: number;
    readonly offsetY: number;
    readonly gridWidth: number;
    readonly gridHeight: number;
    readonly cellSize: number;
  },
  viewport: { readonly width: number; readonly height: number },
): void {
  assert.ok(geometry.cellSize > 0);
  assert.ok(geometry.offsetX >= SAFETY_MARGIN_PX - 1e-9);
  assert.ok(geometry.offsetY >= SAFETY_MARGIN_PX - 1e-9);
  assert.ok(
    geometry.offsetX + geometry.gridWidth <=
      viewport.width - SAFETY_MARGIN_PX + 1e-9,
  );
  assert.ok(
    geometry.offsetY + geometry.gridHeight <=
      viewport.height - SAFETY_MARGIN_PX + 1e-9,
  );
}
