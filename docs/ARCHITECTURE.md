# Architecture

## Milestone 0–5 foundations (still true)

`WelcomeWallApp` owns Homey app lifecycle. It starts `HttpServer` on the configured port. Logging goes through `AppLogger`. App-level persistence uses `SettingsManager` + `this.homey.settings`.

Adapters, PairingFlow, drivers, DisplayRegistry, Widget Engine, Dashboard Editor, HomeyDeviceRepository, and LightWidget contracts from earlier milestones remain in force.

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

Server → client: `dashboard-snapshot` | `dashboard-configuration` | `widget-state` | `heartbeat` | `error`  
Client → server: `client-ready` | `heartbeat-ack`

`REALTIME_PROTOCOL_VERSION = 1` is embedded in snapshots.

### Snapshot & reconnect

After open + Display binding, the server sends a **full snapshot** (configuration + widget runtime states). On reconnect there is **no event replay** — a new snapshot replaces frontend state. The connection overlay stays until the snapshot is applied.

### Live configuration sequence

```text
validate → save Device Store → update DisplayRegistry
  → subscription diff → resolve runtime → send dashboard-configuration
  → frontend applyConfiguration()
```

Offline displays receive nothing (no infinite queues). They get the latest config on the next snapshot.

### RealtimeSubscriptionManager

- Extracts referenced Homey device ids from the dashboard (`LightWidget.deviceId`).
- Diffs old vs new ids; subscribe/unsubscribe only the delta.
- Reference-counts shared devices across Displays.
- Routes capability events only to interested Display sessions.

### Online / offline

A Display is **online** only while it has an active realtime WebSocket session. HTTP `lastSeen` remains diagnostic. Runtime only — not persisted.

### Duplicate sockets

**Newest connection wins.** Opening a second WebSocket for the same Display closes the previous session.

### Heartbeat

Server sends `heartbeat` every 20s; client replies `heartbeat-ack`. Missing ack within 45s closes the zombie socket. Timers are cleared on close / port restart / app uninit.

### Frontend

- `RealtimeClient` connects to `ws(s)://host/realtime`.
- Global `ConnectionOverlay` for lost connection / reconnecting.
- `DashboardRenderer.updateWidgetState` patches LightWidget without full rebuild.
- `applyConfiguration` replaces the full widget set atomically (DateTime timers cleaned up).

### What is intentionally not here

No ON/OFF control from the display, no dimmer/color, no Flow, no notifications, no cameras, no Socket.IO, no polling of Homey state.
