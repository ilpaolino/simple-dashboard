# Realtime synchronization

LocalDashboard keeps open Displays in sync with Homey using **HTTP bootstrap** plus a **WebSocket** channel on the same TCP port.

## Endpoints

| Path | Role |
| --- | --- |
| `GET /` | HTML shell + dashboard bootstrap JSON |
| `GET /dashboard.css`, `/dashboard.js` | Static assets |
| `WS /realtime` | Bidirectional sync and commands |

Default port: **7999** (configurable in App Settings).

## Connection lifecycle

```text
1. Browser loads HTTP page (bootstrap: config, widget states, locale, notifications)
2. Frontend opens WebSocket to ws://HOMEY:7999/realtime
3. Server matches client IP → Display device
4. Server sends dashboard-snapshot (full state, protocol version 1)
5. Connection overlay hides only after snapshot applied
6. Incremental widget-state + notification messages
7. Heartbeat every 20 s; client replies heartbeat-ack (45 s timeout)
```

If the WebSocket drops, a **connection lost overlay** covers the grid until step 4 succeeds again.

## Homey → Display path

```text
Homey device capability change
        ↓
makeCapabilityInstance (backend, homey:manager:api)
        ↓
RealtimeSubscriptionManager (selective, ref-counted)
        ↓
RealtimeGateway routes to interested Display sessions
        ↓
WebSocket widget-state { widgetId, state }
        ↓
Frontend updates tile (no full grid rebuild)
```

### Selective subscriptions

Only Homey devices and capabilities **referenced by widgets** on a Display are subscribed. LocalDashboard does not subscribe to your entire Homey device list.

### Reference counting

If two widgets (or two Displays) need the same `(deviceId, capabilityId)`, LocalDashboard shares **one** Homey listener and tracks reference counts. Unsubscribe when count reaches zero.

Example capability pairs:

| Widget | Subscribed capabilities |
| --- | --- |
| Light | `onoff` + optional `dim`, `light_temperature`, `light_hue`, `light_saturation`, `light_mode` |
| Cover | `windowcoverings_set` + optional `windowcoverings_state` |

## Display → Homey path (commands)

```text
User gesture (tap, slider release, …)
        ↓
widget-action { widgetId, action, requestId, … }
        ↓
WidgetCommandHandler validates session + ownership + action
        ↓
Resolves deviceId from dashboard config (never from client body alone)
        ↓
Homey setCapabilityValue
        ↓
Pending timer (4–8 s depending on action)
        ↓
Homey capability event confirms or rejects
        ↓
command-succeeded | command-rejected | command-timeout
```

One **pending command per widget** at a time (cover stop may interrupt set-position).

## Reconnect and snapshots

There is **no event replay** and **no offline command queue**.

| Event | Behavior |
| --- | --- |
| Disconnect | Pending commands cleared; overlay shown |
| Reconnect | New **full snapshot** replaces frontend state |
| Missed capability events while offline | Corrected by snapshot values |

This is intentional: avoids unbounded buffers and surprising delayed toggles after hours offline.

## Duplicate connections

If the same Display opens a second WebSocket, the **newest connection wins**. The older socket is closed. Subscriptions remain tied to the active session.

## Live configuration updates

When you **Save** in the Dashboard Editor:

```text
Validate → persist Device Store → update registry
  → diff capability subscriptions
  → resolve widget runtime states
  → send dashboard-configuration to connected Display
  → frontend applyConfiguration()
```

Structural changes replace the full widget list. Capability patches use lightweight `widget-state` messages.

### Overlay safety

If a **Light** or **Cover** control overlay is open and that widget is removed or unsafe rebound, the overlay **closes automatically**.

## Generic pairing socket

Unknown IPs may connect before pairing with a **restricted** WebSocket (pairing completed, generic-client-hello only). Widget commands and notification actions are **not** processed until the Display is paired.

## Protocol version

`REALTIME_PROTOCOL_VERSION = 1` is included in snapshots for future compatibility checks.

## Related

- [Widgets](widgets.md) — interaction details
- [Notifications](notifications.md) — notification messages on same socket
- [Data & persistence](data-and-persistence.md) — what is not replayed
- [ARCHITECTURE.md](ARCHITECTURE.md) — technical deep dive
