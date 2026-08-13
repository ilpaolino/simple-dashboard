# Known issues

## Fixed / superseded during Milestone 4

- **No real widgets.** TitleWidget and DateTimeWidget render from Device Store configuration.
- **No multi-cell span rendering.** Multi-cell widgets use CSS `grid-area` as a single rectangle.
- **No dashboard editor.** Official Homey App Settings Dashboard Editor is implemented.

## Deferred by design (Milestone 4)

- **No Homey capability control** (lights, covers, thermostats, sensors, …).
- **No live push.** Configuration applies on Wall Display refresh; renderer is ready for future `applyConfiguration` calls.
- **No drag & drop / advanced visual editor.** Placement is form-based with grid preview.
- **No resize / orientation listeners.** Reload after viewport changes. Portrait vs landscape grid remains a Device Setting.
- **Safety margin / gap constants are not Homey settings.**
- **No Flow cards / WebSocket / Shelly hardware controls.**
- **No Shelly authentication** during identity probe.
- **No hostname pairing / LAN discovery.** IPv4 only.
- **Generic identity is a UUID generated at pairing.** Avoid duplicate IPs in the registry.
- **Existing M1 `wall_display` devices** are not migrated automatically.
- **Widget CSS is provisional** (tokens + basic layout only). Visual polish is deferred.

## Runtime constraints (still true)

- LAN bind and IP probe require the app to run **on Homey Pro**, not only in local Docker (`homey app run` without `--remote`).
- Privileged HTTP ports (`< 1024`) may fail on Homey.
- Some HTTP clients omit `Host`; the server still uses `requireHostHeader: false`.
- Frontend assets must be built (`npm run build` / `npm run build:frontend`) before packaging; `assets/dashboard/*` and `settings/editor.js` are what Homey serves.

## Homey platform notes

- Custom pairing views and app settings views are not supported on Homey Cloud. Manifest `platforms` is `["local"]`.
- Homey Compose overwrites root `app.json` when the CLI runs. Prefer editing `.homeycompose/` and `drivers/*/driver*.compose.json`.
- `Device#onSettings` is not called when settings are changed with `setSettings()` from code.
- Homey Apps SDK does not provide an official “app RAM” metric beyond what Node exposes (`process.memoryUsage`).
- Device Settings `label` fields are read-only; the dashboard note uses that type so users are directed to App Settings.

## Tests that cannot run in CI without Homey

Automated tests cover registry, placement, widgets, geometry, identity, pairing, and HTTP handler logic. They do **not** drive the Homey mobile pairing UI, App Settings WebView, or a physical Shelly panel. Use the manual checklist in [MILESTONES.md](MILESTONES.md).
