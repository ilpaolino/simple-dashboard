# Milestones

## Milestone 0 — Local HTTP server PoC

**Status:** Done. Details: [MILESTONE-0.md](MILESTONE-0.md).

## Milestone 1 — Wall Display device, pairing, native Homey integration

**Status:** Done (superseded driver layout by M2). Details: [MILESTONE-1.md](MILESTONE-1.md).

## Milestone 2 — Display Registry, Device Recognition & Diagnostics

**Status:** Done. Details: [MILESTONE-2.md](MILESTONE-2.md).

## Milestone 3 — Vanilla Grid Rendering Engine

**Status:** Done. Details: [MILESTONE-3.md](MILESTONE-3.md).

## Milestone 4 — Widget Engine & Dashboard Editor

**Status:** Done. Details: [MILESTONE-4.md](MILESTONE-4.md).

## Milestone 5 — Homey Device Data Layer & Read-Only Light Widget

**Status:** Done. Details: [MILESTONE-5.md](MILESTONE-5.md).

## Milestone 6 — WebSocket Realtime & Live Dashboard Synchronization

**Status:** Done. Details: [MILESTONE-6.md](MILESTONE-6.md).

## Milestone 7 — Bidirectional Commands & Interactive LightWidget

**Status:** Done. Details: [MILESTONE-7.md](MILESTONE-7.md).

### In scope (implemented)

- Single tap on LightWidget tile → toggle
- Pending overlay separate from real Homey ON/OFF
- `WidgetInteractionController` + typed `widget-action` intents
- Backend `WidgetCommandHandler` validation (session, ownership, type, action, device, capability, availability)
- Official Homey `setCapabilityValue({ capabilityId: 'onoff', value })`
- Confirmation only via Homey realtime
- Command timeout 4000 ms; no auto-retry; no offline queue
- Concurrent-tap protection per widget
- Diagnostics command metrics + bounded recent history
- Automated tests for controller, validation, lifecycle, security, leak cycles

### Out of scope (explicitly deferred)

- Dimmer, color, color temperature, sliders
- Long press / double click / swipe gestures (architecture reserved only)
- Popups, overlays beyond connection loss, notifications, cameras
- Flow cards
- Socket.IO

## Later milestones (not started)

- Dim / color / temperature on the same `deviceId`
- Additional widget types (covers, sensors, thermostats)
- Display hardware controls beyond recognition

## Manual test checklist (Milestone 7)

- [ ] Build completed
- [ ] TypeScript strict without errors
- [ ] lint completed
- [ ] test automatici completed
- [ ] LightWidget entirely clickable
- [ ] OFF → tap → pending
- [ ] realtime ON → widget ON
- [ ] ON → tap → pending
- [ ] realtime OFF → widget OFF
- [ ] real state remains visible during pending
- [ ] second tap during pending ignored
- [ ] Device unavailable not commandable
- [ ] timeout shows error
- [ ] API error shows error
- [ ] socket loss clears pending
- [ ] reconnect snapshot restores real state
- [ ] Device not belonging to the widget not commandable
- [ ] client cannot send arbitrary deviceId
- [ ] diagnostics updated
- [ ] command metrics correct
- [ ] Italian UI
- [ ] English UI
- [ ] no polling introduced
- [ ] no evident leaks
- [ ] RAM/bundle delta documented
