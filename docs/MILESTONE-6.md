# Milestone 6 — WebSocket Realtime & Live Dashboard Synchronization

## Goal

```text
WebSocket
   +
Homey realtime
   +
subscription selective
   +
reference counting
   +
live widget state
   +
live dashboard configuration
   +
reconnect + snapshot
```

## Architecture implemented

- `lib/realtime/` — protocol, metrics, sessions, subscription manager, gateway
- `ws@8.18.3` attached to the existing Node `http.Server` (`noServer` + `upgrade`)
- Path: `/realtime` on the configured HTTP port
- `HomeyDeviceRepository.subscribeCapability` → official `makeCapabilityInstance`
- Frontend `RealtimeClient` + `ConnectionOverlay`
- Diagnostics: WS active, connections, subscriptions, refCounts, metrics

## Frontend performance (measured locally after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML (sample bootstrap page) | 760 B | 438 B |
| CSS | 9624 B | 2104 B |
| JS (minified IIFE) | 19308 B | 5644 B |
| **Total** | **29692 B** | **8186 B** |

Milestone 5 reference total: **24316 B** raw / **6901 B** gzip.

Delta (raw): **+5376 B** (realtime client, overlay CSS, protocol). Still zero frontend framework dependencies. `ws` and `homey-api` are **backend-only**.

Re-measure: `npm run measure:frontend`.

## Dependencies

| Dependency | Kind | Reason |
| --- | --- | --- |
| `ws@8.18.3` | **runtime (Homey Pro)** | Lightweight WebSocket server sharing the HTTP port |
| `homey-api@3.16.1` | **runtime (Homey Pro)** | `createAppAPI` + `makeCapabilityInstance` |
| `esbuild` | **dev only** | Bundle dashboard + settings editor IIFEs |
| *(none)* | frontend runtime | Vanilla `WebSocket`, `Intl`, DateTime `setInterval` only |

## Automated tests

| File | Coverage |
| --- | --- |
| `test/realtime-gateway.test.ts` | Valid/unknown Display, snapshot, routing, duplicate socket, reconnect snapshot, live config, offline no queue, leak cycles |
| `test/realtime-subscription-manager.test.ts` | refCount, multi-device, config diff, routing, device removed, disconnect cleanup |
| `test/realtime-heartbeat.test.ts` | Heartbeat ack success, zombie timeout close |
| `test/display-registry.test.ts` | Online only with realtime session |

150 tests passing (`npm test`).

## Manual checklist

See [MILESTONES.md](MILESTONES.md) (Milestone 6 section).

## Open issues

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
