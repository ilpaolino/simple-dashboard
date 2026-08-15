# TODO

## Milestone 5 follow-up (optional, not blocking)

- [ ] Exercise LightWidget on Homey Pro with real `onoff` devices (lights and sockets)
- [ ] Confirm zone names for devices without a zone (“No zone” / “Nessuna zona”)
- [ ] Measure RSS/heap on Homey Pro via `/diagnostics` with LightWidgets loaded
- [ ] If Homey CLI compose rewrites `app.json`, commit the generated file as-is

## Next milestone (do not start here)

Only when a later milestone is requested:

- [ ] LightWidget ON/OFF control via official `setCapabilityValue`
- [ ] Dim / color / color temperature on the same `deviceId`
- [ ] Realtime channel (WebSocket or equivalent), reusing `updateWidgetState`
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
- Keep frontend vanilla (no UI frameworks) unless an explicit milestone overturns that decision
- Register new widgets via `WidgetRegistry` + dedicated folders — do not fork the engine
- Persist only via Homey `data`, `store`, `settings`, or app `ManagerSettings`
- Prefer `DashboardRenderer.updateWidgetState` for capability patches when realtime arrives
- Do not add Homey capability listeners, polling, WebSocket, or SSE until that milestone
