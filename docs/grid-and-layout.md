# Grid & layout

Each Display has a **grid** of square cells. Widgets occupy rectangular **spans** of one or more cells. Layout is fixed when the dashboard loads — it does not continuously reflow when the browser is rotated or resized.

## Layout ids

Layout is chosen in **Device Advanced settings** (not the Dashboard Editor). The id format is **`{columns}x{rows}`**.

### Shelly Wall Display

| Id | Columns | Rows | Cells |
| --- | ---: | ---: | ---: |
| `2x2` | 2 | 2 | 4 |
| `3x3` | 3 | 3 | 9 |

### Generic Web Display

| Id | Columns | Rows | Cells | Orientation hint |
| --- | ---: | ---: | ---: | --- |
| `2x4` | 2 | 4 | 8 | Portrait |
| `4x2` | 4 | 2 | 8 | Landscape |
| `3x6` | 3 | 6 | 18 | Portrait |
| `6x3` | 6 | 3 | 18 | Landscape |

If an unsupported layout is stored, the Display shows an **invalid layout** error page.

## Grid geometry

When the dashboard renders:

- The grid is **centered** in the available viewport.
- Cells are **square**, sized to fit the smaller of width/height constraints.
- A fixed **safety margin** (12 px) keeps content away from screen edges.
- **Gap** between cells is proportional to cell size (ratio 0.08, clamped 4–20 px).
- Subtle cell boundaries may be visible; multi-cell widgets do **not** draw internal grid lines through the widget area.

Constants: `SAFETY_MARGIN_PX`, `GAP_RATIO`, `GAP_MIN_PX`, `GAP_MAX_PX` in the codebase.

## Coordinate system

Placement uses **zero-based** row and column indices internally:

- **Row 0, Column 0** = top-left cell
- Widget **rowSpan** / **columnSpan** extend **down** and **right**

The Dashboard Editor shows **1-based** labels in dropdowns (Row 1 = index 0) for readability.

### Example: 3×3 grid

Cell indices (internal):

```text
        col0   col1   col2
row0  ┌──────┬──────┬──────┐
      │ r0c0 │ r0c1 │ r0c2 │
row1  ├──────┼──────┼──────┤
      │ r1c0 │ r1c1 │ r1c2 │
row2  ├──────┼──────┼──────┤
      │ r2c0 │ r2c1 │ r2c2 │
      └──────┴──────┴──────┘
```

Editor labels (what you select):

```text
        col1   col2   col3
row1  ┌──────┬──────┬──────┐
      │      │      │      │
row2  ├──────┼──────┼──────┤
      │      │      │      │
row3  ├──────┼──────┼──────┤
      │      │      │      │
      └──────┴──────┴──────┘
```

### Example widget span

Title widget: start **row 0, column 0**, span **2×1** (two columns, one row):

```text
┌─────────────────┬──────┐
│     Title       │ r0c2 │
├──────┬──────┬────┼──────┤
│ r1c0 │ r1c1 │ r1c2 │      │
...
```

## Placement rules

| Rule | Behavior |
| --- | --- |
| Explicit position | Every widget has row, column, rowSpan, columnSpan |
| Bounds | Widget must fit entirely inside the grid |
| Overlap | **Rejected** — no automatic collision resolution |
| Span per type | Each widget type declares allowed spans (see [Widgets](widgets.md)) |
| Theme | Per-dashboard `dark` \| `light` in stored config |

## Orientation

LocalDashboard does **not** auto-switch layout when the browser rotates. Choose a layout id appropriate for how the screen is mounted (e.g. `2x4` portrait vs `4x2` landscape). Changing orientation typically requires selecting a different layout in Device settings and adjusting widget placements.

Browser viewport metadata on Generic displays is diagnostic only — it does **not** change layout.

## Invalid configuration

If stored dashboard config fails validation (unknown widget type, overlap, bad device reference in config shape), save is rejected in the editor. If the Display already has broken config at runtime, widgets may show **unavailable** but remain visible.

## Related

- [Dashboard Editor](dashboard-editor.md)
- [Widgets](widgets.md)
