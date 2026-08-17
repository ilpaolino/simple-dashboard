# Architecture

## Milestone 0–5 foundations (still true)

`WelcomeWallApp` owns Homey app lifecycle. It starts `HttpServer` on the configured port. Logging goes through `AppLogger`. App-level persistence uses `SettingsManager` + `this.homey.settings`.

Adapters, PairingFlow, drivers, DisplayRegistry, Widget Engine, Dashboard Editor, HomeyDeviceRepository, and LightWidget contracts from earlier milestones remain in force.

## Milestone 11 — Notification Center

```text
Homey Flow / Web API
        │  upsert / remove by key / remove all
        ▼
NotificationManager
        │  active notifications + key index (displayId + key)
        │  autoOpen / autoCloseSeconds / optional action (M12)
        │  optional media descriptor (M13; no Device ids / URLs on the wire)
        │  Map<displayId, Set<notificationId>> dismissed (runtime)
        │
        ▼
RealtimeGateway
        │
        ├─ dashboard-snapshot.notifications (visible only; no auto-open storm)
        ├─ notification-added | notification-updated | notification-removed
        ├─ client: notification-dismiss | notification-center-opened
        ├─ client: notification-auto-opened | notification-auto-closed
        └─ client: notification-action → validate → Device Flow Trigger
                │
Wall Display
        │
        ├─ NotificationController (visible array, carousel index)
        ├─ NotificationIndicator (corner ribbon, max severity color)
        └─ NotificationCenter (modal carousel, swipe, highlight, auto-close, CTA)
```

### Milestone 12 — Lifecycle & actions (incremental)

```text
Show notification (simple Flow, M11B)
  args: key, title, message, severity, icon, highlight, dismissable
  → autoOpen=true, no auto-close, no action

Show interactive notification (M12)
  args: … + auto_open, auto_close_seconds, enable_action, action_id, action_label, action_text
        │
        ▼
NotificationManager.upsertForDisplay
        │
        ▼
Realtime push (if online)
        │  autoOpen? → open Center; autoCloseSeconds? → one timer + CSS progress
        │  media? → start only while Center shows that notification (M13)
        │
User presses CTA
        │
notification-action { notificationId, notificationKey, actionId, requestId }
        │
Backend resolveNotificationAction (SoT authoritative)
        │
Device trigger notification_action_pressed (filter Action ID via args/state)
        │
tokens: notificationKey, actionId, actionLabel, actionText, notificationTitle, notificationMessage
```

Action ID is a routing key you invent (`open-gate`): same string on SHOW and on WHEN, so Homey can tell taps apart. It is not a Homey device. See [MILESTONE-12.md](MILESTONE-12.md#what-action-id-is-for).

### Milestone 13 — Camera media (incremental)

```text
Show notification (+ optional Camera / Media autocomplete)
        │
        ▼
NotificationMediaResolver
  Device.images / Device.videos (defensive parse)
        │  public NotificationMedia (hasImage / hasVideo / videoPlayable / playback)
        │  backend mediaBinding.deviceId (never on the wire)
        ▼
Notification Center
        │  visible + open → NotificationMediaController start
        │  closed / swipe / auto-close → stop + cleanup
        ▼
GET /notification-media/:id/image  (port 7999, Display IP scoped)
GET /notification-media/:id/video  (415 — no transcoding)
```

Homey camera video types (RTSP / WebRTC / HLS / DASH / RTMP) are **detected** but not piped to `<video>`. When Homey also exposes an image, that snapshot is shown and refreshed every 3 s while the Center is open. See [MILESTONE-13.md](MILESTONE-13.md).

### Milestone 14 — Shelly hardware discovery & reboot

```text
Pairing / App startup / Maintenance action
        │
        ▼
ShellyHardwareCoordinator (sequential per display, no polling)
        │
        ▼
ShellyWallDisplayHardwareService
        │
        ▼
ShellyWallDisplayRpcClient
        │  GET /rpc/Shelly.ListMethods  (discovery)
        │  GET /rpc/Shelly.Reboot       (command)
        ▼
ShellyHardwareProfileStore (runtime RAM)
        │
        ├─ Device Settings read-only labels
        ├─ /diagnostics hardware section
        └─ Flow Action shelly_reboot_display (Shelly driver only)
```

Normalized features are derived from discovered RPC method names in `lib/shelly/mapFeatures.ts`. **Unknown** (discovery failed) differs from **unsupported** (method absent after successful discovery). Generic Web Display never uses this stack. See [MILESTONE-14.md](MILESTONE-14.md).

### Milestone 11B — Homey Flow (incremental)

```text
Homey Flow Action Card (THEN)
        │  device arg filtered to Shelly | Generic
        ▼
registerNotificationFlowCards (thin parse/validate)
        │
        ▼
WelcomeWallApp → NotificationManager.upsertForDisplay / removeByKey / removeAllForDisplay
        │
        ├─ realtime push (if Display online)
        └─ setCapabilityValue(notification_count, highest_notification_severity)
```

Flow cards are defined per driver under `drivers/*/driver.flow.compose.json`.
Homey Compose injects `device` + `driver_id` so cards appear under that Wall Display in Flow
(including Generic Web Display / Shelly, `class: other`). Shelly card IDs are prefixed because
Homey requires unique Flow action IDs app-wide; run listeners are shared.
Aggregate capabilities are **state only** (SoT counts/severity). Local dismiss does not change them.

### Not widgets

Notifications never occupy grid cells. Indicator and Center are dashboard chrome overlays (z-index below the connection-lost overlay).

### Source of truth

Homey/backend decides publish / update / remove. The frontend does not invent TTLs that delete SoT notifications. Auto-close (M12) only closes the Center, and is skipped when `dismissable: false`. Local dismiss only hides on that Display; the global notification stays active until Homey removes it. Non-dismissable notifications keep the Center open (no Hide / X / backdrop).

### Snapshot & reconnect

`dashboard-snapshot` includes the visible notification list for that Display (dismiss already applied). After reconnect, the snapshot replaces the frontend list. Dismissed ids that are still active remain dismissed because dismiss state lives on the backend keyed by `displayId` (survives socket reconnect; cleared on app restart).

### Severity

Centralized priority: `critical` > `warning` > `success` > `info`. Triangle color = max severity among visible notifications.

### Highlight

CSS-only pulse using `--notification-*` tokens. `prefers-reduced-motion: reduce` disables the animation and keeps a static severity tint.

## Milestone 10 — Advanced LightWidget control panel

```text
LightWidget tile
        │
        ├─ tap ──────────────► toggle intent (unchanged M7 path)
        │
        └─ long press ───────► WidgetControlOverlay
                                      │
                                      ▼
                               LightControlPanel
                                      │  capability-driven controls
                                      │  drag = preview only
                                      │  release → one widget intent
                                      ▼
                               WidgetInteractionController
                                      │  widget-action { widgetId, action, requestId, … }
                                      ▼
                               RealtimeGateway → WidgetCommandHandler
                                      │  validate + resolve deviceId from dashboard
                                      │
                                      ├─ toggle → onoff
                                      ├─ set-dim → dim [0,1]
                                      ├─ set-temperature → light_mode? + light_temperature
                                      └─ set-color → light_mode? + light_hue + light_saturation
                                              │
                                              ▼
                               Homey realtime → command-succeeded + widget-state
```

### Gesture handling

- Centralized `LONG_PRESS_MS = 500` and `LONG_PRESS_MOVE_TOLERANCE_PX = 12` in `lib/realtime/constants.ts`.
- `PointerGestureRecognizer` uses Pointer Events; long press never emits tap; cancel / excess movement suppress both.
- Minimal tile feedback via `data-long-press` scale/opacity.

### Capability-driven panel

Runtime flags from the backend (never raw Homey ids in the browser):

```ts
{ canToggle, canDim, canSetTemperature, canSetColor }
```

`canSetColor` requires both `light_hue` and `light_saturation`. Controls that are not supported are not rendered.

### Normalized values

| Intent | Client field | Homey write |
| --- | --- | --- |
| `set-dim` | `valuePercent` 0…100 | `dim` = percent/100 |
| `set-temperature` | `valuePercent` 0 cool … 100 warm | `light_temperature` (Homey: higher = warmer) |
| `set-color` | `huePercent`, `saturationPercent` | `light_hue`, `light_saturation` |

Brightness stays on the dimmer; the color pad is hue × saturation only.

### Pending policy

One pending command per Display+widget for all light actions (toggle/dim/temperature/color). No intermediate queue. Closing the overlay does not cancel in-flight Homey writes.

### Subscriptions (M10)

Base LightWidget subscription remains `onoff`. The gateway probes the bound device and additionally subscribes to present optional capabilities: `dim`, `light_temperature`, `light_hue`, `light_saturation`, `light_mode`.

### Live config while overlay is open

Same as Cover (M9): widget removed or unsafe device rebind → overlay closes. Capability patches continue as `widget-state`.

### What is intentionally not here

No scenes, presets, animations, effects, double-click, swipe, or light groups.

## Milestone 9 — Interactive CoverWidget & position control

```text
CoverWidget tile tap
        │
        ▼
WidgetControlOverlay  (global, one at a time, outside the grid)
        │
        ▼
CoverControlPanel
        │  Pointer Events: drag = preview only
        │  release / Open / Close / Stop → widget intent
        ▼
WidgetInteractionController
        │  widget-action { widgetId, action, requestId, … }
        ▼
RealtimeGateway → WidgetCommandHandler
        │  validate session + ownership + type + action + capabilities
        │  resolve deviceId from dashboard config (never from client)
        │
        ├─ set-position → Homey windowcoverings_set [0,1]
        │     PendingCommandManager (timeout 8000 ms)
        │     confirm: ±1% of target OR first coherent progress from baseline
        │
        └─ stop → Homey windowcoverings_state = idle  (only if capability present)
              PendingCommandManager (timeout 4000 ms)
              confirm: state === idle
                │
                ▼
command-succeeded | command-rejected | command-timeout
+ widget-state (Homey remains source of truth)
```

### CoverWidget interaction flow

- Tap the CoverWidget tile → open control overlay (tile itself does **not** move the cover).
- `WidgetControlOverlay` is a reusable global shell (one overlay at a time; outside the grid; Escape / backdrop / X close).
- `CoverControlPanel` hosts: device name, current percent, pending target, vertical send-on-release slider (100% top / 0% bottom), Open (= 100%), Close (= 0%), and Stop when supported.
- Drag updates the **target preview only**. Commands are sent on pointer release (or Open/Close/Stop), never during drag.
- Current Homey position and pending target remain distinct in the UI. The tile/overlay paint Homey-confirmed percent; no movement interpolation.

### Intents

| Client action | Widget intent | Homey write |
| --- | --- | --- |
| Slider release / Open / Close | `set-position` + `positionPercent` (0…100) | `windowcoverings_set` denormalized to `[0, 1]` |
| Stop (when supported) | `stop` | `windowcoverings_state` → `idle` |

Runtime capability flags from the backend: `{ canSetPosition, canStop }`. Stop UI is shown only when Homey exposes `windowcoverings_state`.

### Confirmation semantics

| Action | Confirmation | Timeout |
| --- | --- | --- |
| `set-position` | Homey `windowcoverings_set` within **1%** of target **or** first coherent progress toward target from baseline | **8000 ms** (ack/start, not full travel) |
| `stop` | Homey `windowcoverings_state` === `idle` | **4000 ms** (may replace an in-flight set-position) |
| Light `toggle` | Unchanged (`onoff` match) | **4000 ms** |

On success the server emits `command-succeeded` (in addition to the existing accept/reject/timeout messages) so intermediate cover progress does not leave the UI stuck pending. Closing the overlay does **not** cancel in-flight Homey commands.

### Subscriptions (M9)

`extractReferencedCapabilitySubscriptions` still yields base pairs from dashboard widgets. The gateway additionally subscribes to `windowcoverings_state` when the bound Homey device exposes it (needed for Stop confirmation and `canStop`).

| Widget | Capabilities |
| --- | --- |
| LightWidget | `onoff` (+ `dim` / `light_temperature` / `light_hue` / `light_saturation` / `light_mode` when present — M10) |
| CoverWidget | `windowcoverings_set` (+ `windowcoverings_state` when present) |

Reference counting remains per `(deviceId, capabilityId)`.

### Live config while overlay is open

- Widget removed from the live configuration → overlay closes.
- Device rebind / unsafe config change → overlay closes for safety.
- Structural edits still arrive as full `dashboard-configuration`; capability patches as `widget-state`.

### What is intentionally not here

No advanced tile gestures, no light dimmer/color panels, no multi-cover groups, no timers, no simulated motion, no Flow/Scene.

## Milestone 8 — CoverWidget read path & device visual language

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
- **Milestone 9:** interactive via WidgetControlOverlay + CoverControlPanel (tile tap opens controls; see above). M8 delivered the read path and visual language that M9 extends.

### Shared device visual language

LightWidget and CoverWidget share:

- CSS classes `device-widget`, `device-widget__name`, `device-widget__state`, `device-widget__icon`
- Inline SVG decorative icons (top-right, low opacity, non-interactive)

They remain **separate** widget types — no monolithic `DeviceWidget` class.

### Subscriptions

Base extraction yields `(deviceId, capabilityId)` pairs:

- LightWidget → `onoff`
- CoverWidget → `windowcoverings_set`

Milestone 9 may add `windowcoverings_state` when present (see M9). Reference counting is per pair so two displays showing the same cover share one Homey listener.

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
| `GET /notification-media/:id/image` | Display-scoped snapshot bytes for the current notification binding |
| `GET /notification-media/:id/video` | **415** (no transcoding / RTSP proxy) |
| `WS /realtime` | Display-bound WebSocket (upgrade on the same server) |
| other | 404 / upgrade rejected |

Port change restarts HTTP and re-attaches the WebSocket gateway. Sessions and heartbeat timers are closed first.

### Display recognition for WebSocket

Same trust model as HTTP: client IP → `DisplayRegistry.findByIp`. Unknown IPs are rejected (no upgrade / no subscriptions). A Display never receives another Display’s configuration.

### Protocol (discriminated unions)

Server → client: `dashboard-snapshot` | `dashboard-configuration` | `widget-state` | `notification-snapshot` | `notification-added` | `notification-updated` | `notification-removed` | `heartbeat` | `command-accepted` | `command-rejected` | `command-timeout` | `command-succeeded` | `error`  
Client → server: `client-ready` | `heartbeat-ack` | `widget-action` | `notification-dismiss` | `notification-center-opened` | `notification-auto-opened` | `notification-auto-closed` | `notification-action` | `notification-media-start` | `notification-media-stop` | `notification-media-telemetry`

`widget-action` actions include `toggle`, `set-dim`, `set-temperature`, `set-color` (light), `set-position` (cover + `positionPercent`), and `stop` (cover, when supported).

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

- Extracts referenced Homey capability subscriptions from the dashboard (`LightWidget` → `onoff` plus optional light caps when present, `CoverWidget` → `windowcoverings_set`, plus `windowcoverings_state` when present for Stop).
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
confirm if value === expected → clear pending + command-succeeded + widget-state
mismatch → clear pending + widget-state + command-rejected(unexpected_state)
timeout → command-timeout (keep previous real state)
```

### Security model

The browser may only send **widget intents**. It cannot choose `deviceId`, capability, or value. The backend resolves:

```text
widgetId → current Display dashboard → widget.config.deviceId → allowed action
```

Cover intents (`set-position` / `stop`) use the same model; position percent is validated and denormalized server-side.

### Pending vs real state

The tile always paints Homey-confirmed state. Pending and error are **overlays**, never a substitute for real state. Cover current percent and pending target stay distinct (see M9).

### Concurrent commands

One pending command per Display+widget. Further taps are ignored client-side and rejected server-side (`already_pending`), except cover **stop** which may replace an in-flight set-position. No queue, no offline buffer, no auto-retry.

### Frontend

- `RealtimeClient` owns the socket and wires `WidgetInteractionController`.
- `LightWidget` uses the full tile as the tap target (`role="button"`); long-press opens `LightControlPanel` (M10).
- `CoverWidget` uses the tile tap to open `WidgetControlOverlay` (M9); commands leave the panel, not the tile chrome.
- Gesture map: `tap` / `long-press` implemented where needed; `double-tap` / `swipe` reserved.

### What is intentionally not here

No scenes/presets/effects for lights (M10 deferred). Cover control overlays are Milestone 9 (above). Light advanced panel is Milestone 10 (above).

