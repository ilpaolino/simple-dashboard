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

### In scope (implemented)

- Permission `homey:manager:api` + official `HomeyAPI.createAppAPI`
- `HomeyDeviceRepository` (list, lookup, capabilities, zone, availability)
- Server-side LightWidget compatibility (`onoff`)
- Dashboard Editor device selector (name + zone; “No zone” fallback)
- `LightWidget` 1×1, read-only name + ON/OFF snapshot at load
- Config stores only `deviceId`; runtime DTO is separate
- Broken / removed / unavailable devices stay visible
- Isolated widget failures; diagnostics for each LightWidget
- Automated repository / compatibility / runtime / renderer / snapshot-semantics tests

### Out of scope (explicitly deferred)

- ON/OFF control, dimmer, color, color temperature
- WebSocket / SSE / polling / Homey capability listeners
- Flow cards / notifications
- Drag & drop / advanced visual editor
- Overlays / cameras

## Later milestones (not started)

- LightWidget control (set `onoff`)
- Dim / color / temperature on the same `deviceId`
- Live configuration / state channel (`updateWidgetState`)
- Additional widget types (covers, sensors, thermostats)
- Display hardware controls beyond recognition

## Manual test checklist (Milestone 5)

- [ ] Build completed
- [ ] TypeScript strict without errors
- [ ] lint completed
- [ ] test automatici completed
- [ ] permesso Homey verificato (`homey:manager:api`)
- [ ] Dashboard Editor apre elenco Device compatibili
- [ ] Device senza `onoff` non appare
- [ ] nome Device visibile
- [ ] zona Device visibile
- [ ] zona assente gestita
- [ ] LightWidget aggiungibile
- [ ] LightWidget solo 1x1
- [ ] luce ON visualizzata correttamente
- [ ] luce OFF visualizzata correttamente
- [ ] nome aggiornato dopo rename + refresh
- [ ] Device rimosso → Device non disponibile
- [ ] Device unavailable gestito
- [ ] LightWidget rotto non blocca altri widget
- [ ] nessun realtime introdotto
- [ ] nessun polling introdotto
- [ ] diagnostics aggiornata
- [ ] UI italiana
- [ ] UI inglese
- [ ] estetica coerente con Homey
- [ ] bundle size documentata
- [ ] dipendenze documentate
