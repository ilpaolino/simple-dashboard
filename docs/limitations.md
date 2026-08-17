# Current limitations (v1)

Honest list derived from current code and [KNOWN_ISSUES.md](KNOWN_ISSUES.md). These are not necessarily bugs.

## Platform

| Limitation | Detail |
| --- | --- |
| **Homey Pro only** | `platforms: ["local"]` — not Homey Cloud |
| **Homey >= 12.9.0** | Node.js 22 on Homey |
| **Developer Docker run** | `homey app run` without `--remote` has **no LAN** dashboard access |

## Network & security

| Limitation | Detail |
| --- | --- |
| **LAN trust model** | Display access gated by IPv4 + WebSocket session |
| **Plain HTTP** | No TLS on dashboard port by default |
| **No cloud dashboard** | No official remote access through LocalDashboard itself |
| **IPv4 only** | No hostname pairing or mDNS discovery |
| **Generic identity = IP** | DHCP changes require settings update |
| **No pairing rate limit** | Codes expire in 8 minutes; diagnostics mask partial code |

## Dashboard & editor

| Limitation | Detail |
| --- | --- |
| **Four widget types** | Title, Date/Time, Light, Cover only |
| **No drag-and-drop editor** | Form-based placement with grid preview |
| **No auto layout from viewport** | Browser capabilities are diagnostic only |
| **No orientation auto-switch** | Pick layout in Device settings manually |
| **Reload for major viewport changes** | No continuous resize-driven relayout |

## Realtime & commands

| Limitation | Detail |
| --- | --- |
| **No offline command queue** | Commands not replayed after reconnect |
| **No event replay** | Full snapshot only after disconnect |
| **Fixed command timeouts** | 4 s light; 8 s cover position — not user-configurable |

## Notifications

| Limitation | Detail |
| --- | --- |
| **32 notifications per Display** | Soft cap |
| **No notification history DB** | No archive after remove |
| **Dismiss runtime-only** | Lost on app restart |
| **No global notify-all Flow** | Always per Display device |
| **One CTA per notification** | No multi-button notifications |
| **Controlled icons only** | Eight predefined keys |

## Camera / media

| Limitation | Detail |
| --- | --- |
| **No live RTSP/WebRTC/HLS on wall** | Snapshot refresh (~3 s) when image available |
| **No transcoding on Homey** | `/video` returns 415 |
| **No separate camera overlay** | Media only inside Notification Center |

## Shelly hardware

| Limitation | Detail |
| --- | --- |
| **Discovered features only** | No brightness/volume/reload without official RPC |
| **Reboot only** (v1 hardware command) | When `Shelly.Reboot` discovered |
| **Generic has no Shelly controls** | By design |

## Homey devices on dashboard

| Limitation | Detail |
| --- | --- |
| **Broken bindings stay visible** | Unavailable widgets not auto-deleted |
| **External cloud dependencies** | Some Homey devices may need internet independent of LocalDashboard |

## Future (not v1)

See [TODO.md](TODO.md): sensors, thermostats, global notify Flow, drag-and-drop editor, authenticated Shelly RPC, additional Shelly controls when documented.

## Related

- [Security](security.md)
- [Troubleshooting](troubleshooting.md)
