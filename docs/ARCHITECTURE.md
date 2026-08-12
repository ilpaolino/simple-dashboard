# Architecture

## Milestone 0 (unchanged)

`WelcomeWallApp` still owns only Homey app lifecycle. It starts `HttpServer` on the configured port and serves `renderWelcomePage`. Logging goes through `AppLogger`. App-level persistence uses `SettingsManager` + `this.homey.settings`.

See [MILESTONE-0.md](MILESTONE-0.md) for the HTTP server details.

## Milestone 1 — Wall Display

```text
Homey UI (pairing views + Advanced settings)
        │
        ▼
drivers/wall_display/driver.ts    PairingFlow.bind(session)
        │
        ▼
lib/pairing/PairingFlow           session state (IP, identify result, adapter)
        │
        ▼
lib/adapters/AdapterRegistry      first matching auto-identify adapter wins
        ├── ShellyWallDisplayAdapter   GET /rpc/Shelly.GetDeviceInfo
        └── GenericWebDisplayAdapter   never probes
        │
        ▼
Homey.createDevice({ data, store, settings })
        │
        ▼
drivers/wall_display/device.ts    onInit / onSettings
```

### Driver / Device

| Component | Responsibility |
| --- | --- |
| `WallDisplayDriver` | Homey driver lifecycle + `onPair` wiring |
| `PairingFlow` | Pairing session state machine; no Homey HTML |
| `WallDisplayDevice` | Reads official `data` / `store` / `settings`; validates setting changes |
| `AdapterRegistry` | Adapter lookup and identification order |
| `ShellyWallDisplayAdapter` | Shelly RPC only |
| `GenericWebDisplayAdapter` | Manual fallback; no protocol |

The driver does not know Shelly HTTP details. The Shelly adapter does not know Homey pairing views.

### Pairing flow

Official custom pairing uses a **single** view (`enter_ip.html`) with in-page steps
(IP → confirm **or** manual adapter). Pairing HTML must **not** load `/homey.js`
(Homey injects the API). After init, `Homey.setNavigationClose()` makes chrome
Close-only; the primary CTA is the in-page **Collegati** / **Connect** button.


### Persistence (official Homey only)

| Data | Homey API | Why |
| --- | --- | --- |
| Stable device id | `data.id` | Identity; must not be the IP ([pairing docs](https://apps.developer.homey.app/the-basics/devices/pairing)) |
| IP, layout, adapter label, detected info | Device **settings** | User-visible Advanced settings ([device settings](https://apps.developer.homey.app/the-basics/devices/settings)) |
| `adapterId`, `adapterAutoDetected`, `configuration` | Device **store** | Structured config not suited to a single setting field ([device store](https://apps.developer.homey.app/the-basics/devices)) |
| HTTP port | App `ManagerSettings` | Unchanged from M0 |

After pairing, `configuration` is a stored snapshot. Layout changes update that snapshot; they do not re-query the adapter.

### Settings UI

Device configuration uses **only** `driver.settings.compose.json` types (`text`, `label`, `dropdown`, `group`). No custom device settings HTML.

- **IP** — `text`, editable, highlighted
- **Adapter** — `label` (read-only in Homey UI; set at pairing)
- **Manufacturer / model / firmware / serial** — `label`
- **Layout** — `dropdown` (`2x2`, `3x3`, `2x4`, `3x6`); `onSettings` rejects layouts not listed in the stored configuration

App HTTP port settings remain the official custom app settings view (`/settings/index.html`). That is app-level, not device-level.

### Adapters

Each adapter:

- declares `canAutoIdentify`
- implements `tryIdentify(ip)` for its own protocol (or returns `null` immediately)
- declares supported layouts
- produces an initial `DeviceConfiguration`

Adding a future adapter means: new class + register it in `createDefaultAdapterRegistry()`. Pairing views already list adapters from the registry.

### Localization

- Manifest / driver / settings labels: `en` + `it` in compose JSON (Homey native)
- Pairing views, errors, app settings: `/locales/en.json` and `/locales/it.json` with `data-i18n` and `this.homey.__`

### What is intentionally not here

No dashboard renderer, no Vue, no widgets, no Flow, no WebSocket, no Homey ManagerDevices control API, no capability listeners for lights/switches.
