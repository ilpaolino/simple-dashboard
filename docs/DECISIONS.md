# Decisions

Architectural choices for Milestone 1. Milestone 0 decisions remain in [MILESTONE-0.md](MILESTONE-0.md).

## Homey Compose for the driver

**Choice:** `.homeycompose/app.json` + `drivers/wall_display/driver.compose.json` + `driver.settings.compose.json`.

**Why:** Device settings are defined in `driver.settings.compose.json` according to the official settings guide. Homey Compose is the documented file layout for that file ([Homey Compose](https://apps.developer.homey.app/advanced/homey-compose), [Device settings](https://apps.developer.homey.app/the-basics/devices/settings)).

## Custom pairing: single view + in-page steps

**Choice:** One custom HTML view (`enter_ip`) containing IP entry, confirm, and manual adapter selection as in-page steps. Pairing views use the Homey object injected by the client (no `/homey.js`). `Homey.setNavigationClose()` leaves Close in Homey chrome; the primary CTA is the in-page **Collegati** / **Connect** button, with `Homey.showLoadingOverlay()` during probe.

**Why:** `/homey.js` is only for app settings (`data-origin="settings"`). Using it in a pairing view requests `/js/homey.pair.js` and fails with *Could not load script*. Official pairing docs state Homey is globally available in pair HTML ([Custom pairing views](https://apps.developer.homey.app/advanced/custom-views/custom-pairing-views), [App settings](https://apps.developer.homey.app/advanced/custom-views/app-settings)).

Views use only documented Homey CSS (`homey-header`, `homey-form-*`, `homey-button-*`, radio set) ([HTML & CSS styling](https://apps.developer.homey.app/advanced/custom-views/html-and-css-styling)).

## `Homey.createDevice` instead of `add_devices`

**Choice:** The pairing view calls `Homey.createDevice` then `Homey.done()` after confirm or manual adapter selection.

**Why:** That is the documented API for creating a device from a custom pairing view, including `data`, `store`, and `settings` ([Custom pairing views — createDevice](https://apps.developer.homey.app/advanced/custom-views/custom-pairing-views)). The `add_devices` template expects a prior `list_devices` selection, which this IP flow does not have.

## Identity is `data.id`, IP is a setting

**Choice:** `data.id` = Shelly `id` when detected, otherwise `crypto.randomUUID()`. IP is stored in settings key `ip`.

**Why:** Homey documents that `data` must contain unique properties that do not change; an IP address is explicitly called out as a bad identity because it can change. The store/settings examples put the address in `store` or `settings` ([Pairing device object](https://apps.developer.homey.app/the-basics/devices/pairing), [Device store](https://apps.developer.homey.app/the-basics/devices)).

IP is a **setting** (not only store) so the user edits it in native Advanced settings.

## Native device settings only

**Choice:** No custom device configuration screens. Types used: `group`, `text`, `label`, `dropdown`.

**Why:** Homey presents these as Advanced settings with the standard UI. `label` is the official read-only field and can only be updated by the app — used for adapter and detected info ([Device settings types](https://apps.developer.homey.app/the-basics/devices/settings)). `onSettings` may throw to block invalid values; the error is shown to the user.

Adapter is a `label` because it is chosen during pairing (auto or manual). Homey has no dynamic setting schema, so “read-only if auto-detected” is implemented by making adapter non-editable in the official UI. `onSettings` also rejects `adapter` if it ever appears in `changedKeys`.

Layout options are a static dropdown (Homey cannot change dropdown values per device). `onSettings` validates against `store.configuration.supportedLayoutIds`, so a Generic device cannot save a Shelly-only layout.

## Device class `other`, empty capabilities, `connectivity: lan`

**Choice:** `"class": "other"`, `"capabilities": []`, `"connectivity": ["lan"]`, `"platforms": ["local"]`.

**Why:** There is no Homey device class for a wall dashboard. `other` is the documented generic class. This milestone must not add device control capabilities. `lan` matches a locally addressed IP device. Cloud is out of scope (same as M0).

## Adapter isolation

**Choice:** `WallDisplayAdapter.tryIdentify` is the only place a protocol is spoken. Generic sets `canAutoIdentify = false` and never calls HTTP.

**Why:** The pairing requirement is that each adapter knows only its own protocol. The registry iterates auto-identify adapters and stops at the first match.

## Shelly recognition via `Shelly.GetDeviceInfo`

**Choice:** `GET http://<ip>/rpc/Shelly.GetDeviceInfo`. A device is a Wall Display when `model` starts with `SAWD`, or `app` looks like WallDisplay, or `id` contains `shellywalldisplay` / `sawd-`. Other Shelly products are treated as unrecognized.

**Why:** That RPC method is the official Gen2 identification API ([Shelly.GetDeviceInfo](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly#shellygetdeviceinfo)). Wall Display model codes use the `SAWD*` prefix. Homey Node.js 22 documents `fetch` ([Node.js 22](https://apps.developer.homey.app/upgrade-guides/node-22)). Failures (timeout, 401, non-JSON) become “unrecognized” so the user can pick an adapter manually. Auth is not in this milestone.

## Configuration snapshot in the device store

**Choice:** At pairing, `adapter.createInitialConfiguration()` is stored. Later layout edits update that object. The adapter is not asked again.

**Why:** The milestone requires the configuration to become independent of the adapter after creation. Homey store is the official place for structured persistent device data ([Device store](https://apps.developer.homey.app/the-basics/devices)). Settings hold the user-facing layout value; store holds the full snapshot (supported layouts, recommended capabilities placeholder).

Shelly initial layouts: `2x2` (default), `3x3`. Generic: `2x4` (default), `3x6`. Recommended `capabilities` is an empty array — extension point only.

## Localization

**Choice:** `en` + `it` from day one. Pairing/errors use `/locales`. Driver name and device setting labels use compose JSON bilingual fields.

**Why:** Official Homey i18n is locale JSON + `Homey.__` / `data-i18n` / `this.homey.__` ([Internationalization](https://apps.developer.homey.app/the-basics/app/internationalization), pairing i18n in [Custom pairing views](https://apps.developer.homey.app/advanced/custom-views/custom-pairing-views)). Device setting labels in compose JSON are the documented way to translate Advanced settings.

## TypeScript

**Choice:** Keep M0 tsconfig (`strict`, `noImplicitAny`, `outDir: .homeybuild/`). No `any` in app code. Homey `PairSession` handlers receive `unknown` and are parsed with type guards.

**Why:** Homey TypeScript guide ([TypeScript](https://apps.developer.homey.app/guides/tools/typescript)). Homey’s published handler type uses `any`; we do not leak that into domain code.
