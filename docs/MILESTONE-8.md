# Milestone 8 — CoverWidget Read-Only & Device Visual Language

**Status:** Done.

## Summary

Introduced read-only **CoverWidget** for Homey window coverings (`windowcoverings_set`), with backend normalization to UX percent `0 = closed … 100 = open`, vertical bar rendering, selective realtime via the existing subscription manager, Dashboard Editor device picker, diagnostics, and a shared decorative device-widget visual language also applied to LightWidget.

## In scope (implemented)

- Widget type `cover` in WidgetRegistry (backend + frontend)
- Compatibility: devices with official `windowcoverings_set`
- Persist only `{ deviceId }`
- Span `1x1` only (architecture allows future spans)
- Normalize Homey `[0,1]` → integer percent for UI
- Vertical bar (fill from bottom; no interpolated motion)
- Realtime via `RealtimeSubscriptionManager` keyed by `(deviceId, capabilityId)`
- Unavailable / removed / invalid value handling (widget stays visible)
- Shared `device-widget` CSS + inline SVG decorative icons (bulb / shutter)
- LightWidget visual update only (toggle/pending/command lifecycle unchanged)
- Editor + validation + diagnostics (raw Homey value + normalized percent)
- IT/EN locales
- Automated tests for compatibility, normalization, runtime, rendering, realtime refs, LightWidget regression

## Out of scope (explicitly deferred)

- Cover slider / open / close / stop commands
- Popups, gestures, interpolated opening/closing
- Homey device icons over the wire (see decisions — API exposes `iconObj` but no documented auth-free LAN URL)
- Other device widgets (sensors, thermostats)

## Frontend performance (measured locally after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML (sample bootstrap page) | 760 B | 438 B |
| CSS | 13844 B | 2698 B |
| JS (minified IIFE) | 28667 B | 8021 B |
| **Total** | **43271 B** | **11157 B** |

Milestone 7 reference total: **36987 B** raw / **10016 B** gzip.

Delta (raw): **+6284 B** (CoverWidget + shared device CSS/icons + editor cover fields). Zero icon libraries. No new runtime npm packages. Inline SVG icons are embedded in JS (no separate icon asset files).

Settings editor bundle (`settings/editor.js`): **18.8 KB**.

Re-measure: `npm run measure:frontend`.

## Official Homey references

- [Window coverings best practices](https://apps.developer.homey.app/the-basics/devices/best-practices/window-coverings)
- Capability definition `windowcoverings_set` (type number, min 0, max 1, “0% is closed, 100% is open”): [node-homey-lib](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/windowcoverings_set.json)
- Realtime: [Device#makeCapabilityInstance](https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#makeCapabilityInstance)
- Device fields `icon` / `iconObj` exist on Homey Web API Device, but are **not** used for wall tiles (no documented auth-free URL for this app’s LAN HTTP server)

## Manual checklist

- [ ] build completed
- [ ] `npm run typecheck` completed without errors
- [ ] lint completed
- [ ] test automatici completed
- [ ] CoverWidget appears in the editor
- [ ] selector shows only compatible devices
- [ ] name + zone correct
- [ ] CoverWidget only 1x1
- [ ] position 0% displayed
- [ ] position 50% displayed
- [ ] position 100% displayed
- [ ] percentage correct
- [ ] vertical bar correct
- [ ] realtime update works
- [ ] no refresh required
- [ ] Device unavailable handled
- [ ] Device removed handled
- [ ] LightWidget receives decorative icon
- [ ] CoverWidget receives decorative icon
- [ ] official Homey icon used only if documented (fallback only in M8)
- [ ] custom fallback works
- [ ] other widgets unaffected
- [ ] diagnostics updated
- [ ] Italian UI
- [ ] English UI
- [ ] bundle delta documented
- [ ] RAM documented (observe via `/diagnostics` on Homey Pro)
- [ ] LightWidget regression completed
