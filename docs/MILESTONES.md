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

### In scope (implemented)

- WebSocket on the same configurable HTTP port (`/realtime`)
- Typed bidirectional protocol (discriminated unions, protocol version 1)
- One `DisplayRealtimeSession` per Display; unknown clients rejected
- Initial + reconnect full snapshots (no event replay)
- Live LightWidget `onoff` via Homey `makeCapabilityInstance`
- `RealtimeSubscriptionManager` with reference counting and selective routing
- Live full dashboard configuration push after editor save
- Connection overlay + exponential reconnect backoff
- Heartbeat with zombie timeout cleanup
- Diagnostics for WS server, sessions, subscriptions, metrics
- Automated tests for gateway, subscriptions, heartbeat, routing, reconnect

### Out of scope (explicitly deferred)

- ON/OFF control, dimmer, color, color temperature from the display
- Flow cards / notifications / cameras / overlays beyond connection loss
- Socket.IO
- Cloud auth beyond local IP Display binding

## Later milestones (not started)

- LightWidget control (set `onoff`)
- Dim / color / temperature on the same `deviceId`
- Additional widget types (covers, sensors, thermostats)
- Display hardware controls beyond recognition

## Manual test checklist (Milestone 6)

- [ ] Build completed
- [ ] TypeScript strict without errors
- [ ] lint completed
- [ ] test automatici completed
- [ ] HTTP continues to work on 7999
- [ ] WebSocket uses the same port
- [ ] Display valido apre socket
- [ ] Display sconosciuto rifiutato
- [ ] snapshot iniziale ricevuto
- [ ] LightWidget si aggiorna live OFF → ON
- [ ] LightWidget si aggiorna live ON → OFF
- [ ] nessun refresh necessario
- [ ] Display non interessato non riceve evento
- [ ] due Display stesso Device → una subscription condivisa
- [ ] refCount corretto
- [ ] unsubscribe a refCount zero
- [ ] modifica TitleWidget live
- [ ] modifica DateTimeWidget live
- [ ] aggiunta LightWidget live
- [ ] rimozione LightWidget live
- [ ] cambio posizione live
- [ ] perdita connessione mostra overlay
- [ ] riconnessione automatica
- [ ] overlay resta finché snapshot non applicata
- [ ] snapshot corregge stato perso offline
- [ ] heartbeat funziona
- [ ] socket zombie viene chiuso
- [ ] socket duplicato gestito
- [ ] Device Homey rimosso → widget unavailable live
- [ ] Display offline non accumula messaggi
- [ ] diagnostics aggiornata
- [ ] UI italiana
- [ ] UI inglese
- [ ] RAM documentata
- [ ] subscription count documentato
- [ ] leak test completato
