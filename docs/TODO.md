# TODO

## Milestone 3 follow-up (optional, not blocking)

- [ ] Measure RSS/heap on Homey Pro via `/diagnostics` and paste numbers into [MILESTONE-3.md](MILESTONE-3.md)
- [ ] Exercise 2×2 / 3×3 on a physical Shelly Wall Display
- [ ] Exercise 2×4 / 3×6 on a Generic browser in portrait
- [ ] Exercise 4×2 / 6×3 on a Generic browser in landscape
- [ ] If Homey CLI compose rewrites `app.json`, commit the generated file as-is

## Next milestone (do not start here)

Only when a later milestone is requested:

- [ ] Widget model on top of `GridPlacement` / cell ids
- [ ] Homey capability / device bindings
- [ ] Realtime channel (WebSocket or equivalent), reusing `HttpServer` if possible
- [ ] Flow cards
- [ ] Shelly authenticated RPC if probe fails with 401
- [ ] Shelly hardware controls (reboot, brightness, volume) via official APIs only
- [ ] Optional discovery (mDNS) **in addition to** manual IP, not instead of it

## Rules for future work

- Homey Devices remain the only persistence for display configuration
- Keep `DisplayRegistry` runtime-only
- Keep frontend vanilla (no UI frameworks) unless an explicit milestone overturns that decision
- Reuse `lib/dashboard` geometry and cell identity — do not fork per widget
- Persist only via Homey `data`, `store`, `settings`, or app `ManagerSettings`
