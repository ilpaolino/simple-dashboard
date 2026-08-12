# Milestones

## Milestone 0 — Local HTTP server PoC

**Status:** Done. Details: [MILESTONE-0.md](MILESTONE-0.md).

## Milestone 1 — Wall Display device, pairing, native Homey integration

**Status:** Done (superseded driver layout by M2). Details: [MILESTONE-1.md](MILESTONE-1.md).

The single `wall_display` driver from M1 was split in M2 into `shelly_wall_display` and `generic_web_display`. Adapters, store/settings patterns, and pairing foundations remain.

## Milestone 2 — Display Registry, Device Recognition & Diagnostics

**Status:** Done. Details: [MILESTONE-2.md](MILESTONE-2.md).

### In scope (implemented)

- `DisplayRegistry` runtime, Homey as source of truth
- Separate Homey drivers: Shelly Wall Display, Generic Web Display
- IP routing + Shelly hardware identity validation
- Technical root page / unconfigured / mismatch
- `DisplaySession` + online/lastSeen (RAM only)
- `/diagnostics` + `Enable diagnostics` app setting
- EN + IT localization
- Automated tests + manual checklist

### Out of scope (explicitly deferred)

- Dashboard UI / Vue / widgets
- Using layout to render a grid
- Flow cards
- WebSocket / realtime
- Controlling Homey devices from the display
- Shelly reboot / brightness / volume
- Shelly authentication during probe
- mDNS / SSDP discovery

## Later milestones (not started)

- Dashboard layout rendering
- Widget model
- Homey device/capability bindings
- Live updates
- Display hardware controls beyond recognition

## Manual test checklist (Milestone 2)

### Setup

- [ ] `npm install` succeeds
- [ ] `npm run assets` succeeds
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `homey app validate` passes
- [ ] App runs with `homey app run --remote`

### Registry and recognition

- [ ] App start — no crash; HTTP listening on configured port
- [ ] Add **Shelly Wall Display** and **Generic Web Display** appear as distinct devices
- [ ] Registry populated after pairing (check `/diagnostics`)
- [ ] Shelly configured → `http://IP_HOMEY:7999/` shows correct name, type, IP, ID, layout
- [ ] Generic configured → root shows correct device and layout
- [ ] Unknown IP → “Display not configured” / “Display non configurato”
- [ ] Remove device in Homey → next request from that IP is unconfigured
- [ ] Restart app → no orphans; lastSeen reset; registry rebuilt from Homey Devices

### Shelly mismatch

- [ ] Configure Shelly with IP A and id ABC
- [ ] Put a different Shelly (id XYZ) on IP A (or mock)
- [ ] Root shows “Different device detected” / “Dispositivo diverso rilevato”

### Diagnostics

- [ ] `/diagnostics` accessible when enabled
- [ ] Shows server, port, uptime, displays, online/offline, lastSeen, layout, match status
- [ ] Disable **Enable diagnostics** / **Abilita diagnostica** → `/diagnostics` returns disabled (403)
- [ ] After disconnect/timeout, display becomes offline
- [ ] After app restart, previous lastSeen is not restored

### Translations

- [ ] Homey language English: pairing, settings, HTTP pages
- [ ] Homey language Italian: same strings in Italian
