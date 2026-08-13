# Milestone 3 — Vanilla Grid Rendering Engine

## Goal

Prove the end-to-end path:

```text
Homey Device Settings → DisplayRegistry → HTTP → DashboardBootstrap → Grid Engine → square centered grid
```

No real widgets yet — diagnostic cells only.

## Architecture implemented

- `lib/dashboard/` — types, constants, layout parse, geometry, cells, bootstrap helper
- `frontend/` — vanilla `main.ts` + `dashboard.css` (build → `assets/dashboard/`)
- `DisplayRequestHandler` serves dashboard HTML + `/dashboard.css` + `/dashboard.js`
- Invalid layout → localized error page + logger + diagnostics error
- Unconfigured / mismatch / probe-failed pages unchanged in purpose
- Diagnostics columns: layout, grid size, last rendered, layout error, process RSS/heap
- Generic layouts: `2x4` / `4x2` (portrait/landscape) and `3x6` / `6x3`

## Frontend performance (measured locally after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML (sample bootstrap page) | 518 B | 324 B |
| CSS | 1037 B | 500 B |
| JS (minified IIFE) | 3428 B | 1434 B |
| **Total** | **4983 B** | **2258 B** |

Re-measure: `npm run measure:frontend`.

## Dependencies

| Dependency | Kind | Approx. weight | Reason |
| --- | --- | --- | --- |
| `esbuild` | **dev only** | build tool | Bundle shared geometry + frontend into one IIFE for embedded WebViews |
| *(none)* | frontend runtime | 0 | Vanilla browser APIs only |

Runtime Homey dependency set unchanged (`source-map-support` only).

## Homey / Node memory

Homey Apps SDK does **not** expose a dedicated app RAM API. Diagnostics shows Node `process.memoryUsage()`:

- **RSS** — `pages.diagnostics.memoryRss`
- **Heap used** — `pages.diagnostics.memoryHeap`

Record values on Homey Pro from `/diagnostics` before load, with server idle, and after dashboard requests. Do not invent figures.

Local developer Node process (unrelated to Homey app) is not a substitute for Homey measurements.

## Automated tests

| File | Coverage |
| --- | --- |
| `test/layout-geometry.test.ts` | Square cells, containment, margin/gap, centering, invalid config, unique cell ids, future span placements |
| `test/display-request-handler.test.ts` | Dashboard bootstrap, invalid layout, assets, diagnostics, unconfigured, mismatch |

## Manual checklist

See [MILESTONES.md](MILESTONES.md) (Milestone 3 section).

## Open issues

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
