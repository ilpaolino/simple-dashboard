# Milestone 14 — Shelly Wall Display Hardware Controls & Capability Discovery

**Status:** Implemented.

## Goal

Expose **only verified** Shelly Wall Display hardware controls via official Gen2+ RPC discovery — without affecting Generic Web Display behavior.

## Architecture

```text
Shelly Wall Display (Homey Device)
        ↓
ShellyHardwareCoordinator (app startup / pairing / maintenance)
        ↓
ShellyWallDisplayHardwareService
        ↓
ShellyWallDisplayRpcClient  →  HTTP GET /rpc/Shelly.ListMethods | Shelly.Reboot
        ↓
ShellyHardwareProfileStore (runtime RAM only)
        ↓
Homey Flow (shelly_reboot_display) + Device Settings labels + /diagnostics
```

## Implemented

| Area | Detail |
| --- | --- |
| RPC discovery | `Shelly.ListMethods` → typed profile + normalized features |
| Pairing | Discovery after `Shelly.GetDeviceInfo`; pairing continues on failure |
| App startup | One sequential discovery per configured Shelly display |
| Manual rediscovery | Homey **Maintenance action** `button.rediscover_hardware` |
| Reboot | Flow Action `shelly_reboot_display` → `Shelly.Reboot` (no extra confirm dialog) |
| Diagnostics | Shelly hardware table + feature matrix + expandable RPC method list |
| i18n | IT/EN for hardware + Flow errors |
| Tests | `test/shelly-hardware-m14.test.ts` (25 cases) |

## Not implemented (by design)

No official Shelly Wall Display RPC documentation was found for:

- display brightness / backlight
- volume / mute / sound playback
- browser reload / screen on-off / wake / sleep

These remain **out of scope** until documented and discovered safely.

## Hardware profile persistence

**Runtime only** (`ShellyHardwareProfileStore`). Rebuilt at pairing, startup, and manual rediscovery. Device Settings show read-only labels synced after discovery; they are not the source of truth.

## Manual checklist

### Pairing

1. Add Shelly Wall Display, enter IP.
2. Confirm hardware summary on confirm step (discovery / reboot / method count).
3. Complete pairing; check Device Settings → Hardware capabilities labels.

### Startup

1. Restart app with Shelly configured.
2. Verify one `Shelly.ListMethods` call per display in logs.
3. Wait — no periodic rediscovery.

### Rediscovery

1. Device → Settings → Maintenance → **Detect hardware capabilities again**.
2. Verify labels + `/diagnostics` hardware section update.

### Reboot Flow

```text
WHEN  manual
THEN  Shelly Wall Display → Reboot display
```

Expect RPC sent, brief disconnect, display returns online.

### Generic isolation

Generic Web Display must not show Shelly reboot Flow card or hardware maintenance action.

## Scripts

```bash
npm install
npm run typecheck
npm run build
npm run lint
npm test
homey app run --remote   # Homey Pro
homey app run            # local Docker (limited)
```

Logs: Homey app log / `homey app log`.
