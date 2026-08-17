# Development guide

For contributors extending LocalDashboard. User documentation starts at [README.md](../README.md).

## Repository layout

| Path | Responsibility |
| --- | --- |
| `app.ts` | Homey app lifecycle; wires HTTP, WebSocket, registry, repositories |
| `api.ts` | Homey Web API for Dashboard Editor and notification HTTP API |
| `lib/display/` | DisplayRegistry, IP normalize, hardware identity, online state |
| `lib/dashboard/` | Grid geometry, bootstrap DTO, layout parsing |
| `lib/widgets/` | Widget types, validation, placement, registry |
| `lib/homey/` | Homey Web API client, device repository, media resolver |
| `lib/realtime/` | WebSocket gateway, sessions, subscriptions, commands |
| `lib/notifications/` | NotificationManager, severity, media, Flow upsert |
| `lib/flow/` | Homey Flow card registration (thin layer) |
| `lib/pairing/` | Generic code pairing, pairing WebSocket |
| `lib/shelly/` | Shelly RPC client, hardware discovery, profiles |
| `lib/http/` | HTTP routing, dashboard HTML, diagnostics pages |
| `lib/adapters/` | Shelly vs Generic adapter metadata |
| `frontend/` | Dashboard browser app (vanilla TS) |
| `frontend/widgets/` | Per-widget renderers |
| `frontend/notifications/` | Notification Center, media controller |
| `frontend/overlays/` | Widget control overlay shell |
| `frontend/settings/` | Dashboard Editor source → `settings/editor.js` |
| `frontend/realtime/` | WebSocket client, reconnect, interaction controller |
| `settings/` | Homey App Settings HTML shell |
| `drivers/` | Homey drivers (Shelly, Generic), pairing views, Flow compose |
| `locales/` | UI strings (EN, IT, DE, FR, DA, ES, PT) |
| `assets/dashboard/` | Built `dashboard.css` / `dashboard.js` (generated) |
| `test/` | Node test runner suites |
| `docs/` | Project memory + user documentation |

## Build & test commands

From `package.json`:

```bash
npm install
npm run assets          # icons/images
npm run build           # tsc + frontend bundle
npm run typecheck
npm run lint            # alias for typecheck
npm test
npm run measure:frontend
npx homey app validate  # requires Homey CLI
homey app run --remote
```

Output: TypeScript compiles to `.homeybuild/`; frontend bundles to `assets/dashboard/` and `settings/editor.js`.

## Architectural invariants

Do not violate these when adding features:

1. **Homey is source of truth** for device state and notification lifecycle.
2. **Browser sends intents**, not raw Homey writes (`deviceId` + capability + value).
3. **Backend validates** session, Display ownership, widget type, and action.
4. **Realtime confirms** commands — pending ≠ final state.
5. **One persistence layer** — Device Store `dashboard`; no shadow DB in frontend.
6. **Selective subscriptions** with reference counting.
7. **Full snapshot** on reconnect — no offline command replay.
8. **Notifications are global chrome**, not grid widgets.
9. **No arbitrary URL proxy** for media or images.
10. **Generic identity is IP-based** — no browser UUID storage.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md).

## Adding a new widget type (outline)

1. **`lib/widgets/<type>/`** — config type, `validateConfig`, `allowedSpans`, optional `interactions`.
2. **Register** in `lib/widgets/registry.ts` (or default registry factory).
3. **`frontend/widgets/<type>/`** — renderer + CSS; apply theme tokens.
4. **Bootstrap/runtime** — extend `resolveDashboardRuntime` if device-bound.
5. **Subscriptions** — add to `extractReferencedCapabilitySubscriptions` if Homey capabilities needed.
6. **Commands** — extend `WidgetCommandHandler` with new actions; never trust client `deviceId`.
7. **Editor** — extend `frontend/settings/editor.ts` dialog fields.
8. **Locales** — `locales/en.json` plus `it`, `de`, `fr`, `da`, `es`, `pt` with identical keys.
9. **Tests** — validation, command handler, renderer smoke tests.

## Adding a Flow card

- Edit `drivers/*/driver.flow.compose.json` (Compose source).
- Register handler in `lib/flow/` — keep thin; delegate to `NotificationManager` or existing services.
- **Do not rename** existing card ids (breaks user Flows). Add new ids with new compose entries.
- Shelly driver needs **prefixed** ids if Generic already uses the same action id.

## Frontend constraints

- **No runtime framework** — vanilla TS compiled with esbuild to IIFE.
- Current measured sizes (~v1 build): CSS ~42 KB, JS ~104 KB raw — run `npm run measure:frontend`.
- Touch-first interactions; Pointer Events for light/cover controls.

## Homey permissions

`homey:manager:api` — required to read/control devices not owned by this app. Local platform only.

## Technical docs vs user docs

| Audience | Start here |
| --- | --- |
| End user / installer | [README.md](../README.md), [Getting started](getting-started.md) |
| Operator / support | [Diagnostics](diagnostics.md), [Troubleshooting](troubleshooting.md) |
| Contributor | This file, [ARCHITECTURE.md](ARCHITECTURE.md), [PROJECT.md](PROJECT.md) |
| Historical milestones | [MILESTONES.md](MILESTONES.md), `MILESTONE-*.md` |

## Related

- [MILESTONE-16.md](MILESTONE-16.md) — v1 release checklist
- [KNOWN_ISSUES.md](KNOWN_ISSUES.md)
