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

### In scope (implemented)

- Custom App Settings Dashboard Editor (Homey Style Library + Web API)
- Per-device widget persistence via Device Store
- Explicit `WidgetPlacement` with overlap / bounds validation
- Multi-cell widgets as single rectangles
- `WidgetRegistry` + isolated Title / DateTime widgets
- Browser-local DateTime updates (`Intl` + timer cleanup)
- Diagnostics: widget count/types, dashboard errors, last loaded config
- Device Settings note pointing to App Settings
- Automated registry / placement / config / renderer tests

### Out of scope (explicitly deferred)

- Homey capability control (lights, covers, sensors, thermostats, …)
- WebSocket / realtime push
- Flow cards / notifications
- Drag & drop / advanced visual editor
- Overlays / cameras
- Dynamic resize listeners

## Later milestones (not started)

- Homey device bindings for widgets
- Live configuration / state channel
- Additional widget types
- Display hardware controls beyond recognition

## Manual test checklist (Milestone 4)

- [ ] Build completed
- [ ] TypeScript strict without errors
- [ ] lint completed
- [ ] test automatici completed
- [ ] App Settings Dashboard Editor accessible
- [ ] selezione Display
- [ ] griglia corretta visualizzata
- [ ] celle occupate/libere visibili
- [ ] aggiunta TitleWidget 2x1
- [ ] aggiunta TitleWidget 3x1
- [ ] allineamento left
- [ ] allineamento center
- [ ] allineamento right
- [ ] aggiunta DateTimeWidget 1x1
- [ ] aggiunta DateTimeWidget 2x1
- [ ] mode time
- [ ] mode date
- [ ] mode date-time
- [ ] data/ora si aggiornano senza reload
- [ ] widget multi-cella senza divisioni interne
- [ ] collisione impedita
- [ ] widget fuori griglia impedito
- [ ] modifica widget
- [ ] rimozione widget
- [ ] refresh Wall Display applica nuova configurazione
- [ ] seconda applyConfiguration funziona
- [ ] nessun timer orfano
- [ ] Device Settings mostra nota verso App Settings
- [ ] UI italiana
- [ ] UI inglese
- [ ] diagnostics aggiornata
- [ ] bundle size documentata
- [ ] dipendenze documentate
