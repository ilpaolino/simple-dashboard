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

- Dimmer, color, color temperature, sliders → **done in Milestone 10**
- Long press / double click / swipe gestures → long-press done in **Milestone 10**
- Notifications, cameras
- Flow cards
- Socket.IO

**Note:** Cover control overlays arrived in Milestone 9. Light advanced panel arrived in Milestone 10.

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

- Advanced tile gestures (double-tap, swipe) — long-press for Light arrived in M10
- Light dimmer/color panels → **done in Milestone 10**
- Multi-cover groups, timers, simulated motion, Flow/Scene

## Milestone 10 — Advanced LightWidget Control Panel

**Status:** Done. Details: [MILESTONE-10.md](MILESTONE-10.md).

### In scope (implemented)

- Tap LightWidget → toggle; long press → `LightControlPanel` (no double trigger)
- Reuse `WidgetControlOverlay` (Cover + Light panels; one at a time)
- Capability-driven UI: ON/OFF, dim, temperature, color (hue/sat)
- Normalized UX percents; send-on-release for dim / temperature / color
- Intents: `set-dim`, `set-temperature`, `set-color` (+ existing `toggle`)
- Backend validation, Homey `[0,1]` mapping, optional `light_mode`
- Selective subscriptions for optional light capabilities
- Diagnostics light counters; IT/EN; automated tests; Cover regression preserved

### Out of scope (explicitly deferred)

- Scenes, presets, animations, effects, groups, custom transitions
- Double-click / swipe
- Heavy color libraries

## Milestone 11 — Notification Center, Carousel & Highlight States

**Status:** Done. Details: [MILESTONE-11.md](MILESTONE-11.md).

### In scope (implemented)

- `NotificationManager` with per-Display routing
- Severities `critical` > `warning` > `success` > `info`
- Controlled icon keys; plain-text title/message
- Local dismiss (runtime-only; not global remove)
- Snapshot + incremental realtime protocol
- Severity triangle indicator + Notification Center carousel
- Touch swipe + explicit previous/next (no loop)
- CSS highlight pulse + `prefers-reduced-motion`
- Diagnostics + metrics; IT/EN; Flow-ready API (no Flow UI yet)

### Out of scope (explicitly deferred)

- Homey Flow cards UI → **done in Milestone 11B**
- Persistent dismiss / notification history DB
- Arbitrary HTML/SVG icons

## Milestone 11B — Native Homey Flow Integration for Notifications

**Status:** Done. Details: [MILESTONE-11B.md](MILESTONE-11B.md).

### In scope (implemented)

- Device Flow Action Cards shared by Shelly + Generic (`show_notification`, `remove_notification`, `remove_all_notifications`)
- `notificationKey` upsert (`displayId + key`); idempotent remove by key; remove-all per Display
- Thin Flow layer → existing `NotificationManager` (no Notification Center rewrite)
- Optional SoT capabilities: `notification_count`, `highest_notification_severity`
- Diagnostics Flow counters; IT/EN Flow strings; automated key/upsert tests

### Out of scope (explicitly deferred)

- Global “notify all Displays” Flow
- Using capabilities as notification payload transport
- Persistent dismiss / notification history DB

## Milestone 12 — Notification Lifecycle, Auto-Close & Native Flow Actions

**Status:** Done. Details: [MILESTONE-12.md](MILESTONE-12.md).

### In scope (implemented)

- `autoOpen` / `autoCloseSeconds` / optional single `action` on existing `DisplayNotification`
- Separate interactive Show Flow card (`show_interactive_notification`) without changing the light M11B Show card
- Device Flow Trigger `notification_action_pressed` with Action ID filter + tokens
- Typed `notification-action` WebSocket path with SoT validation
- Auto-close progress (CSS) + interaction cancels timer; manual open skips auto-close
- Diagnostics counters; IT/EN; automated M12 tests

### Out of scope (explicitly deferred)

- Multiple actions per notification
- Condition Card based on fragile global “last action”
- Auto-close that removes/dismisses notifications
- Direct Display→capability commands

## Later milestones (not started)

- Additional widget types (sensors, thermostats)
- Display hardware controls beyond recognition
- Global notification Flow across all Displays (optional)

## Manual test checklist

- Milestone 11: [MILESTONE-11.md](MILESTONE-11.md)
- Milestone 11B: [MILESTONE-11B.md](MILESTONE-11B.md)
- Milestone 12: [MILESTONE-12.md](MILESTONE-12.md)
