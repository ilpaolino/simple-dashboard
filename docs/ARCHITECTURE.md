# Architecture

## Milestone 0–3 foundations (still true)

`WelcomeWallApp` owns Homey app lifecycle. It starts `HttpServer` on the configured port. Logging goes through `AppLogger`. App-level persistence uses `SettingsManager` + `this.homey.settings`.

Adapters (`ShellyWallDisplayAdapter`, `GenericWebDisplayAdapter`) remain the only place protocol details live. Pairing orchestration stays in `PairingFlow`.

Drivers `shelly_wall_display` and `generic_web_display` stay thin. `DisplayRegistry` is a runtime projection of Homey Devices (source of truth).

## Milestone 4 — Widget Engine & Dashboard Editor

```text
Homey App Settings (Dashboard Editor)
        │  Homey.api → api.ts → WelcomeWallApp
        ▼
Homey Device Store key `dashboard`
        │
        ▼
DisplayRegistry (DisplaySnapshot.dashboard)
        │
HTTP GET /  ──► DisplayRequestHandler
        │           │
        │           ├─ IP + optional Shelly hardware check
        │           ├─ resolveLayoutId → GridConfig
        │           ├─ validate widgets (bounds / overlap)
        │           ├─ DashboardBootstrap DTO
        │           └─ dashboard HTML (+ /dashboard.css, /dashboard.js)
        │
        ▼
Vanilla frontend
        │
        ├─ DashboardRenderer.applyConfiguration(config)
        ├─ FrontendWidgetRegistry → Title / DateTime renderers
        └─ multi-cell CSS grid-area (no internal cell dividers)
```

### HTTP routes

| Path | Behavior |
| --- | --- |
| `GET /` | Recognize client; serve dashboard with widgets or error/unconfigured pages |
| `GET /dashboard.css` | Built vanilla stylesheet (tokens + widgets) |
| `GET /dashboard.js` | Built vanilla grid + widget engine (IIFE) |
| `GET /diagnostics` | Runtime diagnostics if enabled; otherwise **403** |
| other | 404 |

### Homey Web API (App Settings editor)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/displays` | List wall displays for the editor |
| `GET` | `/displays/:displayId/dashboard` | Load grid + widgets + widget type metadata |
| `PUT` | `/displays/:displayId/dashboard` | Validate and persist widget configuration |

### Backend → frontend contract

```ts
interface DashboardBootstrap {
  readonly displayId: string;
  readonly layout: { readonly rows: number; readonly columns: number };
  readonly widgets: readonly WidgetInstance[];
  readonly theme: 'dark' | 'light';
  readonly locale: string;
}
```

Embedded in the HTML as `<script type="application/json" id="dashboard-bootstrap">`.

### Widget model

- `WidgetPlacement { row, column, rowSpan, columnSpan }` — top-left origin, extends right/down
- `WidgetInstance` — stable `id`, `type`, `placement`, typed `config`
- `DashboardConfiguration { version: 1, widgets, optional theme }` — Device Store payload. `theme` (`dark` | `light`, default `dark`) is **per display**; widgets inherit CSS tokens and do not store a theme.
- `WidgetRegistry` — type definitions (spans, defaults, config validation)
- Frontend registry maps type → DOM renderer (no scattered `if (type === …)` in the renderer)

### Supported widgets (M4)

| Type | Spans | Config |
| --- | --- | --- |
| `title` | 2×1, 3×1 | `text`, `alignment`, optional `chrome` (`plain` / `card`) |
| `date-time` | 1×1, 2×1 | `mode`: time / date / date-time; optional `chrome` (`plain` / `card`) |

DateTime updates locally via `setInterval` in the browser. Timers are cleared on `destroy` / re-`applyConfiguration`.

When `widgets` is empty, the frontend still draws the grid cells and shows a localized empty-state panel with display metadata plus an invite to configure widgets from Homey App Settings.

### Persistence (official Homey only)

- Layout remains a Homey **device setting**
- Widgets live in Homey **Device Store** key `dashboard`
- App HTTP port / diagnostics remain app `ManagerSettings`
- No parallel JSON/YAML/DB stores

### Configuration update flow (M4)

```text
edit App Settings → save Device Store → refresh Wall Display → new bootstrap
```

No live push yet. `DashboardRenderer.applyConfiguration` is reusable for a future realtime channel.

### Localization

- Manifest / driver / settings labels: `en` + `it` in compose JSON
- Pairing, HTTP pages, dashboard errors, diagnostics, editor: `/locales/en.json` and `/locales/it.json`

### What is intentionally not here

No Homey capability control, no Flow, no WebSocket, no drag & drop, no advanced visual editor, no cameras/overlays, no Vue/React/Angular/Svelte.
