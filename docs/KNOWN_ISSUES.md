# Known issues

## Fixed / superseded during Milestone 5

- **No Homey device bindings.** LightWidget binds to a Homey `deviceId` and reads `onoff` at dashboard load.
- **No device selector in the editor.** The Dashboard Editor lists compatible `onoff` devices with name + zone.

## Deferred by design (Milestone 5)

- **No ON/OFF control.** LightWidget is read-only. Toggling a light from Homey does not update the wall display until refresh.
- **No dim / color / color temperature.** Compatibility is `onoff` only. The `deviceId` reference is ready for later capabilities.
- **No live push.** Configuration and Homey state apply on Wall Display refresh. `applyConfiguration` and `updateWidgetState` are ready for a future channel.
- **No Homey realtime listeners.** `makeCapabilityInstance` / Device `connect()` are not used.
- **No drag & drop / advanced visual editor.** Placement is form-based with grid preview.
- **No resize / orientation listeners.** Reload after viewport changes. Portrait vs landscape grid remains a Device Setting.
- **Safety margin / gap constants are not Homey settings.**
- **No Flow cards / WebSocket / Shelly hardware controls.**
- **No Shelly authentication** during identity probe.
- **No hostname pairing / LAN discovery.** IPv4 only.
- **Generic identity is a UUID generated at pairing.** Avoid duplicate IPs in the registry.
- **Existing M1 `wall_display` devices** are not migrated automatically.
- **Widget CSS is still simple** (Homey-inspired tiles, not a final visual system).

## Runtime constraints (still true)

- LAN bind, IP probe, and Homey Web API require the app to run **on Homey Pro**, not only in local Docker (`homey app run` without `--remote`).
- Privileged HTTP ports (`< 1024`) may fail on Homey.
- Some HTTP clients omit `Host`; the server still uses `requireHostHeader: false`.
- Frontend assets must be built (`npm run build` / `npm run build:frontend`) before packaging; `assets/dashboard/*` and `settings/editor.js` are what Homey serves.
- `homey:manager:api` is a powerful permission. Homey Cloud disallows it; this app is local-only.

## Homey platform notes

- Custom pairing views and app settings views are not supported on Homey Cloud. Manifest `platforms` is `["local"]`.
- Homey Compose overwrites root `app.json` when the CLI runs. Prefer editing `.homeycompose/` and `drivers/*/driver*.compose.json`.
- `Device#onSettings` is not called when settings are changed with `setSettings()` from code.
- Homey Apps SDK does not provide an official “app RAM” metric beyond what Node exposes (`process.memoryUsage`).
- Device Settings `label` fields are read-only; the dashboard note uses that type so users are directed to App Settings.
- `homey-api@3.17+` requires Node 24. This project pins `3.16.1` for Homey Pro Node 22.

## Tests that cannot run in CI without Homey

Automated tests cover registry, placement, widgets, HomeyDeviceRepository (mocked Web API), LightWidget runtime, geometry, identity, pairing, and HTTP handler logic. They do **not** drive the Homey mobile pairing UI, App Settings WebView, physical Shelly panels, or live Homey devices. Use the manual checklist in [MILESTONES.md](MILESTONES.md).
