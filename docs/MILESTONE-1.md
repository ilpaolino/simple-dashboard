# Milestone 1 — Wall Display Device, Pairing & Native Homey Integration

## Architecture implemented

- Driver `wall_display` with custom pairing views and the system `loading` template
- `PairingFlow` owns session state; adapters own protocols
- Device identity in `data.id`; IP / layout / labels in native Homey settings; configuration snapshot in the device store
- Shelly adapter: `GET /rpc/Shelly.GetDeviceInfo`
- Generic adapter: no probe
- Localization `en` + `it`

See [ARCHITECTURE.md](ARCHITECTURE.md) and [DECISIONS.md](DECISIONS.md).

## Automated tests

| File | What it covers |
| --- | --- |
| `test/ipv4.test.ts` | IPv4 parsing |
| `test/shelly-adapter.test.ts` | GetDeviceInfo parse, Wall Display vs other Shelly, HTTP failure |
| `test/generic-adapter.test.ts` | No auto-identify; 2x4/3x6 config |
| `test/adapter-registry.test.ts` | First match wins; unrecognized fallback |
| `test/pairing-payload.test.ts` | Identity ≠ IP; settings/store payload |
| `test/device-settings.test.ts` | IP / adapter / layout validation |
| `test/pairing-flow.test.ts` | Pairing steps: confirm vs manual adapter |
| `test/json-http-client.test.ts` | fetch JSON GET + HTTP status errors |
| Existing M0 tests | Logger, port, HTTP server, welcome page, app settings manager |

## Manual checklist

See [MILESTONES.md](MILESTONES.md) (Milestone 1 section).

## Open issues

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
