# Milestone 15 — Generic Web Display pairing & browser capabilities

**Status:** Done.

## Goal

First-time Generic Web Display setup via **temporary numeric pairing code** correlated to **client IP**. Identity remains IP-based in Device Settings — no browser UUID, localStorage, or cookies.

## Pairing flow

```text
Unknown browser → GET /
        ↓
DisplayRegistry.findByIp → miss
        ↓
GenericDisplayPairingManager.getOrCreateForIp
        ↓
Pairing page (large 6-digit code, 8 min expiry)
        ↓
Homey: Add device → Generic Web Display → enter code
        ↓
GenericCodePairingFlow.validate_code → IP from session
        ↓
Homey.createDevice (settings.ip only; no code persisted)
        ↓
consume(code) → WebSocket pairing-completed → browser reload
        ↓
Same IP → dashboard
```

## Constants

| Constant | Value |
| --- | --- |
| Code length | 6 digits |
| Expiry | 8 minutes |
| Max pending sessions | 64 |
| Cleanup interval | 60 s (global, one timer) |

## Code modules

| Path | Role |
| --- | --- |
| `lib/pairing/GenericDisplayPairingManager.ts` | Runtime sessions; reuse per IP; consume on success |
| `lib/pairing/GenericCodePairingFlow.ts` | Homey pairing handlers |
| `lib/pairing/PairingRealtimeSessionManager.ts` | Limited WS for unpaired clients |
| `lib/pairing/GenericBrowserCapabilityStore.ts` | Runtime browser profile per Generic display |
| `lib/pairing/renderGenericPairingPage.ts` | Standalone pairing HTML + light WS client |
| `drivers/generic_web_display/pair/enter_code.html` | Homey pairing step 1 |
| `drivers/generic_web_display/pair/confirm.html` | Homey pairing step 2 |

## Browser capabilities (runtime only)

Detected via `generic-client-hello` on WebSocket (pairing page + dashboard `RealtimeClient`):

- `touch`
- `fullscreen` (API availability only; not forced)
- `audioPlayback` (capability probe only)
- `canReloadPage` (always true when sent)
- `viewport` (width, height, devicePixelRatio) — diagnostics only; **never** changes layout

## Security

- Unpaired WS: only `generic-client-hello` accepted; widget/notification actions logged and ignored.
- Codes are one-time, expiring, runtime-only; app restart clears all pending codes.
- Pairing codes masked in `/diagnostics` (last two digits visible).

## Expiry UX

Pairing page embeds `expiresAt` and reloads every 30 s if expired (no per-second countdown). Acceptable manual refresh after expiry.

## Shelly unchanged

Shelly driver still uses IP + `Shelly.GetDeviceInfo` pairing. Unknown Shelly browsers may see the Generic pairing page until paired via the Shelly driver.

## Manual checklist

1. Browser at unconfigured IP → pairing page with code.
2. Homey → Generic Web Display → enter code → confirm IP → add.
3. Browser reload → dashboard.
4. Clear browser data at same IP → still recognized.
5. Change client IP → pairing page; update Device Settings IP → dashboard.
6. Wait 8+ min → old code rejected; refresh browser → new code.

## Tests

`test/generic-pairing-m15.test.ts` — manager, flow, capabilities, IP identity, leak cycle.
