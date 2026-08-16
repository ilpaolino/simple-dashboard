# Milestone 10 — Advanced LightWidget Control Panel

**Status:** Done.

## Summary

Extended **LightWidget** with touch-first gestures and a capability-driven **LightControlPanel** hosted in the existing **WidgetControlOverlay**:

- tap → toggle ON/OFF (unchanged security / pending / realtime path)
- long press → open LightControlPanel (never also toggles)

The panel shows only controls Homey officially exposes: ON/OFF, dimmer, color temperature, and hue/saturation color. Dim / temperature / color use normalized UX percents and send-on-release.

## In scope (implemented)

- Tap vs long-press gesture recognizer (`LONG_PRESS_MS = 500`, centralized)
- Reuse `WidgetControlOverlay` (one overlay at a time)
- `LightControlPanel`: power, dim slider, warm/cool temperature, hue/sat color pad
- Capability flags from backend: `{ canToggle, canDim, canSetTemperature, canSetColor }`
- Intents: `toggle`, `set-dim`, `set-temperature`, `set-color` (no raw Homey capability writes from the browser)
- Backend validation + denormalization to Homey `[0,1]`
- Optional `light_mode` write (`color` / `temperature`) when present
- Selective realtime subscriptions for optional light capabilities
- One pending command per widget (simplest robust policy)
- Diagnostics light counters; IT/EN; automated tests; CoverWidget regression preserved

## Out of scope (explicitly deferred)

- Scenes, color presets, animations, effects
- Double-click / swipe / groups / custom transitions
- Heavy color libraries

## Homey capabilities (official)

| UX | Homey capability | Homey range | Frontend percent |
| --- | --- | --- | --- |
| ON/OFF | `onoff` | boolean | — |
| Brightness | `dim` | `[0,1]` | 0…100 |
| Color temperature | `light_temperature` | `[0,1]` (higher = warmer) | 0 cool … 100 warm |
| Hue | `light_hue` | `[0,1]` | 0…100 |
| Saturation | `light_saturation` | `[0,1]` | 0…100 |
| Mode (optional write) | `light_mode` | `color` \| `temperature` | — |

Color UI requires **both** `light_hue` and `light_saturation`.

## Confirmation / timeouts

| Action | Confirmation | Timeout |
| --- | --- | --- |
| `toggle` | `onoff` match | 4000 ms |
| `set-dim` | dim within 1% | 4000 ms |
| `set-temperature` | temperature within 1% | 4000 ms |
| `set-color` | hue **and** saturation within 1% | 4000 ms |

## Frontend performance (measured locally after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML (sample bootstrap page) | 760 B | 438 B |
| CSS | 24193 B | 4284 B |
| JS (minified IIFE) | 63222 B | 14415 B |
| **Total** | **88175 B** | **19137 B** |

Milestone 9 reference total: **64171 B** raw / **15098 B** gzip.

Delta (raw): **+24004 B** (gesture + LightControlPanel + shared control CSS + light intents). Zero new runtime npm packages. Color picker is CSS + Pointer Events only.

Re-measure: `npm run measure:frontend`.

## Official Homey references

- [Lights best practices](https://apps.developer.homey.app/the-basics/devices/best-practices/lights)
- [Capabilities](https://apps.developer.homey.app/the-basics/devices/capabilities)
- `dim`: [capability JSON](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/dim.json)
- `light_temperature` (higher = warmer): [capability JSON](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/light_temperature.json)
- `light_hue`: [capability JSON](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/light_hue.json)
- `light_saturation`: [capability JSON](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/light_saturation.json)
- `light_mode`: [capability JSON](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/light_mode.json)
- [Device#setCapabilityValue](https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#setCapabilityValue)

## Manual checklist

- [ ] build completed
- [ ] `npm run typecheck` without errors
- [ ] lint completed
- [ ] test automatici completed
- [ ] tap LightWidget continua a fare toggle
- [ ] long press apre panel
- [ ] long press non genera toggle
- [ ] ON/OFF presente nel panel
- [ ] Device onoff-only mostra solo ON/OFF
- [ ] dimmer appare solo se supportato
- [ ] temperature appare solo se supportata
- [ ] color picker appare solo se supportato
- [ ] dim preview locale
- [ ] dim command solo al rilascio
- [ ] temperature preview locale
- [ ] temperature command solo al rilascio
- [ ] color preview locale
- [ ] color command solo al rilascio
- [ ] current vs target distinti
- [ ] realtime dim funziona
- [ ] realtime temperature funziona
- [ ] realtime color funziona
- [ ] unavailable disabilita controlli
- [ ] close overlay non annulla comando
- [ ] config live gestita
- [ ] regression CoverWidget completata
- [ ] security validation completata
- [ ] diagnostics aggiornata
- [ ] UI italiana
- [ ] UI inglese
- [ ] bundle/RAM documentati
- [ ] leak test completato
