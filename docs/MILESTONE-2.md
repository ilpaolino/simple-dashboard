# Milestone 2 — Display Registry, Device Recognition & Diagnostics

## Architecture implemented

- Drivers `shelly_wall_display` and `generic_web_display` (Homey type choice before pairing)
- Shared `DisplayRegistry` + `DisplaySession` + online timeout
- `DisplayRequestHandler` for `GET /` and `GET /diagnostics`
- Shelly hardware identity via official `Shelly.GetDeviceInfo`
- App setting `diagnosticsEnabled` (default true); disabled → 403 page
- Localization `en` + `it`

See [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md).

## Automated tests

| File | What it covers |
| --- | --- |
| `test/display-registry.test.ts` | Empty/populate/match/remove/rebuild/runtime reset/online |
| `test/hardware-identity.test.ts` | Shelly match / mismatch / unavailable |
| `test/display-request-handler.test.ts` | Root recognition, mismatch, diagnostics on/off |
| `test/display-pages.test.ts` | Technical HTML pages |
| `test/ip-normalize.test.ts` | `::ffff:` and zone id normalization |
| `test/pairing-flow.test.ts` | Shelly identify_required + Generic ip_only |
| Existing M0/M1 tests | Adapters, settings, HTTP server, logger, port |

## Manual checklist

See [MILESTONES.md](MILESTONES.md) (Milestone 2 section).

## Open issues

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
