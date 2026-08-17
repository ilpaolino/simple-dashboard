# Milestone 16 — LocalDashboard v1 Release Hardening

**Status:** Done.

Milestone 16 is stabilization only — no new product features. The user-facing product name is **LocalDashboard**. The Homey technical application identifier **`dev.dadda.simpledashboard`** is retained for upgrade compatibility.

## Branding vs technical identity

| Class | Policy | Examples |
| --- | --- | --- |
| A — user-facing branding | Renamed to **LocalDashboard** | Homey app name, App Settings title, pairing/diagnostics copy, README, current docs |
| C — compatibility identifiers | **Unchanged** | `dev.dadda.simpledashboard`, driver ids, Flow card ids, capability ids, Device Store key `dashboard`, settings keys |
| E — historical docs | Prior milestone docs may still say "Simple Dashboard" where that was the name at the time |

## Bugs fixed in M16

1. **HTTP client IP trust** — `X-Forwarded-For` is no longer trusted on the direct LAN server; spoofing a paired Display IP via that header is rejected.
2. **Duplicate WebSocket cleanup** — closing a replaced socket no longer tears down subscriptions/online state for the newer connection.
3. **Notification media revocation** — clearing `media` on update also clears `mediaBinding`; image HTTP returns 404 when media is absent.
4. **Subscription acquisition race** — concurrent acquire for the same `(deviceId, capabilityId)` serializes and shares one Homey listener.
5. **Expired pairing code consumption** — `consume()` rejects expired sessions.
6. **Diagnostics error leakage** — render failures return a generic message (details stay in logs).

## Compatibility identifiers retained

- App id: `dev.dadda.simpledashboard`
- Drivers: `generic_web_display`, `shelly_wall_display`
- Device Store: `dashboard`, `configuration`, `adapterId`, …
- App settings: `httpPort`, `diagnosticsEnabled`
- Flow actions: `show_notification`, `show_interactive_notification`, `remove_notification`, `remove_all_notifications`, Shelly-prefixed twins, `shelly_reboot_display`
- Flow trigger: `notification_action_pressed` / `shelly_notification_action_pressed`
- Capabilities: `notification_count`, `highest_notification_severity`, `button.rediscover_hardware`
- HTTP paths: `/`, `/dashboard.css`, `/dashboard.js`, `/diagnostics`, `/notification-media/:id/image|video`, WebSocket `/realtime`

## Automated release validation

```bash
npm run typecheck
npm run build
npm run lint
npm test
npm run measure:frontend
homey app validate
```

M16-focused tests: `test/release-m16.test.ts`.

## Product documentation (M16)

Comprehensive user and developer documentation:

- Entry point: [README.md](../README.md)
- Index: [docs/README.md](README.md)
- Guides: getting-started, displays, widgets, notifications, realtime, camera-media, diagnostics, troubleshooting, limitations, examples, development, and others under `docs/`

Documentation was validated against current source (layouts, widget spans, Flow compose, persistence, security fixes in M16).

## Manual Homey Pro release checklist

### Install / upgrade

- [ ] Clean install on Homey Pro
- [ ] Upgrade from existing development installation
- [ ] Existing Shelly devices remain paired
- [ ] Existing Generic devices remain paired
- [ ] Existing dashboard configuration (`dashboard` Device Store) remains readable
- [ ] Existing Flows remain valid (card ids unchanged)

### Generic pairing

- [ ] Unknown browser shows pairing page + 6-digit code
- [ ] Code pairing succeeds in Homey
- [ ] Browser automatically reaches dashboard after refresh
- [ ] Browser storage clear does not break same-IP identity
- [ ] Changed IP shows pairing page; fix IP in Device Settings → dashboard works
- [ ] Expired code rejected; refresh browser → new code
- [ ] `/diagnostics` masks pairing code (last digits only)

### Shelly

- [ ] Shelly pairing still works
- [ ] Identity probe still works
- [ ] `Shelly.ListMethods` discovery works
- [ ] Discovery failure does not block pairing
- [ ] Maintenance rediscovery works
- [ ] Reboot Flow works when supported
- [ ] Generic driver exposes no Shelly controls

### Dashboard

- [ ] Title / DateTime widgets
- [ ] Light toggle, long press panel (dim / temperature / color when supported)
- [ ] Cover position, Open / Close, Stop when supported
- [ ] Live configuration update from App Settings
- [ ] Reconnect snapshot restores state

### Notifications

- [ ] Simple Show + interactive Show
- [ ] Key upsert, severity ribbon, dismiss / non-dismissable
- [ ] Auto-open / auto-close, second upsert re-presents
- [ ] Action ID Flow trigger
- [ ] Remove / remove all
- [ ] Aggregate capabilities (`notification_count`, `highest_notification_severity`)

### Media

- [ ] Camera snapshot in Notification Center
- [ ] 3 s visible refresh while open
- [ ] Unsupported video fallback (no broken `<video>`)
- [ ] Close / swipe / auto-close stops media
- [ ] Removed camera handled gracefully
- [ ] Diagnostics: `activeMediaSessions` returns to 0

### Resilience

- [ ] Homey device temporarily offline → widget unavailable, no crash
- [ ] Wall Display temporarily offline → reconnect snapshot
- [ ] App restart → pairing codes regenerated; paired devices persist
- [ ] Duplicate browser connection → newest wins, dashboard stays live
- [ ] Invalid dashboard reference → unavailable widget visible
- [ ] Shelly offline → diagnostics show unknown vs unsupported correctly

### Resource check

Record `/diagnostics` before and after repeated usage cycles (connect/disconnect, notifications, media, widget commands):

- [ ] RSS / heapUsed stable (returns toward baseline)
- [ ] Active WS sessions match connected displays
- [ ] Subscriptions ref-count sane when displays share devices
- [ ] Pending commands return to 0
- [ ] Pending pairings bounded
- [ ] Active media sessions return to 0 after close

### Language / display

- [ ] English UI (App Settings, pairing, dashboard errors)
- [ ] Italian UI
- [ ] Dark and light dashboard themes
- [ ] Portrait and landscape layouts
- [ ] Touch interactions on wall hardware

## Remaining v1 known limitations

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md) — current section at the top.

## Intentionally deferred after v1

- Global “notify all Displays” Flow
- Additional widget types (sensors, thermostats)
- Browser UUID / localStorage identity
- Camera transcoding / live RTSP / WebRTC on wall browser
- Drag & drop dashboard editor
- Additional Shelly hardware controls without official RPC docs
- Pairing brute-force rate limiting (LAN trust model; codes expire in 8 minutes)
