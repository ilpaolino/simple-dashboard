# Security model

LocalDashboard is designed for a **trusted local LAN** on Homey Pro — not as an internet-facing zero-trust service.

## Trust assumptions

| Assumed | Not assumed |
| --- | --- |
| Homey Pro and Displays on private LAN | Internet attackers |
| Physical or network access to LAN implies some trust | Stolen browser cookies as identity |
| Operator configures correct Display IPs | Clients may spoof arbitrary identities without mitigation |

## Protections implemented

### Display routing

- HTTP and WebSocket associate clients with Displays by **source IP** (TCP remote address).
- **`X-Forwarded-For` is ignored** on the direct LAN server to prevent IP spoofing via headers.
- Unknown IPs cannot receive another Display’s dashboard configuration.
- Unpaired WebSocket connections cannot execute widget commands or notification actions.

### Widget commands

- Browser sends **widget intents** only: `{ widgetId, action, … }`.
- Backend resolves `deviceId`, capability, and values from **stored dashboard config** + Homey state.
- Client cannot command arbitrary Homey devices or capabilities.

### Notification actions

- CTA sends `{ notificationId, actionId, … }`.
- Backend validates against authoritative notification state before triggering Flow.
- No Display→raw Homey capability writes for notification buttons.

### Camera / media

- No arbitrary URL proxy.
- Image bytes served only for matching Display IP + notification + backend media binding.
- Credentials and stream URLs stay on Homey/backend.

### Pairing

- Six-digit codes expire (**8 minutes**).
- Codes are runtime-only; consumed after use.
- Diagnostics **mask** codes (not full secret).

### Malformed input

- JSON / protocol validation fails closed.
- Unknown WebSocket message types logged/rejected for unpaired clients.

## Current limitations (honest)

| Limitation | Implication |
| --- | --- |
| **Plain HTTP** on LAN | No TLS between browser and Homey for dashboard traffic |
| **No cloud auth** | Anyone who can reach port 7999 from LAN can attempt access |
| **IPv4 IP binding** | Generic Displays identified by configured IP — DHCP changes need settings update |
| **No pairing brute-force rate limit** | Codes expire; diagnostics expose partial digits when enabled |
| **LAN attacker with IP spoofing at L2** | Outside LocalDashboard’s threat model |

Do not expose port 7999 to the public internet without additional network controls.

## What LocalDashboard does not protect against

- Compromised Homey account with app install rights
- Malicious actor on LAN who can assign themselves a Display’s IP (network reconfiguration)
- Vulnerabilities in Homey platform or third-party device apps

## Related

- [Limitations](limitations.md)
- [Generic Web Display](generic-web-display.md)
- [Camera media](camera-media.md)
- [DECISIONS.md](DECISIONS.md)
