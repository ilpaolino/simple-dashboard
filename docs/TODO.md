# TODO

## Milestone 7 follow-up (optional, not blocking)

- [ ] Exercise LightWidget toggle on Homey Pro with a physical wall display
- [ ] Confirm pending / timeout / reconnect overlay on a Shelly Wall Display browser
- [ ] Measure RSS/heap on Homey Pro via `/diagnostics` during rapid toggle cycles
- [ ] If Homey CLI compose rewrites `app.json`, commit the generated file as-is

## Next milestone (do not start here)

Only when a later milestone is requested:

- [ ] Dim / color / color temperature on the same `deviceId`
- [ ] Additional widget types (covers, sensors, thermostats)
- [ ] Flow cards
- [ ] Drag & drop editor enhancements (still Homey App Settings only)
- [ ] Shelly authenticated RPC if probe fails with 401
- [ ] Shelly hardware controls (reboot, brightness, volume) via official APIs only
- [ ] Optional discovery (mDNS) **in addition to** manual IP, not instead of it

## Rules for future work

- Homey Devices remain the only persistence for display + widget configuration
- Widgets store Homey **references** (`deviceId`), never copies of name/state
- Clients send **widget intents** only — never raw Homey `deviceId` / capability / value
- Keep `DisplayRegistry` runtime-only
- Keep `HomeyDeviceRepository` as the only Homey device access path
- Keep `RealtimeSubscriptionManager` reference-counted and selective
- Keep `PendingCommandManager` free of persistent queues / auto-retry
- Keep frontend vanilla (no UI frameworks) unless an explicit milestone overturns that decision
- Register new widgets via `WidgetRegistry` + dedicated folders — do not fork the engine
- Persist only via Homey `data`, `store`, `settings`, or app `ManagerSettings`
- Prefer `widget-state` for capability patches and full `dashboard-configuration` for structural edits
- Extend the typed WebSocket protocol with new discriminants — do not send untyped JSON
- New gestures should map through `WidgetDefinition.interactions` + `WidgetInteractionController`
