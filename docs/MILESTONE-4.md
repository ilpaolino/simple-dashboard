# Milestone 4 — Widget Engine & Dashboard Editor

## Goal

```text
Dashboard Editor (App Settings)
      +
Widget Registry
      +
explicit placement
      +
multi-cell widgets
      +
TitleWidget + DateTimeWidget
      +
per-device Device Store persistence
```

## Architecture implemented

- `lib/widgets/` — types, placement, validation, registry, title/date-time definitions
- `frontend/widgets/` — isolated DOM renderers + CSS per widget
- `frontend/layout/DashboardRenderer.ts` — `applyConfiguration` (reload-ready for future live updates)
- `api.ts` + App methods — list/get/save dashboard via Homey Web API
- `settings/index.html` + `settings/editor.js` — Dashboard Editor UI
- Device Store key `dashboard` for `DashboardConfiguration`
- Device Settings `label` note pointing to App Settings
- Diagnostics columns for widgets / types / dashboard errors / last loaded config

## Frontend performance (measured locally after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML (sample bootstrap page) | 545 B | 342 B |
| CSS | 3450 B | 966 B |
| JS (minified IIFE) | 8029 B | 2814 B |
| **Total** | **12024 B** | **4122 B** |

Milestone 3 reference total: **4983 B** raw / **2258 B** gzip.

Delta (raw): **+7041 B** (widgets + tokens + renderer). Still zero frontend framework dependencies.

Settings editor bundle (`settings/editor.js`): **13.1 KB** (Homey App Settings only, not served to wall displays).

Re-measure: `npm run measure:frontend`.

## Dependencies

| Dependency | Kind | Reason |
| --- | --- | --- |
| `esbuild` | **dev only** | Bundle dashboard + settings editor IIFEs; inline CSS imports |
| *(none)* | frontend runtime | Vanilla browser APIs (`Intl`, `setInterval`) |

Runtime Homey dependency set unchanged (`source-map-support` only).

## Automated tests

| File | Coverage |
| --- | --- |
| `test/widget-registry.test.ts` | Registry, spans, placement, collisions, config validation |
| `test/dashboard-renderer.test.ts` | DateTime formatting, span CSS helpers, `applyConfiguration` replace + timer cleanup |
| Existing geometry / handler / registry tests | Updated for `dashboard` on snapshots |

## Manual checklist

See [MILESTONES.md](MILESTONES.md) (Milestone 4 section).

## Open issues

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
