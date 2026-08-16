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
- Notifications, cameras
- Flow cards
- Socket.IO

**Note:** Cover control overlays arrived in Milestone 9 (reusable `WidgetControlOverlay`). Light dimmer/color panels remain deferred.

## Milestone 8 — CoverWidget Read-Only & Device Visual Language

**Status:** Done. Details: [MILESTONE-8.md](MILESTONE-8.md).

### In scope (implemented)

- CoverWidget read path (`windowcoverings_set`)
- Compatibility filter + editor device picker (name + zone)
- Normalization 0–100% (0 closed, 100 open)
- Vertical bar + decorative icons
- Shared device-widget CSS for Light + Cover
- Selective realtime via capability-keyed subscriptions
- Diagnostics with raw + normalized values
- Automated tests + LightWidget visual regression coverage

### Out of scope (explicitly deferred to M9 / later)

- Cover commands (open/close/stop/slider) → **done in Milestone 9**
- Interpolated movement / advanced gestures
- Other device widgets

## Milestone 9 — Interactive CoverWidget & Position Control

**Status:** Done. Details: [MILESTONE-9.md](MILESTONE-9.md).

### In scope (implemented)

- Tap CoverWidget → open `WidgetControlOverlay` (no direct move from the tile)
- Global reusable overlay (one at a time; outside the grid)
- `CoverControlPanel`: name, current, target, vertical slider, Open/Close, conditional Stop
- Send-on-release via Pointer Events
- Widget intents: `set-position` (+ `positionPercent`), `stop`
- Backend validation + denormalization to Homey `windowcoverings_set` `[0,1]`
- Stop via official `windowcoverings_state` → `idle` only when capability present
- Runtime flags `{ canSetPosition, canStop }`
- Progress-aware confirmation + per-type timeouts; `command-succeeded` protocol message
- Live config: overlay closes if widget removed / unsafe rebind; close does not cancel in-flight Homey commands
- Diagnostics cover counters; IT/EN; automated tests; LightWidget regression preserved

### Out of scope (explicitly deferred)

- Advanced tile gestures (double-tap, long-press, swipe)
- Light dimmer/color panels
- Multi-cover groups, timers, simulated motion, Flow/Scene

## Later milestones (not started)

- Dim / color / temperature on the same `deviceId`
- Additional widget types (sensors, thermostats)
- Display hardware controls beyond recognition
- Flow cards

## Manual test checklist (Milestone 9)

See the full checklist in [MILESTONE-9.md](MILESTONE-9.md).
