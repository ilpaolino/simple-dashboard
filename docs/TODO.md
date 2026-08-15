# TODO

## Milestone 6 follow-up (optional, not blocking)

- [ ] Exercise WebSocket realtime on Homey Pro with two physical Displays sharing one light
- [ ] Confirm heartbeat / reconnect overlay on a real Shelly Wall Display browser
- [ ] Measure RSS/heap on Homey Pro via `/diagnostics` with 1–N active WS sessions
- [ ] If Homey CLI compose rewrites `app.json`, commit the generated file as-is

## Next milestone (do not start here)

Only when a later milestone is requested:

- [ ] LightWidget ON/OFF control via official `setCapabilityValue` (bidirectional protocol already prepared)
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
- Keep `DisplayRegistry` runtime-only
- Keep `HomeyDeviceRepository` as the only Homey device access path
- Keep `RealtimeSubscriptionManager` reference-counted and selective
- Keep frontend vanilla (no UI frameworks) unless an explicit milestone overturns that decision
- Register new widgets via `WidgetRegistry` + dedicated folders — do not fork the engine
- Persist only via Homey `data`, `store`, `settings`, or app `ManagerSettings`
- Prefer `widget-state` for capability patches and full `dashboard-configuration` for structural edits
- Extend the typed WebSocket protocol with new discriminants — do not send untyped JSON
