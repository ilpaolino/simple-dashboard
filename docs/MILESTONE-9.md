# Milestone 9 — Interactive CoverWidget & Position Control

**Status:** Done.

## Summary

Made **CoverWidget** interactive: tile tap opens a reusable **WidgetControlOverlay** hosting **CoverControlPanel**. Position is set via a vertical send-on-release slider (and Open/Close shortcuts). Stop is shown only when Homey documents `windowcoverings_state`. Commands use widget intents; Homey remains source of truth with distinct current vs pending target and no movement interpolation.

## In scope (implemented)

- Tap CoverWidget → open control overlay (no direct move)
- Global `WidgetControlOverlay` (one at a time; outside the grid)
- `CoverControlPanel`: name, current, target, vertical slider, Open/Close, conditional Stop
- Send-on-release via Pointer Events (no commands during drag)
- Widget intents: `set-position` (+ `positionPercent`), `stop`
- Backend validation + denormalization to Homey `windowcoverings_set` `[0,1]`
- Stop via official `windowcoverings_state` → `idle` only when capability present
- Runtime capability flags `{ canSetPosition, canStop }` from backend
- Pending/confirmation with cover-specific timeout; first coherent progress or ±1% tolerance
- `command-succeeded` protocol message (covers intermediate progress safely)
- Live config: overlay closes if widget removed; device rebind closes for safety
- Closing overlay does not cancel in-flight Homey commands
- Diagnostics cover command counters + recent baseline→target
- IT/EN copy; automated tests; LightWidget regression preserved

## Out of scope (explicitly deferred)

- Advanced tile gestures (double-tap, long-press, swipe)
- Light dimmer/color panels
- Multi-cover groups, timers, simulated motion, Flow/Scene

## Confirmation semantics

| Action | Confirmation |
| --- | --- |
| `set-position` | Homey `windowcoverings_set` within **1%** of target **or** first coherent progress toward target from baseline. Timeout **8000 ms** (ack/start, not full travel). |
| `stop` | Homey `windowcoverings_state` === `idle`. Timeout **4000 ms**. May replace an in-flight set-position. |
| Light `toggle` | Unchanged; also emits `command-succeeded` on match. |

## Frontend performance (measured locally after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML (sample bootstrap page) | 760 B | 438 B |
| CSS | 19153 B | 3538 B |
| JS (minified IIFE) | 44258 B | 11122 B |
| **Total** | **64171 B** | **15098 B** |

Milestone 8 reference total: **43271 B** raw / **11157 B** gzip.

Delta (raw): **+20900 B** (overlay + CoverControlPanel + command protocol + cover intents). Zero new runtime npm packages. No slider libraries.

Settings editor bundle (`settings/editor.js`): **18.9 KB**.

Re-measure: `npm run measure:frontend`.

## Official Homey references

- [Window coverings best practices](https://apps.developer.homey.app/the-basics/devices/best-practices/window-coverings)
- `windowcoverings_set` (0 closed … 1 open): [capability JSON](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/windowcoverings_set.json)
- `windowcoverings_state` (`up` / `idle` / `down` — stop = `idle`): [capability JSON](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/windowcoverings_state.json)
- [Device#setCapabilityValue](https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#setCapabilityValue)
- [Device#makeCapabilityInstance](https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#makeCapabilityInstance)

## Manual checklist

- [ ] build completed
- [ ] `npm run typecheck` without errors
- [ ] lint completed
- [ ] test automatici completed
- [ ] tap CoverWidget apre overlay
- [ ] overlay touch-friendly
- [ ] slider verticale
- [ ] 100% in alto
- [ ] 0% in basso
- [ ] drag non invia comandi
- [ ] rilascio invia un solo comando
- [ ] target visibile
- [ ] current state separato
- [ ] realtime progress visibile
- [ ] nessuna interpolazione fake
- [ ] Apri = 100%
- [ ] Chiudi = 0%
- [ ] Stop solo se supportato
- [ ] pending coerente
- [ ] timeout gestito
- [ ] errore gestito
- [ ] unavailable disabilita controlli
- [ ] chiusura overlay non cancella comando già inviato
- [ ] click fuori chiude
- [ ] X chiude
- [ ] Escape chiude
- [ ] una sola overlay attiva
- [ ] rimozione widget live chiude overlay
- [ ] security validation completata
- [ ] regression LightWidget completata
- [ ] diagnostics aggiornata
- [ ] UI italiana
- [ ] UI inglese
- [ ] RAM/bundle documentati
- [ ] leak test completato
