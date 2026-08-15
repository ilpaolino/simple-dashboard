# Architecture

## Milestone 0–4 foundations (still true)

`WelcomeWallApp` owns Homey app lifecycle. It starts `HttpServer` on the configured port. Logging goes through `AppLogger`. App-level persistence uses `SettingsManager` + `this.homey.settings`.

Adapters (`ShellyWallDisplayAdapter`, `GenericWebDisplayAdapter`) remain the only place protocol details live. Pairing orchestration stays in `PairingFlow`.

Drivers `shelly_wall_display` and `generic_web_display` stay thin. `DisplayRegistry` is a runtime projection of Homey Devices (source of truth).

The Widget Engine, Dashboard Editor, TitleWidget, and DateTimeWidget from Milestone 4 remain unchanged in contract. LightWidget is an additional registry entry.

## Milestone 5 — Homey Device Data Layer & read-only LightWidget

```text
Homey devices / zones
        │  HomeyAPI.createAppAPI  (permission homey:manager:api)
        ▼
HomeyDeviceRepository
        │
        ├─ Light compatibility (capability onoff)
        ├─ editor DTO: { id, name, zoneName }
        └─ runtime snapshot resolver
                │
Homey App Settings (Dashboard Editor)
        │  Homey.api → api.ts → WelcomeWallApp
        │  LightWidget stores only { deviceId }
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
        │           ├─ HomeyDeviceRepository.listDevices()  (once, at load)
        │           ├─ resolve LightWidget runtime (name, available, on)
        │           ├─ DashboardBootstrap DTO (config + widgetRuntime)
        │           └─ dashboard HTML (+ /dashboard.css, /dashboard.js)
        │
        ▼
Vanilla frontend
        │
        ├─ DashboardRenderer.applyConfiguration(config)
        ├─ DashboardRenderer.updateWidgetState(widgetId, state)  (ready, unused)
        ├─ FrontendWidgetRegistry → Title / DateTime / Light renderers
        └─ per-widget try/catch (a broken LightWidget does not block others)
```

### HTTP routes

| Path | Behavior |
| --- | --- |
| `GET /` | Recognize client; serve dashboard with widgets + Homey snapshot or error/unconfigured pages |
| `GET /dashboard.css` | Built vanilla stylesheet (tokens + widgets) |
| `GET /dashboard.js` | Built vanilla grid + widget engine (IIFE) |
| `GET /diagnostics` | Runtime diagnostics if enabled; otherwise **403** |
| other | 404 |

### Homey Web API (App Settings editor)

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/displays` | List wall displays for the editor |
| `GET` | `/displays/:displayId/dashboard` | Load grid + widgets + widget type metadata + compatible light devices |
| `PUT` | `/displays/:displayId/dashboard` | Validate placement **and** LightWidget Homey bindings, then persist |

### Backend → frontend contract

```ts
interface DashboardBootstrap {
  readonly displayId: string;
  readonly layout: { readonly rows: number; readonly columns: number };
  readonly widgets: readonly WidgetInstance[];
  readonly widgetRuntime: Readonly<Record<string, WidgetRuntimeState>>;
  readonly theme: 'dark' | 'light';
  readonly locale: string;
  readonly copy: DashboardUiCopy;
}
```

Embedded in the HTML as `<script type="application/json" id="dashboard-bootstrap">`.

Persisted widget config and runtime state stay distinct:

```text
Widget configuration   (Device Store: deviceId only)
        +
Widget runtime state   (Homey snapshot at bootstrap)
```

`DashboardRenderer.updateWidgetState(widgetId, state)` exists so a future realtime channel can patch LightWidget without rewriting the renderer. Milestone 5 does not call it after load.

### HomeyDeviceRepository

- `listDevices()` / `getDevice(id)` / `listCompatibleLightDevices()`
- Normalizes Homey Web API devices: id, name, zoneId, zoneName, available, capabilities, capability values
- Zone names come from `zones.getZones()` joined on `device.zone`
- Missing zone → `zoneName: null` (editor shows localized “No zone” / “Nessuna zona”)
- No long-lived device cache; each dashboard load and editor open hits Homey again

The frontend never calls Homey. Compatibility (`onoff`) is decided server-side.

### LightWidget

| | |
| --- | --- |
| Type | `light` |
| Span | `1×1` only |
| Persisted config | `{ deviceId }` |
| Runtime DTO | `{ type, deviceId, name, available, on, error }` |
| Visual states | `on` / `off` / `unavailable` (CSS: `state-on`, `state-off`, `state-unavailable`) |

A removed, unreachable, unavailable, or no-longer-`onoff` device does **not** delete the widget. It stays visible as “Device unavailable” / “Device non disponibile”.

### Supported widgets (M5)

| Type | Spans | Config | Runtime |
| --- | --- | --- | --- |
| `title` | 2×1, 3×1 | `text`, `alignment`, optional `chrome` | none |
| `date-time` | 1×1, 2×1 | `mode`; optional `chrome` | browser `setInterval` (clock only) |
| `light` | 1×1 | `deviceId` | Homey snapshot at load |

DateTime updates locally via `setInterval` in the browser. LightWidget has **no** timer, polling, WebSocket, SSE, or Homey capability listener.

### Persistence (official Homey only)

- Layout remains a Homey **device setting**
- Widgets live in Homey **Device Store** key `dashboard`
- App HTTP port / diagnostics remain app `ManagerSettings`
- Homey devices/zones are read via official Homey Web API (`homey-api`)
- No parallel JSON/YAML/DB stores

### Localization

- Manifest / driver / settings labels: `en` + `it` in compose JSON
- Pairing, HTTP pages, dashboard errors, diagnostics, editor, LightWidget: `/locales/en.json` and `/locales/it.json`

### What is intentionally not here

No ON/OFF control, no dimmer, no color, no color temperature, no WebSocket/SSE/polling, no Homey realtime listeners, no Flow, no notifications, no overlay, no Vue/React/Angular/Svelte.
