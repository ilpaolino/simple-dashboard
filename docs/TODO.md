# TODO

## Milestone 4 follow-up (optional, not blocking)

- [ ] Exercise Dashboard Editor on Homey Pro with a real Shelly + Generic display
- [ ] Confirm Device Settings note rendering in Homey mobile / web UI
- [ ] Measure RSS/heap on Homey Pro via `/diagnostics` with widgets loaded
- [ ] If Homey CLI compose rewrites `app.json`, commit the generated file as-is

## Next milestone (do not start here)

Only when a later milestone is requested:

- [ ] Homey capability / device bindings for interactive widgets
- [ ] Additional widget types (lights, covers, sensors, …)
- [ ] Realtime channel (WebSocket or equivalent), reusing `applyConfiguration`
- [ ] Flow cards
- [ ] Drag & drop editor enhancements (still Homey App Settings only)
- [ ] Shelly authenticated RPC if probe fails with 401
- [ ] Shelly hardware controls (reboot, brightness, volume) via official APIs only
- [ ] Optional discovery (mDNS) **in addition to** manual IP, not instead of it

## Rules for future work

- Homey Devices remain the only persistence for display + widget configuration
- Keep `DisplayRegistry` runtime-only
- Keep frontend vanilla (no UI frameworks) unless an explicit milestone overturns that decision
- Register new widgets via `WidgetRegistry` + dedicated folders — do not fork the engine
- Persist only via Homey `data`, `store`, `settings`, or app `ManagerSettings`
- Prefer `DashboardRenderer.applyConfiguration` for live updates when realtime arrives
