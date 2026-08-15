# Known issues

## Fixed / superseded during Milestone 6

- **No live push.** Connected Displays receive live LightWidget `onoff` and live full dashboard configuration over WebSocket.
- **No Homey realtime listeners.** Selective `makeCapabilityInstance('onoff')` is used via `RealtimeSubscriptionManager`.
- **Online from HTTP lastSeen only.** Online/offline is now based on an active realtime session.

## Deferred by design (Milestone 6)

- **No ON/OFF control from the display.** LightWidget remains read-only toward Homey (`setCapabilityValue` not used). The protocol is already bidirectional for a later milestone.
- **No dim / color / color temperature.** Compatibility and subscriptions are `onoff` only.
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
- **Widget CSS is still simple** (Homey-inspired tiles, not a final visual system).
- **Local IP trust only.** No cloud auth; clients must match a configured Display IP.

## Runtime constraints (still true)

- LAN bind, IP probe, Homey Web API, and capability realtime require the app to run **on Homey Pro**, not only in local Docker (`homey app run` without `--remote`).
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

Automated tests cover registry, placement, widgets, HomeyDeviceRepository (mocked Web API), LightWidget runtime, realtime gateway/subscriptions/heartbeat (mocked Homey + local `ws`), geometry, identity, pairing, and HTTP handler logic. They do **not** drive the Homey mobile pairing UI, App Settings WebView, physical Shelly panels, or live Homey devices. Use the manual checklist in [MILESTONES.md](MILESTONES.md).
