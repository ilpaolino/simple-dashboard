# Known issues

## Fixed during Milestone 1

- **Pairing bounced / closed on Homey Next (“Collegati”).** Fixed with a single pairing view and an in-page **Collegati** / **Connect** button; Homey chrome is Close-only via `setNavigationClose`. See [DECISIONS.md](DECISIONS.md).
- **`/homey.js` must not be used in pairing views.** `data-origin="pair"` tries to load `/js/homey.pair.js` and fails. Pairing uses the injected global `Homey` object only.

## Deferred by design (Milestone 1)

- **No dashboard.** Layout is stored only; nothing renders it.
- **No widget runtime.** `configuration.recommended.capabilities` is an empty extension point.
- **No Flow cards.**
- **No WebSocket / realtime.**
- **No Homey device control** from the wall display.
- **No Shelly authentication.** If `Shelly.GetDeviceInfo` returns 401, pairing falls back to manual adapter selection.
- **No hostname pairing.** Only IPv4, as specified.
- **No LAN discovery.** IP is entered manually.
- **Adapter cannot be changed after pairing.** It is a Homey `label` setting. Manual choice happens only during pairing.
- **Layout dropdown lists all adapters’ layouts.** Homey settings schema is static. Invalid combinations are rejected in `onSettings`.
- **Generic identity is a UUID generated at pairing.** Two generic pairings of the same IP create two Homey devices, because IP is not identity.
- **Detected name** is used only if Shelly.GetDeviceInfo includes `name`. Official docs do not guarantee that field; otherwise the translated default “Wall Display” is used.

## Runtime constraints (from Milestone 0, still true)

- LAN bind and IP probe require the app to run **on Homey Pro**, not only in local Docker (`homey app run` without `--remote`).
- Privileged HTTP ports (`< 1024`) may fail on Homey.
- Some HTTP clients omit `Host`; the welcome server still uses `requireHostHeader: false`.

## Homey platform notes

- Custom pairing views and app settings views are not supported on Homey Cloud. Manifest `platforms` is `["local"]`.
- Homey Compose overwrites root `app.json` when the CLI runs. Prefer editing `.homeycompose/` and `drivers/*/driver*.compose.json`.
- `Device#onSettings` is not called when settings are changed with `setSettings()` from code.

## Tests that cannot run in CI without Homey

Automated tests cover adapters, pairing state, identity, settings validation, and HTTP JSON. They do **not** drive the Homey mobile pairing UI. Use the manual checklist in [MILESTONES.md](MILESTONES.md).
