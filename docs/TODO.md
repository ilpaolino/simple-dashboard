# TODO

## A. Required before v1 release (manual on Homey Pro)

Use the checklist in [MILESTONE-16.md](MILESTONE-16.md). Automated validation must be green first:

```bash
npm run typecheck && npm run build && npm test && npm run measure:frontend && homey app validate
```

Nothing in this section is complete until executed on real Homey Pro hardware.

## B. Manual Homey Pro verification (representative)

- [ ] Upgrade from a pre-M16 dev install — devices, dashboard, Flows intact
- [ ] Generic pairing end-to-end on a wall browser
- [ ] Shelly pairing + optional reboot Flow
- [ ] Notification + camera media + auto-close on a real camera device
- [ ] Repeated connect/disconnect — diagnostics counts return toward baseline

## C. Future / non-blocking (post-v1)

- [ ] Optional global Flow: show notification on all Displays
- [ ] Additional widget types (sensors, thermostats)
- [ ] Drag & drop editor enhancements (still Homey App Settings only)
- [ ] Shelly authenticated RPC if probe fails with 401
- [ ] Additional Shelly hardware controls when officially documented (brightness, volume, …)
- [ ] Pairing brute-force rate limiting (if LAN threat model changes)
