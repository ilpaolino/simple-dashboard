# Known issues

## Fixed / superseded during Milestone 8

- **No CoverWidget.** Read-only CoverWidget with `windowcoverings_set` is implemented.
- **LightWidget without decorative icon.** Light and Cover share the device-widget visual language.

## Deferred by design (Milestone 8)

- **CoverWidget is read-only.** No open/close/stop, slider, or position commands yet.
- **No inferred cover motion.** Bar updates only on Homey-reported values.
- **No Homey device icons on tiles.** `Device.icon` / `iconObj` exist in the Web API, but there is no documented auth-free URL for this app’s LAN dashboard; inline SVG fallbacks are used.
- **No dim / color / color temperature.** Light compatibility and commands remain `onoff` only.
- **No advanced gestures.** Architecture reserves `double-tap` / `long-press` / `swipe`; only LightWidget `tap → toggle` is implemented.
- **No offline command queue / auto-retry.** Disconnect clears pending; reconnect uses a full snapshot.
- **No event replay.** Offline gaps are corrected by a full snapshot after reconnect only.
- **No Socket.IO.** `ws` only, shared HTTP port.
- **No drag & drop / advanced visual editor.** Placement is form-based with grid preview.
- **No resize / orientation listeners.** Reload after viewport changes. Portrait vs landscape grid remains a Device Setting.
- **Safety margin / gap constants are not Homey settings.**
- **No Flow cards / Shelly hardware controls.**
- **No Shelly authentication** during identity probe.
- **No hostname pairing / LAN discovery.** IPv4 only.
- **Generic identity is a UUID generated at pairing.** Avoid duplicate IPs in the registry.
- **Existing M1 `wall_display` devices** are not migrated automatically.
- **Widget CSS is still simple** (Homey-inspired tiles, shared device grammar started in M8, not a final visual system).
- **Local IP trust only.** No cloud auth; clients must match a configured Display IP.
- **Command timeout is fixed** at 4000 ms (not user-configurable).

## Runtime constraints (still true)

- LAN bind, IP probe, Homey Web API, capability realtime, and capability writes require the app to run **on Homey Pro**, not only in local Docker (`homey app run` without `--remote`).
- Privileged HTTP ports (`< 1024`) may fail on Homey.
- Some HTTP clients omit `Host`; the server still uses `requireHostHeader: false`.
- Frontend assets must be built (`npm run build` / `npm run build:frontend`) before packaging; `assets/dashboard/*` and `settings/editor.js` are what Homey serves.
- `homey:manager:api` is a powerful permission. Homey Cloud disallows it; this app is local-only.
- Automated tests use `--test-force-exit` because Node may retain transient WebSocket handles after suite teardown; production cleanup still closes sessions, timers, and the HTTP server explicitly.

## Homey platform notes

- Custom pairing views and app settings views are not supported on Homey Cloud. Manifest `platforms` is `["local"]`.
- Homey Compose overwrites root `app.json` when the CLI runs. Prefer editing `.homeycompose/` and `drivers/*/driver*.compose.json`.
- `Device#onSettings` is not called when settings are changed with `setSettings()` from code.
- Homey Apps SDK does not provide an official “app RAM” metric beyond what Node exposes (`process.memoryUsage`).
- Device Settings `label` fields are read-only; the dashboard note uses that type so users are directed to App Settings.
- `homey-api@3.17+` requires Node 24. This project pins `3.16.1` for Homey Pro Node 22.

## Tests that cannot run in CI without Homey

Automated tests cover registry, placement, widgets, HomeyDeviceRepository (mocked Web API), LightWidget/CoverWidget runtime, realtime gateway/subscriptions/heartbeat/commands (mocked Homey + local `ws`), geometry, identity, pairing, and HTTP handler logic. They do **not** drive the Homey mobile pairing UI, App Settings WebView, physical Shelly panels, or live Homey devices. Use the manual checklist in [MILESTONE-8.md](MILESTONE-8.md).
