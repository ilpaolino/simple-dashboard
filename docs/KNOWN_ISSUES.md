# Known issues

## Fixed / superseded during Milestone 10

- **No dim / color / color temperature.** LightWidget advanced panel supports dim, `light_temperature`, and hue/saturation color when Homey exposes them.
- **No advanced gestures for Light.** Long press opens LightControlPanel; tap remains toggle. Double-tap / swipe remain deferred.

## Fixed / superseded during Milestone 9

- **CoverWidget is read-only.** Cover is interactive: tile tap opens `WidgetControlOverlay` + `CoverControlPanel` with send-on-release position control, Open/Close, and conditional Stop.
- **No cover command path.** Widget intents `set-position` / `stop`, backend validation, progress-aware confirmation, and `command-succeeded` are implemented.

## Fixed / superseded during Milestone 8

- **No CoverWidget.** CoverWidget with `windowcoverings_set` (read path + shared device visuals) is implemented; M9 adds control.
- **LightWidget without decorative icon.** Light and Cover share the device-widget visual language.

## Deferred by design (Milestone 10)

- **One pending command per widget.** Light toggle/dim/temperature/color share a single pending slot (no per-capability queues).
- **Color requires hue + saturation.** Devices with only one of the two never show the color picker.
- **No Kelvin labels.** Temperature uses normalized 0…100 (Homey higher = warmer); no physical Kelvin display.
- **No scenes / presets / effects / light groups.**
- **No double-click or swipe gestures.**
- **Stop only with `windowcoverings_state`.** Devices that expose only `windowcoverings_set` can set position but never show Stop.
- **Command timeouts are per-type, not user-configurable.** Light toggle/dim/temperature/color **4000 ms**; cover `set-position` **8000 ms**; cover `stop` **4000 ms**.
- **No movement interpolation.** Cover tile and overlay paint Homey-reported percent only.
- **Overlay close does not cancel Homey commands.** Pending continues until confirm / reject / timeout.
- **No Homey device icons on tiles.** Inline SVG fallbacks are used.
- **No offline command queue / auto-retry.** Disconnect clears pending; reconnect uses a full snapshot.
- **No event replay.** Offline gaps are corrected by a full snapshot after reconnect only.
- **No Socket.IO.** `ws` only, shared HTTP port.
- **No drag & drop / advanced visual editor.** Placement is form-based with grid preview.
- **No resize / orientation listeners.** Reload after viewport changes.
- **Safety margin / gap constants are not Homey settings.**
- **No Flow cards / Shelly hardware controls.**
- **No Shelly authentication** during identity probe.
- **No hostname pairing / LAN discovery.** IPv4 only.
- **Generic identity is a UUID generated at pairing.** Avoid duplicate IPs in the registry.
- **Existing M1 `wall_display` devices** are not migrated automatically.
- **Widget CSS is still simple** (Homey-inspired tiles, shared device grammar, control overlay — not a final visual system).
- **Local IP trust only.** No cloud auth; clients must match a configured Display IP.
- **No multi-cover groups, timers, or simulated motion.**

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

Automated tests cover registry, placement, widgets, HomeyDeviceRepository (mocked Web API), LightWidget/CoverWidget runtime and confirmation, light/cover overlay/control panels, gestures, realtime gateway/subscriptions/heartbeat/commands (mocked Homey + local `ws`), geometry, identity, pairing, and HTTP handler logic. They do **not** drive the Homey mobile pairing UI, App Settings WebView, physical Shelly panels, or live Homey devices. Use the manual checklist in [MILESTONE-10.md](MILESTONE-10.md).
