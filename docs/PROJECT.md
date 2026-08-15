# Project

## What this is

**Simple Dashboard** (`dev.dadda.simpledashboard`) is a Homey Pro app (Apps SDK v3, local platform only).

It hosts a local HTTP endpoint for wall displays. Milestone 5 adds a **Homey Device Data Layer** and the first Homey-bound widget: a read-only **LightWidget** that shows the current device name and `onoff` snapshot at dashboard load.

## Current status

**Milestone 5 is implemented.** Milestone 0–4 behavior is preserved (HTTP server, settings, drivers, registry, recognition, grid engine, widget engine, Dashboard Editor, diagnostics).

| Area | Status |
| --- | --- |
| Local HTTP server on Homey Pro | Done (M0) |
| App settings (HTTP port + diagnostics) | Done (M0/M2) |
| Separate drivers: Shelly + Generic | Done (M2) |
| DisplayRegistry (runtime, Homey SoT) | Done (M2) |
| IP matching + Shelly hardware validation | Done (M2) |
| Diagnostics page | Done (M2/M3/M4/M5) |
| Vanilla grid rendering from device layout | Done (M3) |
| Widget Registry + Title / DateTime widgets | Done (M4) |
| Dashboard Editor in App Settings | Done (M4/M5) |
| Homey Device Repository (`homey:manager:api`) | Done (M5) |
| Read-only LightWidget (`onoff` snapshot) | Done (M5) |
| Homey capability control (set on/off, dim, color) | Not started |
| Flow cards | Not started |
| WebSocket / realtime | Not started |

## How to resume after a break

1. Read this file, then [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md).
2. Check [MILESTONES.md](MILESTONES.md) for what is in / out of scope.
3. Check [TODO.md](TODO.md) and [KNOWN_ISSUES.md](KNOWN_ISSUES.md) before writing new code.
4. Reuse `lib/homey`, `lib/display`, `lib/dashboard`, `lib/widgets`, `lib/adapters`, `lib/pairing`, `lib/http`. Do not invent a second persistence layer for displays or layouts. Do not let the frontend call Homey APIs.

## Runtime constraints

- Must run **on Homey Pro** (`homey app run --remote` or `homey app install`) for LAN bind, for probing a display by IP, and for `HomeyAPI.createAppAPI`.
- Compatibility: Homey `>=12.9.0` (Node.js 22).
- TypeScript strict mode, compiled to `.homeybuild/`.
- Frontend is built separately into `assets/dashboard/` (IIFE, no runtime framework).
- Dashboard Editor settings source is built into `settings/editor.js`.
- Permission `homey:manager:api` is required to read global Homey devices and zones.

## Local commands

```bash
npm install
npm run assets
npm run build
npm test
npm run typecheck
npm run lint
npm run measure:frontend
homey app validate
homey app run --remote
```

## Source map

| Path | Role |
| --- | --- |
| `app.ts` | Homey App lifecycle; HTTP + DisplayRegistry + HomeyDeviceRepository + editor API |
| `api.ts` | Homey Web API for Dashboard Editor |
| `lib/homey/` | Homey Web API client + HomeyDeviceRepository (backend only) |
| `lib/widgets/` | Shared widget types, placement, validation, registry, runtime snapshot |
| `lib/widgets/light/` | LightWidget config, compatibility, runtime resolver |
| `lib/dashboard/` | Grid types, geometry math, cell ids, bootstrap DTO |
| `lib/display/` | Registry, session, IP normalize, hardware identity |
| `lib/http/` | Request handler, dashboard HTML, static assets, diagnostics |
| `frontend/` | Vanilla dashboard + settings editor source |
| `frontend/widgets/` | Isolated widget renderers (title, date-time, light) |
| `assets/dashboard/` | Built `dashboard.css` / `dashboard.js` served on LAN |
| `settings/` | Official Homey app settings + Dashboard Editor |
| `lib/adapters/` | Shelly + Generic protocol adapters |
| `lib/pairing/` | Shared pairing state machine |
| `drivers/shelly_wall_display/` | Shelly driver, device, pairing, settings |
| `drivers/generic_web_display/` | Generic driver, device, pairing, settings |
| `locales/` | `en` + `it` |
| `.homeycompose/app.json` | Compose source for the app manifest |
| `docs/` | Project memory |

## Identity rule

The Homey device identity is `data.id` (Shelly device id when detected, otherwise a generated UUID). **The IP address is a setting used only for runtime routing**, not the identity.

Widget configuration is stored per Homey Device in the Device Store key `dashboard`.

LightWidget persists **only** `deviceId`. Name, zone, availability, and `onoff` are always read from Homey at dashboard load.
