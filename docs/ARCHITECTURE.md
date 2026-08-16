# Architecture

## Milestone 0–5 foundations (still true)

`WelcomeWallApp` owns Homey app lifecycle. It starts `HttpServer` on the configured port. Logging goes through `AppLogger`. App-level persistence uses `SettingsManager` + `this.homey.settings`.

Adapters, PairingFlow, drivers, DisplayRegistry, Widget Engine, Dashboard Editor, HomeyDeviceRepository, and LightWidget contracts from earlier milestones remain in force.

## Milestone 8 — CoverWidget read-only & device visual language

```text
Homey device capability (windowcoverings_set)
        │  makeCapabilityInstance
        ▼
RealtimeSubscriptionManager  (ref-counted by deviceId + capabilityId)
        │
        ▼
normalizeWindowcoveringsSet  → positionPercent 0…100
        │
        ▼
CoverWidget runtime state → WebSocket widget-state → CoverWidgetRenderer
```

### CoverWidget

- Persist only `{ deviceId }`.
- Compatible when Homey device has official `windowcoverings_set`.
- Homey raw value is a number in `[0, 1]` (0 closed, 1 open). Backend normalizes to integer percent for the frontend.
- UI: device name, `NN%`, vertical bar (fill height = percent), decorative shutter icon.
- Read-only in this milestone — no commands.

### Shared device visual language

LightWidget and CoverWidget share:

- CSS classes `device-widget`, `device-widget__name`, `device-widget__state`, `device-widget__icon`
- Inline SVG decorative icons (top-right, low opacity, non-interactive)

They remain **separate** widget types — no monolithic `DeviceWidget` class.

### Subscriptions

`extractReferencedCapabilitySubscriptions` yields `(deviceId, capabilityId)` pairs:

- LightWidget → `onoff`
- CoverWidget → `windowcoverings_set`

Reference counting is per pair so two displays showing the same cover share one Homey listener.

## Milestone 6 — WebSocket realtime & live dashboard synchronization

```text
Homey device capability (onoff)
        │  makeCapabilityInstance  (permission homey:manager:api)
        ▼
RealtimeSubscriptionManager  (ref-counted, selective)
        │
        ▼
RealtimeGateway
        │
        ├─ DisplayRealtimeSession (1 socket ↔ 1 Display)
        ├─ typed ServerMessage / ClientMessage protocol
        └─ shared HTTP port upgrade (/realtime)
                │
Wall Display browser
        │
        ├─ RealtimeClient (reconnect + backoff)
        ├─ ConnectionOverlay (global, not a grid cell)
        ├─ applyConfiguration(full config)
        └─ updateWidgetState(widgetId, state)
```

### Shared HTTP / WebSocket port

Default port `7999` (configurable in App Settings).

| Path | Behavior |
| --- | --- |
| `GET /` | Recognize client; serve dashboard HTML bootstrap |
| `GET /dashboard.css` / `GET /dashboard.js` | Built vanilla assets |
| `GET /diagnostics` | Runtime diagnostics if enabled; otherwise **403** |
| `WS /realtime` | Display-bound WebSocket (upgrade on the same server) |
| other | 404 / upgrade rejected |

Port change restarts HTTP and re-attaches the WebSocket gateway. Sessions and heartbeat timers are closed first.

### Display recognition for WebSocket

Same trust model as HTTP: client IP → `DisplayRegistry.findByIp`. Unknown IPs are rejected (no upgrade / no subscriptions). A Display never receives another Display’s configuration.

### Protocol (discriminated unions)

Server → client: `dashboard-snapshot` | `dashboard-configuration` | `widget-state` | `heartbeat` | `command-accepted` | `command-rejected` | `command-timeout` | `error`  
Client → server: `client-ready` | `heartbeat-ack` | `widget-action`

`REALTIME_PROTOCOL_VERSION = 1` is embedded in snapshots.

### Snapshot & reconnect

After open + Display binding, the server sends a **full snapshot** (configuration + widget runtime states). On reconnect there is **no event replay** — a new snapshot replaces frontend state. The connection overlay stays until the snapshot is applied. Pending commands are cleared on disconnect and never replayed.

### Live configuration sequence

```text
validate → save Device Store → update DisplayRegistry
  → subscription diff → resolve runtime → send dashboard-configuration
  → frontend applyConfiguration()
```

Offline displays receive nothing (no infinite queues). They get the latest config on the next snapshot.

### RealtimeSubscriptionManager

- Extracts referenced Homey capability subscriptions from the dashboard (`LightWidget` → `onoff`, `CoverWidget` → `windowcoverings_set`).
- Diffs old vs new `(deviceId, capabilityId)` pairs; subscribe/unsubscribe only the delta.
- Reference-counts shared devices/capabilities across Displays.
- Routes capability events only to interested Display sessions.

### Online / offline

A Display is **online** only while it has an active realtime WebSocket session. HTTP `lastSeen` remains diagnostic. Runtime only — not persisted.

### Duplicate sockets

**Newest connection wins.** Opening a second WebSocket for the same Display closes the previous session.

### Heartbeat

Server sends `heartbeat` every 20s; client replies `heartbeat-ack`. Missing ack within 45s closes the zombie socket. Timers are cleared on close / port restart / app uninit.

## Milestone 7 — Bidirectional commands & interactive LightWidget

```text
LightWidget tap
        │
        ▼
WidgetInteractionController  (gesture → widget intent)
        │  widget-action { widgetId, action: 'toggle', requestId }
        ▼
RealtimeGateway
        │
        ▼
WidgetCommandHandler
        │  validate Display session + widget ownership + type + action
        │  resolve deviceId from dashboard config (never from client)
        │  derive target from Homey current onoff
        │
        ├─ PendingCommandManager (timeout 4000 ms)
        └─ HomeyDeviceRepository.setCapabilityValue('onoff', target)
                │
                ▼
Homey realtime onoff event
        │
        ▼
confirm if value === expected → clear pending + widget-state
mismatch → clear pending + widget-state + command-rejected(unexpected_state)
timeout → command-timeout (keep previous real state)
```

### Security model

The browser may only send **widget intents**. It cannot choose `deviceId`, capability, or value. The backend resolves:

```text
widgetId → current Display dashboard → LightWidget.config.deviceId → allowed action
```

### Pending vs real state

The tile always paints Homey-confirmed `on` / `off` / `unavailable`. Pending and error are **overlays** (`widget-light--state-pending` / `widget-light--state-error`), never a substitute for real state.

### Concurrent commands

One pending command per Display+widget. Further taps are ignored client-side and rejected server-side (`already_pending`). No queue, no offline buffer, no auto-retry.

### Frontend

- `RealtimeClient` owns the socket and wires `WidgetInteractionController`.
- `LightWidget` uses the full tile as the tap target (`role="button"`).
- Gesture map is extensible (`tap` today; `double-tap` / `long-press` / `swipe` reserved).

### What is intentionally not here

No dimmer/color/temperature, no long-press/double-tap, no popups, no Flow, no notifications, no cameras, no Socket.IO, no polling of Homey state.
