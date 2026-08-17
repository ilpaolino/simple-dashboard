# Diagnostics

The diagnostics page is a **production support surface** for LocalDashboard. It helps verify recognition, connectivity, subscriptions, commands, notifications, and memory — without exposing secrets.

## Enable

**Homey → Apps → LocalDashboard → App Settings → Enable diagnostics**

When disabled, `GET /diagnostics` returns **403**.

When enabled, open from any LAN browser:

```text
http://<HOMEY_LAN_IP>:7999/diagnostics
```

Diagnostics use the same HTTP port as the dashboard.

## What diagnostics is / is not

| Diagnostics is | Diagnostics is not |
| --- | --- |
| Runtime status snapshot | A configuration editor |
| Bounded recent history | An unlimited event log |
| Safe for LAN operators | Exposed to the internet by default |

## Sections (conceptual)

Exact fields may evolve; v1 includes:

### Process & server

- Memory (RSS, heap) from Node `process.memoryUsage()`
- HTTP server listening status
- Configured port
- Process uptime

### Configured Displays

- Name, type (Shelly / Generic), configured IP
- Layout id, grid size
- Online/offline (WebSocket session)
- Last HTTP seen (supplementary)
- Widget types in dashboard config
- Theme

### Realtime / WebSocket

- Active session count per Display
- Connection ids, remote addresses
- Heartbeat metrics
- Message counters

### Subscriptions

- Active Homey capability subscriptions
- `(deviceId, capabilityId)` keys
- Reference counts and which Display ids share each

### Widget / command lifecycle

- Pending commands
- Recent command accept/reject/timeout/success
- Light/cover command counters

### Notifications

- Active notification counts by severity
- Notifications with media
- Flow message counters
- Dismiss state is **not** global SoT — diagnostics focus on backend active set

### Media

- Active media sessions (should be **0** when Center closed)

### Generic pairing

- Pending pairing sessions count
- **Masked** pairing codes (not full six digits)
- Expiry times, client IP
- Successful/rejected/expired counters

### Generic browser capabilities

- Latest `generic-client-hello` per online Generic display (viewport, touch, user agent summary)

### Shelly hardware

- Discovery status: supported / unsupported / **unknown**
- Reboot support
- RPC method count
- Last discovery time, last error

## Sensitive data protections

Diagnostics **must not** show:

- Homey API tokens
- Camera credentials or RTSP URLs
- Full pairing codes (masked)
- Complete internal error stacks to browsers (generic failure message on render errors)

## Using diagnostics

| Question | Look at |
| --- | --- |
| Is Display recognized? | Configured Displays + IP |
| Is WebSocket up? | Realtime sessions, online status |
| Why no live updates? | Subscriptions, session count |
| Stuck pending light? | Pending commands, recent history |
| Notification not on wall? | Notification section + Display online |
| Memory growth? | RSS/heap before/after stress |
| Shelly reboot missing? | Hardware discovery = unknown vs unsupported |

## Resource check workflow

Before and after repeated use (connect/disconnect, notifications, media):

1. Note RSS / heapUsed
2. Note active WS sessions (= connected Displays)
3. Note subscription count
4. Note active media sessions (= 0 when idle)
5. Note pending commands (= 0 when idle)

Look for **return toward baseline**, not a fixed RAM threshold.

<!-- TODO screenshot: Diagnostics page -->

## Related

- [Getting started](getting-started.md)
- [Troubleshooting](troubleshooting.md)
- [Data & persistence](data-and-persistence.md)
