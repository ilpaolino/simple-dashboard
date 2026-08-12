# TODO

## Milestone 2 follow-up (optional, not blocking)

- [ ] Exercise recognition against a physical Shelly Wall Display on the LAN
- [ ] Confirm offline transition after 5 minutes without requests
- [ ] If Homey CLI compose rewrites `app.json`, commit the generated file as-is

## Next milestone (do not start here)

Only when a later milestone is requested:

- [ ] Dashboard rendering that **reads** the stored layout (do not invent a second layout store)
- [ ] Widget model on top of `DeviceConfiguration`
- [ ] Homey capability / device bindings
- [ ] Realtime channel (WebSocket or equivalent), reusing `HttpServer` if possible
- [ ] Flow cards
- [ ] Shelly authenticated RPC if probe fails with 401
- [ ] Shelly hardware controls (reboot, brightness, volume) via official APIs only
- [ ] Optional discovery (mDNS) **in addition to** manual IP, not instead of it

## Rules for future work

- Homey Devices remain the only persistence for display configuration
- Keep `DisplayRegistry` runtime-only
- Reuse adapters / pairing / request handler — do not fork per driver
- Persist only via Homey `data`, `store`, `settings`, or app `ManagerSettings`
- Do not add Vue/dashboard code until that milestone is explicit
