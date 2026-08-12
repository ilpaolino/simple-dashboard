# Architecture

## Milestone 0–1 foundations (still true)

`WelcomeWallApp` owns Homey app lifecycle. It starts `HttpServer` on the configured port. Logging goes through `AppLogger`. App-level persistence uses `SettingsManager` + `this.homey.settings`.

Adapters (`ShellyWallDisplayAdapter`, `GenericWebDisplayAdapter`) remain the only place protocol details live. Pairing orchestration stays in `PairingFlow`.

## Milestone 2 — Display Registry, recognition, diagnostics

```text
Homey Devices (source of truth)
        │  onInit / onSettings / onDeleted
        ▼
DisplayRegistry (runtime only)
        ▲
HTTP GET /  ──► DisplayRequestHandler
        │           │
        │           ├─ IP normalize + findByIp
        │           ├─ Shelly hardware identity check (optional)
        │           └─ technical HTML page
        │
HTTP GET /diagnostics ──► diagnostics HTML (if enabled)
```

### Drivers (type chosen before pairing)

| Driver id | Pairing | Matching |
| --- | --- | --- |
| `shelly_wall_display` | IP → `Shelly.GetDeviceInfo` → confirm | IP + hardware id |
| `generic_web_display` | IP → create | IP only |

There is no longer a single generic `wall_display` driver with an `adapterType` setting. Homey “Add device” lists both drivers.

Shared core lives under `lib/` (registry, session, HTTP pages, adapters, pairing). Drivers only wire Homey lifecycle + pairing mode.

### DisplayRegistry

- Rebuilt from Homey Devices as they `onInit`
- Updated on settings changes; removed on `onDeleted`
- Holds runtime-only fields: `lastSeenAt`, session, last match status
- Never persists runtime state

### Online strategy

A display is **online** if `lastSeenAt` is within the last **5 minutes** (`DISPLAY_ONLINE_TIMEOUT_MS`). Online state is derived only from successful recognition on `/` (or equivalent touch). No separate heartbeat.

### HTTP routes

| Path | Behavior |
| --- | --- |
| `GET /` | Recognize client by IP (+ Shelly identity when applicable) |
| `GET /diagnostics` | Runtime diagnostics if `diagnosticsEnabled` is true; otherwise **403** with a localized disabled page |
| other | 404 |

### Persistence (official Homey only)

| Data | Homey API |
| --- | --- |
| Stable device id | Device `data.id` |
| IP, layout, Shelly labels | Device **settings** |
| `adapterId`, configuration snapshot | Device **store** |
| HTTP port, diagnostics enabled | App `ManagerSettings` |

### Localization

- Manifest / driver / settings labels: `en` + `it` in compose JSON
- Pairing, HTTP pages, errors, app settings: `/locales/en.json` and `/locales/it.json`

### What is intentionally not here

No dashboard renderer, no Vue, no widgets, no Flow, no WebSocket, no Homey ManagerDevices control API, no Shelly reboot/brightness/volume commands.
