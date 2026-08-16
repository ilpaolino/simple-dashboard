# TODO

## Milestone 11B follow-up (optional, not blocking)

- [ ] Create Homey Flow on Homey Pro: Display → Show notification (`test-info`) and verify triangle + Center
- [ ] Upsert same key with severity `warning` / highlight; confirm no duplicate
- [ ] Remove by key + Remove all; confirm other Display unchanged
- [ ] Offline Display: publish via Flow, reconnect, snapshot shows notification
- [ ] Dismiss locally → Flow upsert keeps dismiss; Flow remove + show restores visibility
- [ ] Confirm `notification_count` / `highest_notification_severity` on device after Flow ops (dismiss does not change them)
- [ ] If Homey CLI compose rewrites `app.json`, commit the generated file as-is

## Milestone 11 follow-up (optional, not blocking)

- [ ] Exercise Notification Center on Homey Pro with two Wall Displays (shared notification + local dismiss)
- [ ] Confirm highlight pulse and `prefers-reduced-motion` on Shelly Wall Display browser
- [ ] Measure RSS/heap on Homey Pro via `/diagnostics` with several active notifications

## Milestone 10 follow-up (optional, not blocking)

- [ ] Exercise LightControlPanel on Homey Pro with physical bulbs that expose `dim` / `light_temperature` / `light_hue`+`light_saturation`
- [ ] Verify long-press vs tap on a Shelly Wall Display browser (no accidental toggle)
- [ ] Confirm send-on-release for dim / temperature / color and realtime confirmation
- [ ] Measure RSS/heap on Homey Pro via `/diagnostics` with mixed Light + Cover overlays

## Milestone 9 follow-up (optional, not blocking)

- [ ] Exercise CoverWidget control on Homey Pro with a physical shutter / blind that exposes `windowcoverings_set`
- [ ] Verify Stop on devices that also expose `windowcoverings_state` (hidden when absent)
- [ ] Confirm send-on-release, current vs target, and realtime progress on a Shelly Wall Display browser

## Next milestone (do not start here)

Only when a later milestone is requested:

- [ ] Optional global Flow: show notification on all Displays
- [ ] Additional widget types (sensors, thermostats)
- [ ] Drag & drop editor enhancements (still Homey App Settings only)
- [ ] Shelly authenticated RPC if probe fails with 401
- [ ] Shelly hardware controls (reboot, brightness, volume) via official APIs only
- [ ] Optional discovery (mDNS) **in addition to** manual IP, not instead of it
- [ ] Homey device icons if an official auth-free URL becomes documented
- [ ] Light scenes / presets / effects (explicitly out of M10)

## Rules for future work

- Homey Devices remain the only persistence for display + widget configuration
- Widgets store Homey **references** (`deviceId`), never copies of name/state
- Clients send **widget intents** only — never raw Homey `deviceId` / capability / value
- Keep `DisplayRegistry` runtime-only
- Keep `NotificationManager` as the only notification source of truth (runtime dismiss per Display)
- Prefer Homey Flow Action Cards for parameterized notification commands; HTTP Web API is secondary
- Notification aggregate capabilities are state-only — never payload transport
- Local dismiss must never remove the global notification or affect other Displays / capability aggregates
- Keep `HomeyDeviceRepository` as the only Homey device access path
- Keep `RealtimeSubscriptionManager` reference-counted and selective (capability-keyed)
- Keep `PendingCommandManager` free of persistent queues / auto-retry
- Keep frontend vanilla (no UI frameworks) unless an explicit milestone overturns that decision
- Register new widgets via `WidgetRegistry` + dedicated folders — do not fork the engine
- Persist only via Homey `data`, `store`, `settings`, or app `ManagerSettings`
- Prefer `widget-state` for capability patches and full `dashboard-configuration` for structural edits
- Extend the typed WebSocket protocol with new discriminants — do not send untyped JSON
- New gestures should map through `WidgetDefinition.interactions` + `WidgetInteractionController`
- Reuse `WidgetControlOverlay` for control panels; Notification Center stays a separate global system
- Device icons remain decorative; use official Homey assets only when documented and LAN-safe
- Cover Stop remains gated on official `windowcoverings_state`; do not invent stop paths
- Light advanced controls remain capability-driven; do not add editor flags to enable dim/color
- Closing overlays must not cancel Homey commands already sent
