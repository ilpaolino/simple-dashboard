# Known issues

## Fixed / superseded during Milestone 3

- **Root page was a technical recognition dump.** Recognized clients now receive the vanilla grid dashboard.
- **Layout was display-only text.** Layout now drives the grid engine via `DashboardBootstrap`.

## Deferred by design (Milestone 3)

- **No real widgets.** Cells are diagnostic placeholders only.
- **No multi-cell span rendering.** `GridPlacement` exists structurally only.
- **No resize / orientation listeners.** Reload the page after viewport changes. Portrait vs landscape grid is selected in Homey Device Settings (`2x4`/`4x2`, `3x6`/`6x3`), not inferred from the viewport.
- **Safety margin / gap constants are not Homey settings.**
- **No Flow cards / WebSocket / Homey device control / Shelly hardware controls.**
- **No Shelly authentication** during identity probe.
- **No hostname pairing / LAN discovery.** IPv4 only.
- **Generic identity is a UUID generated at pairing.** Avoid duplicate IPs in the registry.
- **Existing M1 `wall_display` devices** are not migrated automatically.

## Runtime constraints (still true)

- LAN bind and IP probe require the app to run **on Homey Pro**, not only in local Docker (`homey app run` without `--remote`).
- Privileged HTTP ports (`< 1024`) may fail on Homey.
- Some HTTP clients omit `Host`; the server still uses `requireHostHeader: false`.
- Frontend assets must be built (`npm run build` / `npm run build:frontend`) before packaging; `assets/dashboard/*` is what Homey serves.

## Homey platform notes

- Custom pairing views and app settings views are not supported on Homey Cloud. Manifest `platforms` is `["local"]`.
- Homey Compose overwrites root `app.json` when the CLI runs. Prefer editing `.homeycompose/` and `drivers/*/driver*.compose.json`.
- `Device#onSettings` is not called when settings are changed with `setSettings()` from code.
- Homey Apps SDK does not provide an official “app RAM” metric beyond what Node exposes (`process.memoryUsage`).

## Tests that cannot run in CI without Homey

Automated tests cover registry, geometry, identity, pairing, and HTTP handler logic. They do **not** drive the Homey mobile pairing UI or a physical Shelly panel. Use the manual checklist in [MILESTONES.md](MILESTONES.md).
