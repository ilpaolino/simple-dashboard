# Known issues

## Fixed / superseded during Milestone 2

- **Single mega-driver with adapter picker.** Replaced by separate Homey drivers `shelly_wall_display` and `generic_web_display`.
- **Root page was Milestone 0 welcome HTML.** Root now performs display recognition.

## Deferred by design (Milestone 2)

- **No dashboard.** Layout is shown as text on the technical page only.
- **No widget runtime.**
- **No Flow cards.**
- **No WebSocket / realtime.**
- **No Homey device control** from the wall display.
- **No Shelly authentication.** If `Shelly.GetDeviceInfo` fails during recognition, the page reports identity check failure (not a silent match).
- **No Shelly reboot / brightness / volume.**
- **No hostname pairing.** Only IPv4.
- **No LAN discovery.** IP is entered manually.
- **Generic identity is a UUID generated at pairing.** Two generic pairings of the same IP create two Homey devices; only one can win IP routing (first match in registry iteration order). Avoid duplicate IPs.
- **Existing M1 `wall_display` devices** are not migrated automatically. Re-pair under the new drivers if upgrading from M1.

## Runtime constraints (still true)

- LAN bind and IP probe require the app to run **on Homey Pro**, not only in local Docker (`homey app run` without `--remote`).
- Privileged HTTP ports (`< 1024`) may fail on Homey.
- Some HTTP clients omit `Host`; the server still uses `requireHostHeader: false`.

## Homey platform notes

- Custom pairing views and app settings views are not supported on Homey Cloud. Manifest `platforms` is `["local"]`.
- Homey Compose overwrites root `app.json` when the CLI runs. Prefer editing `.homeycompose/` and `drivers/*/driver*.compose.json`.
- `Device#onSettings` is not called when settings are changed with `setSettings()` from code.

## Tests that cannot run in CI without Homey

Automated tests cover registry, identity, pairing modes, and HTTP handler logic. They do **not** drive the Homey mobile pairing UI. Use the manual checklist in [MILESTONES.md](MILESTONES.md).
