# Milestone 5 — Homey Device Data Layer & Read-Only Light Widget

## Goal

```text
Homey Device API
      +
Device Repository
      +
Device selection
      +
LightWidget read-only
      +
snapshot ON/OFF
```

## Architecture implemented

- `lib/homey/` — `HomeyAPI.createAppAPI` wrapper + `HomeyDeviceRepository`
- `lib/widgets/light/` — config (`deviceId` only), `onoff` compatibility, runtime resolver, visual state
- `frontend/widgets/light/` — isolated DOM renderer + Homey-inspired tile CSS
- `DashboardBootstrap.widgetRuntime` + `DashboardRenderer.updateWidgetState`
- Dashboard Editor device selector (server-filtered compatible devices)
- Save-time Homey binding validation; render-time re-check
- Diagnostics table for each LightWidget snapshot
- Permission `homey:manager:api` in `.homeycompose/app.json`

## Frontend performance (measured locally after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML (sample bootstrap page) | 760 B | 438 B |
| CSS | 8841 B | 1947 B |
| JS (minified IIFE) | 14715 B | 4516 B |
| **Total** | **24316 B** | **6901 B** |

Milestone 4 reference total: **12024 B** raw / **4122 B** gzip.

Delta (raw): **+12292 B** (LightWidget CSS/JS + runtime DTO plumbing). Still zero frontend framework dependencies. `homey-api` is **backend-only** and is not bundled into `dashboard.js`.

Settings editor bundle (`settings/editor.js`): **17.2 KB** (was 13.1 KB). Homey App Settings only, not served to wall displays.

Re-measure: `npm run measure:frontend`.

## Dependencies

| Dependency | Kind | Reason |
| --- | --- | --- |
| `homey-api@3.16.1` | **runtime (Homey Pro)** | Official Homey Web API client (`createAppAPI`, devices, zones). Pinned because 3.17+ needs Node 24. |
| `esbuild` | **dev only** | Bundle dashboard + settings editor IIFEs; inline CSS imports |
| *(none)* | frontend runtime | Vanilla browser APIs (`Intl`, `setInterval` for DateTime only) |

`source-map-support` remains the only other production dependency.

`homey-api` pulls `engine.io-client` / `socket.io-client` as transitive packages. This milestone does **not** call `Device.connect()` or `makeCapabilityInstance`, so those clients are not used for dashboard updates.

## Automated tests

| File | Coverage |
| --- | --- |
| `test/homey-device-repository.test.ts` | List, lookup, missing id, zone present/absent, `onoff`, availability, editor filter |
| `test/light-widget.test.ts` | Compatibility, ON/OFF, unavailable, removed, missing capability, API error, save binding, snapshot semantics (no polling/WebSocket/listeners) |
| `test/widget-registry.test.ts` | Light type, 1×1 span, `deviceId` validation |
| `test/dashboard-renderer.test.ts` | Light ON→OFF via `updateWidgetState`, no LightWidget timers, broken LightWidget isolation |
| `test/display-request-handler.test.ts` | Bootstrap embeds Homey snapshot at load |

130 tests passing (`npm test`).

## Manual checklist

See [MILESTONES.md](MILESTONES.md) (Milestone 5 section).

## Open issues

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
