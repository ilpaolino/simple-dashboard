# Decisions

Architectural choices for Milestone 2. Earlier decisions remain in [MILESTONE-0.md](MILESTONE-0.md) and the Milestone 1 section below where still applicable.

## Homey is Source of Truth

**Choice:** `DisplayRegistry` is an in-memory projection of Homey Devices. Devices register on `onInit`, update on `onSettings`, and unregister on `onDeleted`.

**Why:** Homey already persists devices via official `data` / `store` / `settings`. A second persisted registry would create orphans and drift. After restart the registry is empty until Homey Devices re-init.

## Runtime state is not persisted

**Choice:** `lastSeenAt`, online/offline, `DisplaySession`, match status, and diagnostics error buffer live only in RAM.

**Why:** The milestone requires that after Homey/app restart every display starts without runtime state and becomes online only on a new HTTP request.

## Separate Homey Drivers

**Choice:** Two drivers — `shelly_wall_display` and `generic_web_display`. The former Wall Display mega-driver with manual adapter selection is removed.

**Why:** Homey’s Add Device flow is the documented place to choose device type before pairing ([Devices](https://apps.developer.homey.app/the-basics/devices)). Sharing code stays in `lib/`; drivers stay thin.

## IP is routing, not identity

**Choice:** Client IP (normalized, including `::ffff:` stripping) selects the configured display at request time. Identity remains `data.id`.

**Why:** Homey pairing docs forbid using IP as the unique device property ([Pairing](https://apps.developer.homey.app/the-basics/devices/pairing)). IP can change; hardware id / UUID must not.

## Hardware identity validation

**Choice:** For Shelly, after IP match the app calls official `GET /rpc/Shelly.GetDeviceInfo` and compares the reported id with Homey `data.id`. Mismatch → localized “Different device detected” page (not treated as the configured display). Generic skips this when no hardware id exists.

**Why:** LAN IP reuse / wrong device on a reserved address must not silently serve another display’s page. Shelly RPC is the documented Gen2 identity API ([Shelly.GetDeviceInfo](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly#shellygetdeviceinfo)).

## Diagnostics is a permanent feature

**Choice:** `/diagnostics` is a product page (not a temporary debug tool). Controlled by app setting `diagnosticsEnabled` (default `true`). When disabled, the route returns **403** with a clear localized message and no registry dump.

**Why:** Advanced users and testers need LAN-visible runtime status without Homey developer tools. Disabling must be safe and coherent.

## Online timeout without heartbeat

**Choice:** Online if last successful recognition is within 5 minutes.

**Why:** Displays already poll `/` as their browser page; a separate heartbeat would be unused complexity in this milestone.

## Pairing modes per driver

**Choice:** `PairingFlow` supports `identify_required` (Shelly) and `ip_only` (Generic). Shelly no longer offers “pick Generic” on failure.

**Why:** Type is already chosen by selecting the Homey driver. Mixing types in one pairing session would reintroduce the old mega-driver UX.

---

## Milestone 1 decisions still in force

### Homey Compose for drivers

`.homeycompose/app.json` + `drivers/*/driver.compose.json` + `driver.settings.compose.json` ([Homey Compose](https://apps.developer.homey.app/advanced/homey-compose), [Device settings](https://apps.developer.homey.app/the-basics/devices/settings)).

### Custom pairing: injected Homey, no `/homey.js`

Pairing HTML must not load `/homey.js`. Use `Homey.setNavigationClose()` and in-page CTAs ([Custom pairing views](https://apps.developer.homey.app/advanced/custom-views/custom-pairing-views)).

### `Homey.createDevice` instead of `add_devices`

Documented API for custom pairing without `list_devices` ([createDevice](https://apps.developer.homey.app/advanced/custom-views/custom-pairing-views)).

### Native device settings only

Types: `group`, `text`, `label`, `dropdown`. No custom device settings HTML.

### Device class `other`, empty capabilities, `connectivity: lan`

No wall-dashboard class; no control capabilities in this milestone.

### Adapter isolation / Shelly.GetDeviceInfo / configuration snapshot

Unchanged from Milestone 1.

### Localization EN + IT

Official Homey i18n ([Internationalization](https://apps.developer.homey.app/the-basics/app/internationalization)).

### TypeScript strict, no `any`

([TypeScript guide](https://apps.developer.homey.app/guides/tools/typescript)).
