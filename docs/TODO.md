# TODO

## Milestone 1 follow-up (optional, not blocking)

- [ ] Exercise pairing against a physical Shelly Wall Display on the LAN
- [ ] Confirm Homey duplicate-device behavior when re-pairing the same Shelly id
- [ ] If Homey CLI compose rewrites `app.json`, commit the generated file as-is

## Next milestone (do not start here)

Only when a later milestone is requested:

- [ ] Dashboard rendering that **reads** the stored layout (do not invent a second layout store)
- [ ] Widget model on top of `DeviceConfiguration`
- [ ] Homey capability / device bindings
- [ ] Realtime channel (WebSocket or equivalent), reusing `HttpServer` if possible
- [ ] Flow cards
- [ ] Shelly authenticated RPC if probe fails with 401
- [ ] Optional discovery (mDNS) **in addition to** manual IP, not instead of it

## Rules for future work

- Reuse `WallDisplayAdapter` / `AdapterRegistry` — do not fork pairing logic in the driver
- Persist only via Homey `data`, `store`, `settings`, or app `ManagerSettings`
- No custom settings UI when a Homey setting type already exists
- Keep pairing views on official Homey CSS classes
- Do not add Vue/dashboard code until that milestone is explicit
