# Architecture

## Milestone 0–2 foundations (still true)

`WelcomeWallApp` owns Homey app lifecycle. It starts `HttpServer` on the configured port. Logging goes through `AppLogger`. App-level persistence uses `SettingsManager` + `this.homey.settings`.

Adapters (`ShellyWallDisplayAdapter`, `GenericWebDisplayAdapter`) remain the only place protocol details live. Pairing orchestration stays in `PairingFlow`.

Drivers `shelly_wall_display` and `generic_web_display` stay thin. `DisplayRegistry` is a runtime projection of Homey Devices (source of truth).

## Milestone 3 — Vanilla Grid Rendering Engine

```text
Homey Device Settings (layout)
        │
        ▼
DisplayRegistry (DisplaySnapshot.layoutId)
        │
HTTP GET /  ──► DisplayRequestHandler
        │           │
        │           ├─ IP + optional Shelly hardware check
        │           ├─ resolveLayoutId → GridConfig
        │           ├─ DashboardBootstrap DTO
        │           └─ dashboard HTML (+ /dashboard.css, /dashboard.js)
        │
        ▼
Vanilla frontend (page load once)
        │
        ├─ read viewport
        ├─ calculateGridGeometry (square cells, margin, gap)
        ├─ createGridCells (stable ids)
        └─ CSS Grid render (centered) — layout immutable after this
```

### HTTP routes

| Path | Behavior |
| --- | --- |
| `GET /` | Recognize client; serve dashboard grid or error/unconfigured pages |
| `GET /dashboard.css` | Built vanilla stylesheet |
| `GET /dashboard.js` | Built vanilla grid engine (IIFE) |
| `GET /diagnostics` | Runtime diagnostics if enabled; otherwise **403** |
| other | 404 |

### Backend → frontend contract

The frontend never calls Homey APIs. It only receives:

```ts
interface DashboardBootstrap {
  readonly displayId: string;
  readonly layout: { readonly rows: number; readonly columns: number };
}
```

Embedded in the HTML as `<script type="application/json" id="dashboard-bootstrap">`.

### Grid geometry (pure TypeScript)

Implemented in `lib/dashboard/` and shared with the frontend bundle:

- Fixed safety margin (`SAFETY_MARGIN_PX`)
- Gap = clamp(cellSize × `GAP_RATIO`, `GAP_MIN_PX`, `GAP_MAX_PX`)
- Largest square cell that fits available viewport
- Grid centered in the remaining space
- Calculated **once** at page load (no resize listeners)

### Supported layouts

Layout ids are `{columns}x{rows}`. Non-square grids include both orientations; square grids do not need a duplicate.

| Driver | Layouts |
| --- | --- |
| Shelly Wall Display | `2x2`, `3x3` |
| Generic Web Display | `2x4` / `4x2`, `3x6` / `6x3` |

### Future span model

`GridPlacement { row, column, rowSpan, columnSpan }` exists for future multi-cell widgets. Milestone 3 only renders 1×1 diagnostic cells.

### Persistence (official Homey only)

Unchanged from Milestone 2: device `data` / `store` / `settings`, app `ManagerSettings`. Layout remains a Homey device setting — no second layout store.

### Localization

- Manifest / driver / settings labels: `en` + `it` in compose JSON
- Pairing, HTTP pages, dashboard errors, diagnostics: `/locales/en.json` and `/locales/it.json`

### What is intentionally not here

No widgets, no Homey capability control, no Flow, no WebSocket, no visual editor, no multi-page navigation, no dynamic resize, no Vue/React/Angular/Svelte.
