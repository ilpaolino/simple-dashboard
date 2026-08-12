# Milestones

## Milestone 0 — Local HTTP server PoC

**Status:** Done.

Local HTTP server on Homey Pro, Simple Dashboard HTML welcome page, app setting for HTTP port. Details: [MILESTONE-0.md](MILESTONE-0.md).

## Milestone 1 — Wall Display device, pairing, native Homey integration

**Status:** Done.

### In scope (implemented)

- Homey driver **Wall Display**
- Pairing: IP → auto-identify → confirm, or manual adapter
- Adapters: Shelly Wall Display, Generic Web Display
- Device identity ≠ IP
- Initial adapter configuration stored independently
- Native Homey Advanced settings: IP, adapter (label), layout, detected info
- Localization EN + IT
- Automated tests + manual checklist

### Out of scope (explicitly deferred)

- Dashboard UI / Vue / widgets
- Using the stored layout for any rendering
- Flow cards
- WebSocket / realtime
- Controlling Homey devices from the display
- Shelly authentication / digest auth during probe
- mDNS / SSDP discovery (IP is entered manually)
- Repair / unpair custom views
- Changing adapter after pairing
- Homey Cloud / Bridge

## Later milestones (not started)

Planned only as direction, not as interfaces beyond existing adapter/config extension points:

- Dashboard layout rendering
- Widget model
- Homey device/capability bindings
- Live updates
- Display-specific provisioning beyond pairing

## Manual test checklist (Milestone 1)

### Setup

- [ ] `npm install` succeeds
- [ ] `npm run assets` succeeds
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] `homey app validate` passes
- [ ] App runs with `homey app run --remote`

### Pairing Shelly succeeded

- [ ] Add device → Simple Dashboard → Wall Display
- [ ] Enter a reachable Shelly Wall Display IPv4
- [ ] Continue button shows loading while probing
- [ ] Confirm view shows manufacturer, model, firmware, UUID/serial
- [ ] Confirm creates the Homey device
- [ ] Homey logs show `Pairing probe started` and `matched`

### Pairing unknown device

- [ ] Enter an IP that is not a Shelly Wall Display (or unreachable)
- [ ] Continue button shows loading while probing
- [ ] Manual adapter view appears
- [ ] Both **Shelly Wall Display** and **Generic Web Display** are listed
- [ ] Homey logs show `Pairing probe started` and `unrecognized`

### Manual adapter selection

- [ ] Select Generic Web Display and add the device
- [ ] Repeat with Shelly Wall Display on an unrecognized IP (device is created without detected info)

### Device creation and persistence

- [ ] Device appears in Homey with name Wall Display (or detected name)
- [ ] Advanced settings show the entered IP
- [ ] Adapter label matches the chosen/detected adapter
- [ ] Layout dropdown is present
- [ ] Detected info labels are filled for Shelly, or “Not available” / “Non disponibile” for generic
- [ ] Reopen settings after leaving the device — values persist

### IP setting

- [ ] Change IP in Advanced settings to another valid IPv4 and save
- [ ] Device still exists with the **same** Homey device (identity unchanged)
- [ ] Invalid IP is rejected with a translated error

### Unique id

- [ ] Shelly: `data.id` is the Shelly device id (not the IP)
- [ ] Generic: `data.id` is a UUID (not the IP)
- [ ] Pairing the same Shelly again is rejected as a duplicate by Homey

### Layout

- [ ] Shelly device can save `2x2` and `3x3`
- [ ] Shelly device cannot save `2x4` / `3x6` (error shown)
- [ ] Generic device can save `2x4` and `3x6`
- [ ] Generic device cannot save `2x2` / `3x3`

### Translations

- [ ] Homey language English: pairing titles, buttons, errors, settings labels
- [ ] Homey language Italian: same strings in Italian
- [ ] App settings (HTTP port) still translated in both languages

### Milestone 0 regression

- [ ] `http://<HOMEY_IP>:7999/` still serves the Simple Dashboard welcome page
- [ ] Changing the app HTTP port still restarts the server
