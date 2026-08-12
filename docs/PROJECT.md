# Project

## What this is

**Simple Dashboard** (`dev.dadda.simpledashboard`) is a Homey Pro app (Apps SDK v3, local platform only).

It hosts a local HTTP endpoint for wall displays. Milestone 2 connects Homey Devices to HTTP clients through a runtime `DisplayRegistry`, separate drivers for Shelly and Generic displays, hardware identity checks, and a permanent `/diagnostics` page.

## Current status

**Milestone 2 is implemented.** Milestone 0–1 behavior is preserved where still relevant (HTTP server, settings, adapters, pairing).

| Area | Status |
| --- | --- |
| Local HTTP server on Homey Pro | Done (M0) |
| App settings (HTTP port + diagnostics) | Done (M0/M2) |
| Separate drivers: Shelly + Generic | Done (M2) |
| DisplayRegistry (runtime, Homey SoT) | Done (M2) |
| IP matching + Shelly hardware validation | Done (M2) |
| Technical root page / unconfigured / mismatch | Done (M2) |
| Diagnostics page | Done (M2) |
| Dashboard / Vue / widgets | Not started |
| Flow cards | Not started |
| WebSocket / realtime | Not started |
| Homey device control from the display | Not started |

## How to resume after a break

1. Read this file, then [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md).
2. Check [MILESTONES.md](MILESTONES.md) for what is in / out of scope.
3. Check [TODO.md](TODO.md) and [KNOWN_ISSUES.md](KNOWN_ISSUES.md) before writing new code.
4. Reuse `lib/display`, `lib/adapters`, `lib/pairing`, `lib/http`. Do not invent a second persistence layer for displays.

## Runtime constraints

- Must run **on Homey Pro** (`homey app run --remote` or `homey app install`) for LAN bind and for probing a display by IP.
- Compatibility: Homey `>=12.9.0` (Node.js 22).
- TypeScript strict mode, compiled to `.homeybuild/`.

## Local commands

```bash
npm install
npm run assets
npm test
npm run typecheck
npm run lint
homey app validate
homey app run --remote
```

## Source map

| Path | Role |
| --- | --- |
| `app.ts` | Homey App lifecycle; HTTP + DisplayRegistry host |
| `lib/display/` | Registry, session, IP normalize, hardware identity |
| `lib/http/` | Request handler + technical / diagnostics HTML |
| `lib/adapters/` | Shelly + Generic protocol adapters |
| `lib/pairing/` | Shared pairing state machine |
| `drivers/shelly_wall_display/` | Shelly driver, device, pairing, settings |
| `drivers/generic_web_display/` | Generic driver, device, pairing, settings |
| `settings/index.html` | Official Homey **app** settings view |
| `locales/` | `en` + `it` |
| `.homeycompose/app.json` | Compose source for the app manifest |
| `docs/` | Project memory |

## Identity rule

The Homey device identity is `data.id` (Shelly device id when detected, otherwise a generated UUID). **The IP address is a setting used only for runtime routing**, not the identity.
