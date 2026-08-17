# Project

## What this is

**Simple Dashboard** (`dev.dadda.simpledashboard`) is a Homey Pro app (Apps SDK v3, local platform only).

It hosts a local HTTP + WebSocket endpoint for wall displays. Milestone 11 added a global **Notification Center**. Milestone **11B** added native **Homey Flow Action Cards**. Milestone **12** added configurable auto-open / auto-close and a single semantic notification action. Milestone **13** adds optional Homey camera/media **inside** those notifications — without a separate camera overlay.

## Current status

**Milestone 14 is implemented.** Milestone 0–13 behavior is preserved.

| Area | Status |
| --- | --- |
| Local HTTP server on Homey Pro | Done (M0) |
| App settings (HTTP port + diagnostics) | Done (M0/M2) |
| Separate drivers: Shelly + Generic | Done (M2) |
| DisplayRegistry (runtime, Homey SoT) | Done (M2/M6 online via WS) |
| IP matching + Shelly hardware validation | Done (M2) |
| Diagnostics page | Done (M2–M14) |
| Vanilla grid rendering from device layout | Done (M3) |
| Widget Registry + Title / DateTime widgets | Done (M4) |
| Dashboard Editor in App Settings | Done (M4/M5/M8) |
| Homey Device Repository (`homey:manager:api`) | Done (M5) |
| LightWidget (`onoff` + advanced control panel) | Done (M5/M7/M10) |
| CoverWidget (`windowcoverings_set` + control overlay) | Done (M8/M9) |
| Shared device-widget visual language | Done (M8) |
| WidgetControlOverlay + CoverControlPanel + LightControlPanel | Done (M9/M10) |
| NotificationManager + Notification Center | Done (M11) |
| Homey Flow notification actions + aggregate capabilities | Done (M11B) |
| Notification auto-open / auto-close + semantic actions | Done (M12) |
| Optional Homey camera/media inside Notifications | Done (M13) |
| Shelly RPC hardware discovery + reboot Flow | Done (M14) |
| WebSocket realtime (same port) | Done (M6/M11/M12/M13 notifications) |
| Selective Homey capability subscriptions | Done (M6/M8/M9/M10 light optional caps) |
| Live dashboard configuration | Done (M6) |
| Bidirectional widget commands | Done (M7/M9/M10) |
| Dim / color / color temperature | Done (M10) |
| Flow cards (notifications) | Done (M11B/M12) |

## How to resume after a break

1. Read this file, then [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md).
2. Check [MILESTONES.md](MILESTONES.md) for what is in / out of scope.
3. Check [TODO.md](TODO.md) and [KNOWN_ISSUES.md](KNOWN_ISSUES.md) before writing new code.
4. Reuse `lib/realtime`, `lib/notifications`, `lib/homey`, `lib/display`, `lib/dashboard`, `lib/widgets`, `lib/adapters`, `lib/pairing`, `lib/http`. Do not invent a second persistence layer. Do not let the frontend call Homey APIs or send raw `deviceId`/`capability` commands.

## Runtime constraints

- Must run **on Homey Pro** (`homey app run --remote` or `homey app install`) for LAN bind, for probing a display by IP, and for `HomeyAPI.createAppAPI` / `makeCapabilityInstance` / `setCapabilityValue`.
- Compatibility: Homey `>=12.9.0` (Node.js 22).
- TypeScript strict mode, compiled to `.homeybuild/`.
- Frontend is built separately into `assets/dashboard/` (IIFE, no runtime framework).
- Dashboard Editor settings source is built into `settings/editor.js`.
- Permission `homey:manager:api` is required to read/control global Homey devices and subscribe to capabilities.

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
| `app.ts` | Homey App lifecycle; HTTP + WebSocket gateway + DisplayRegistry + HomeyDeviceRepository + editor/notification API |
| `api.ts` | Homey Web API for Dashboard Editor + notifications |
| `lib/notifications/` | NotificationManager, severity, icons, keys, Flow upsert API, media model/session |
| `lib/flow/` | Thin Homey Flow Action registration for notifications |
| `lib/realtime/` | WebSocket protocol, sessions, subscriptions, command handler, pending manager, gateway |
| `lib/homey/` | Homey Web API client + HomeyDeviceRepository + NotificationMediaResolver (backend only) |
| `lib/widgets/` | Shared widget types, placement, validation, registry, runtime snapshot |
| `lib/widgets/light/` | LightWidget config, compatibility, normalize, confirmation, runtime, interactions |
| `lib/widgets/cover/` | CoverWidget config, compatibility, normalization, confirmation, runtime |
| `lib/dashboard/` | Grid types, geometry math, cell ids, bootstrap DTO |
| `lib/display/` | Registry, session, IP normalize, hardware identity, online via WS |
| `lib/http/` | Request handler, dashboard HTML, static assets, diagnostics |
| `frontend/` | Vanilla dashboard + settings editor source |
| `frontend/realtime/` | WebSocket client, reconnect, connection overlay, WidgetInteractionController |
| `frontend/notifications/` | NotificationController, Indicator, Center, swipe, NotificationMediaController |
| `frontend/overlays/widget-control/` | Reusable WidgetControlOverlay shell |
| `frontend/widgets/` | Isolated widget renderers (title, date-time, light + LightControlPanel, cover + CoverControlPanel) |
| `frontend/widgets/shared/` | Shared device-widget CSS, control-panel CSS, decorative icon helper |
| `assets/dashboard/` | Built `dashboard.css` / `dashboard.js` served on LAN |
| `settings/` | Official Homey app settings + Dashboard Editor |
| `lib/shelly/` | Shelly RPC client, hardware discovery, runtime profile store (M14) |
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

LightWidget and CoverWidget persist **only** `deviceId`. Name, zone, availability, and capability values are read from Homey (snapshot + realtime). Commands are issued as widget intents (`widgetId` + `action` [+ normalized UX fields]), never as raw Homey device writes from the browser.

Notifications are runtime-only (not Device Store). Creation/update/remove are decided by Homey/backend; dismiss is local per Display and never persisted.

## Notification action fields (Flow)

Used only on **Mostra notifica interattiva**. You type them; Homey has no picker.

**ID azione** is the filter that connects two Flows. Homey has a single WHEN card (“azione premuta”). You invent a short name (`open-gate`) when you **show** the notification, then type the **same** name on the WHEN card that should run. Without it, every tap on that Display would start every “azione premuta” Flow.

- **ID azione** (`open-gate`) — not shown on screen; used only to match SHOW ↔ WHEN.
- **Testo pulsante** (`Apri cancello`) — the button the user taps.
- **Testo azione** — optional sentence above the button.

Filling **ID azione** and **Testo pulsante** on **Mostra notifica interattiva** is enough to show the button (the enable checkbox is optional). The simple **Mostra notifica** card never shows a CTA.

Walkthrough and troubleshooting: [MILESTONE-12.md](MILESTONE-12.md#what-action-id-is-for).
