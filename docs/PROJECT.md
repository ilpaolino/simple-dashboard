# Project

## What this is

**Simple Dashboard** (`dev.dadda.simpledashboard`) is a Homey Pro app (Apps SDK v3, local platform only).

It will become a dashboard host for wall displays (Shelly Wall Display and generic web displays). The HTTP welcome page from Milestone 0 remains the LAN reachability proof. Milestone 1 adds the first Homey **Wall Display** device, IP pairing, adapters, and native device settings.

## Current status

**Milestone 1 is implemented.** Milestone 0 behavior is preserved.

| Area | Status |
| --- | --- |
| Local HTTP server on Homey Pro | Done (M0) |
| App settings for HTTP port | Done (M0) |
| Wall Display driver + device | Done (M1) |
| IP pairing + auto-identify + manual adapter | Done (M1) |
| Native Homey device settings (IP, adapter, layout, detected info) | Done (M1) |
| Dashboard / Vue / widgets | Not started |
| Flow cards | Not started |
| WebSocket / realtime | Not started |
| Homey device control from the display | Not started |

## How to resume after a break

1. Read this file, then [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md).
2. Check [MILESTONES.md](MILESTONES.md) for what is in / out of scope.
3. Check [TODO.md](TODO.md) and [KNOWN_ISSUES.md](KNOWN_ISSUES.md) before writing new code.
4. Reuse `lib/adapters`, `lib/device`, `lib/pairing`. Do not duplicate pairing or settings UIs.

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
| `app.ts` | Homey App lifecycle; HTTP server wiring (M0) |
| `lib/` | Shared domain: HTTP server, adapters, pairing, device config |
| `drivers/wall_display/` | Homey driver, device, pairing views, native settings |
| `settings/index.html` | Official Homey **app** settings view (HTTP port) |
| `locales/` | `en` + `it` for pairing, errors, app settings |
| `.homeycompose/app.json` | Compose source for the app manifest |
| `docs/` | Project memory |

## Identity rule

The Homey device identity is `data.id` (Shelly device id when detected, otherwise a generated UUID). **The IP address is a setting**, not the identity.
