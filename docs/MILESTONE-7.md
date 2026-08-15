# Milestone 7 — Bidirectional Commands & Interactive LightWidget

## Goal

```text
tap LightWidget
      +
command intent
      +
backend validation
      +
Homey onoff command
      +
pending state
      +
realtime confirmation
      +
timeout/error handling
```

## Architecture implemented

- `WidgetInteractionController` — widgets never build WebSocket payloads
- Protocol: `widget-action` → `command-accepted` | `command-rejected` | `command-timeout`
- `WidgetCommandHandler` — validates display/widget/device, derives toggle target server-side
- `PendingCommandManager` — requestId tracking, timeout **4000 ms**, bounded diagnostics history
- Homey write via official `Device#setCapabilityValue({ capabilityId: 'onoff', value })`
- Confirmation only via Homey realtime (`makeCapabilityInstance` → `widget-state`)
- Diagnostics: command counters + recent command buffer (max 20)

## Mismatch policy

If a command is pending with target ON and Homey reports OFF (or the reverse):

1. Adopt Homey value (source of truth) via normal `widget-state`
2. Clear pending
3. Send `command-rejected` with `unexpected_state`
4. No auto-retry

## Frontend performance (measured locally after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML (sample bootstrap page) | 760 B | 438 B |
| CSS | 10727 B | 2319 B |
| JS (minified IIFE) | 25500 B | 7259 B |
| **Total** | **36987 B** | **10016 B** |

Milestone 6 reference total: **29692 B** raw / **8186 B** gzip.

Delta (raw): **+7295 B** (interaction controller, command protocol, LightWidget pending/error UI). Still zero frontend framework dependencies. No new runtime npm packages.

Re-measure: `npm run measure:frontend`.

## Dependencies

No new dependencies. Uses existing `homey-api@3.16.1` (`setCapabilityValue`) and `ws@8.18.3`.

## Automated tests

| File | Coverage |
| --- | --- |
| `test/widget-interaction-controller.test.ts` | tap→toggle, pending ignore, unavailable, success/timeout/error/disconnect cleanup |
| `test/widget-command-handler.test.ts` | validation matrix, OFF→ON / ON→OFF, concurrent pending, leak cycles |
| `test/command-lifecycle.test.ts` | WS success, API error, mismatch, foreign widget security, socket-loss cleanup |
| Existing M6 gateway / subscription / heartbeat tests | still green |

177 tests passing (`npm test`).

## Manual checklist

See [MILESTONES.md](MILESTONES.md) (Milestone 7 section).

## Open issues

See [KNOWN_ISSUES.md](KNOWN_ISSUES.md).
