# LocalDashboard

**LocalDashboard** is a Homey Pro application that turns compatible wall displays and generic web browsers into locally hosted Homey dashboards.

The LocalDashboard app runs **on your Homey Pro**. It hosts the dashboard HTTP and WebSocket infrastructure directly on the hub and communicates with each Display over your **local network (LAN)**. You open a dashboard in a browser at an address such as:

```text
http://<HOMEY_LAN_IP>:7999/
```

### Why “LocalDashboard”?

The name reflects how the product is built: dashboard delivery and Display communication are designed around the **local LAN**, not an external cloud dashboard service.

This does **not** mean every Homey device shown on a dashboard is cloud-independent. Some Homey integrations or devices may rely on external services. The claim is about **LocalDashboard’s own Display infrastructure** — the server, realtime channel, and pairing model run on Homey Pro and your LAN.

### Technical app identifier

The user-facing product name is **LocalDashboard**. The Homey application id remains **`dev.dadda.simpledashboard`** for upgrade compatibility with existing installations.

---

## What problem does LocalDashboard solve?

A Homey home may have lights, covers, cameras, and automations — but a **permanently mounted wall display** needs a UI that is:

- always available on the LAN;
- simple and touch-friendly;
- configurable per screen;
- lightweight for embedded browsers;
- synchronized with Homey in realtime;
- free of heavyweight frontend frameworks.

LocalDashboard provides that UI. Each physical or logical Display is represented as a **Homey Device** with its own layout and widget configuration:

```text
Homey
 ├── Kitchen Wall Display      → own dashboard
 ├── Entrance Wall Display     → own dashboard
 └── Bedroom tablet (Generic)  → own dashboard
```

You configure dashboards from **Homey → Apps → LocalDashboard → App Settings → Dashboard Editor**. The Display browser only renders what Homey stores for that device.

---

## Supported Display types

LocalDashboard ships two drivers:

| | [Shelly Wall Display](docs/shelly-wall-display.md) | [Generic Web Display](docs/generic-web-display.md) |
| --- | --- | --- |
| **Hardware** | Shelly Wall Display panel | Tablets, phones, kiosk browsers, PCs |
| **Pairing** | Enter Shelly IPv4 in Homey | Browser shows 6-digit code; enter code in Homey |
| **Identity** | Homey `data.id` = Shelly hardware id when detected | Homey `data.id` = generated UUID |
| **Runtime routing** | Configured IPv4 (`settings.ip`) | Configured IPv4 (`settings.ip`) |
| **Hardware discovery** | Yes (`Shelly.ListMethods`) | No |
| **Hardware commands** | Reboot (when discovered) | None |
| **Browser capabilities** | No | Reported at runtime (diagnostics) |
| **Grid layouts** | 2×2, 3×3 | 2×4, 4×2, 3×6, 6×3 |
| **Dashboard / widgets / notifications** | Yes | Yes |

Full comparison and pairing walkthroughs: [Displays](docs/displays.md).

---

## Local server (HTTP + WebSocket)

| Topic | Detail |
| --- | --- |
| **Where it runs** | Inside LocalDashboard on Homey Pro |
| **Default port** | **7999** (HTTP and WebSocket share this port) |
| **Configuration** | Homey → Apps → LocalDashboard → App Settings |
| **Dashboard URL** | `http://<HOMEY_LAN_IP>:7999/` |
| **Diagnostics URL** | `http://<HOMEY_LAN_IP>:7999/diagnostics` (when enabled) |
| **WebSocket path** | `/realtime` (same port, upgraded from HTTP) |
| **Port change** | Saves in app settings; server restarts automatically |
| **Homey Pro required** | LAN bind, device probe, and Homey API access need the app on real hardware (`homey app run --remote` or `homey app install`) |
| **Ports &lt; 1024** | May fail on Homey; use 7999 or another high port |

Details: [Getting started](docs/getting-started.md).

---

## How Display recognition works

When a browser requests `/`:

```text
Browser HTTP request
        ↓
Client IP address (LAN)
        ↓
DisplayRegistry lookup
        ↓
Known Display configured in Homey?
   ├── yes → validate layout → serve dashboard HTML + bootstrap
   └── no  → Generic pairing page (6-digit code) or error page
```

For **Shelly** displays, LocalDashboard can additionally verify that the hardware identity at the IP matches the Homey device’s stored id.

Important distinction:

- **Homey Device identity** (`data.id`) — what Homey stores as the device; Shelly uses hardware id, Generic uses a UUID generated at pairing.
- **IP routing address** (`settings.ip`) — where to send HTTP/WebSocket traffic; **not** the permanent identity.

Details: [Displays](docs/displays.md) · [Generic Web Display](docs/generic-web-display.md).

---

## Dashboard configuration (summary)

Dashboards are **not** edited on the Display itself.

```text
Homey → Apps → LocalDashboard → App Settings → Dashboard Editor
```

1. Select a Display (Homey device).
2. Choose **dark** or **light** theme for that Display.
3. Add widgets (Title, Date & Time, Light, Cover).
4. Set grid position, size (span), and widget-specific options.
5. Save — connected Displays receive updates **live** over WebSocket.

Device Advanced Settings show a read-only note pointing to App Settings for grid/widgets.

Full guide: [Dashboard Editor](docs/dashboard-editor.md) · [Grid & layout](docs/grid-and-layout.md) · [Widgets](docs/widgets.md).

---

## Widgets (current v1 set)

| Widget | Purpose | Interaction |
| --- | --- | --- |
| **Title** | Room name, section heading | Read-only |
| **Date & Time** | Live clock/date | Read-only (client timer) |
| **Light** | Homey light (`onoff` + optional dim/color/temp) | Tap toggle; long-press advanced panel |
| **Cover** | Homey cover (`windowcoverings_set`) | Tap → position overlay |

Notifications are **not** widgets — they are global overlay chrome. See [Notifications](docs/notifications.md).

Full widget reference: [Widgets](docs/widgets.md).

---

## Realtime synchronization (summary)

```text
Homey device capability
        ↓
Backend subscription (selective, reference-counted)
        ↓
WebSocket /realtime
        ↓
Specific Display browser
        ↓
Widget state update
```

- After connect: **full dashboard snapshot** (config + widget states + visible notifications).
- While connected: incremental `widget-state` and notification messages.
- On disconnect: **connection lost overlay** until a new snapshot arrives.
- **No offline command queue** — commands are not replayed after reconnect.

Details: [Realtime](docs/realtime.md).

---

## Notifications (summary)

- Global **Notification Center** and corner **severity ribbon** — not grid cells.
- Created/updated/removed by **Homey Flow** (or app Web API for diagnostics).
- **Notification Key** enables upsert per Display (`doorbell` updates `doorbell`, not duplicate).
- **Local dismiss** hides on one Display only; Homey remains source of truth.
- **Interactive** cards support auto-open, auto-close, optional **Action ID** button, optional camera/media.

Action ID explained: [Notification actions](docs/notification-actions.md)  
Camera/media: [Camera media in notifications](docs/camera-media.md)  
Flow cards: [Notifications](docs/notifications.md).

---

## Shelly hardware (summary)

Shelly-specific features are **discovered** via official `Shelly.ListMethods` RPC — not guessed. Currently implemented hardware command: **Reboot** (Flow Action, when supported). Brightness, volume, and similar controls are **not** faked.

Details: [Shelly Wall Display](docs/shelly-wall-display.md).

---

## Diagnostics

Enable in App Settings, then open `/diagnostics` on the same port. Shows memory, configured Displays, WebSocket sessions, subscriptions, commands, notifications, media, Generic pairing, browser capabilities, and Shelly hardware profiles — **without** exposing tokens, credentials, or full pairing codes.

Details: [Diagnostics](docs/diagnostics.md).

---

## Data persistence (summary)

| Survives app restart | Does not survive app restart |
| --- | --- |
| HTTP port, diagnostics toggle | WebSocket sessions |
| Homey Display devices & settings | Active notifications |
| Dashboard config (Device Store `dashboard`) | Local notification dismiss |
| Widget device bindings (`deviceId`) | Pending pairing codes |
| | Shelly hardware profile (re-discovered) |
| | Pending widget commands |

Full table and failure scenarios: [Data & persistence](docs/data-and-persistence.md).

---

## Security model (summary)

Designed for a **trusted local LAN**:

- Display routing by configured IP / authenticated WebSocket session.
- Browser sends **widget intents** only — backend resolves Homey device and capability.
- No arbitrary URL proxy; camera credentials stay on Homey/backend.
- Pairing codes expire (8 minutes); diagnostics mask codes.

Not included in v1: TLS/HTTPS, cloud authentication, browser UUID identity.

Details: [Security](docs/security.md).

---

## Lightweight design

- Vanilla HTML/CSS/TypeScript frontend — **no runtime framework**.
- Measured build (current repo): CSS ~42 KB, JS ~104 KB raw (~30 KB gzip total) — see `npm run measure:frontend`.
- Selective Homey capability subscriptions with reference counting.
- No polling for normal widget state; no ffmpeg / video transcoding on Homey.

Details: [Development](docs/development.md).

---

## Installation (quick)

**Requirements:** Homey Pro (local platform), Homey `>=12.9.0`, LAN access to Homey.

**Developer machine:**

```bash
npm install
npm run assets
npm run build
npm test
homey app run --remote    # LAN access requires --remote
```

**End user:** Install LocalDashboard on Homey Pro via Homey App Store or developer install, pair Display devices, configure App Settings.

Full guide: [Getting started](docs/getting-started.md).

---

## First-time walkthrough

1. Install LocalDashboard on Homey Pro.
2. Open **App Settings** — verify port **7999**, enable diagnostics if needed.
3. **Add device** → LocalDashboard → Shelly or Generic → complete pairing.
4. Set **layout** in Device Advanced Settings.
5. Open **Dashboard Editor** — select Display, add Title + Date/Time + Light, save.
6. Open `http://<HOMEY_LAN_IP>:7999/` on the Display browser.
7. Confirm live state updates and tap a light.
8. Optional: create a Flow **Show notification** on that Display.

Step-by-step: [Getting started — first configuration](docs/getting-started.md#first-configuration-walkthrough).

---

## Examples

Worked examples (kitchen dashboard, entrance doorbell, Generic tablet): [Examples](docs/examples.md).

---

## Troubleshooting

Common issues (Display not configured, connection lost, widget unavailable, Action ID mismatch, camera image missing, …): [Troubleshooting](docs/troubleshooting.md).

---

## Current limitations

Honest v1 limits (IP-based Generic identity, no HTTPS, no live RTSP on wall browser, …): [Limitations](docs/limitations.md).

---

## Documentation map

### User & operator guides

| Document | Contents |
| --- | --- |
| [Getting started](docs/getting-started.md) | Install, URLs, first walkthrough |
| [Displays](docs/displays.md) | Display model, Shelly vs Generic |
| [Shelly Wall Display](docs/shelly-wall-display.md) | Shelly pairing, identity, hardware |
| [Generic Web Display](docs/generic-web-display.md) | Code pairing, IP identity |
| [Dashboard Editor](docs/dashboard-editor.md) | Configuring widgets per Display |
| [Grid & layout](docs/grid-and-layout.md) | Grid geometry, layouts, placement |
| [Widgets](docs/widgets.md) | Title, Date/Time, Light, Cover |
| [Realtime](docs/realtime.md) | WebSocket, snapshots, live config |
| [Notifications](docs/notifications.md) | Center, Flow cards, dismiss |
| [Notification actions](docs/notification-actions.md) | Action ID, interactive Flows |
| [Camera media](docs/camera-media.md) | Snapshots, video limits |
| [Diagnostics](docs/diagnostics.md) | `/diagnostics` reference |
| [Data & persistence](docs/data-and-persistence.md) | What survives restart |
| [Security](docs/security.md) | Trust model and boundaries |
| [Troubleshooting](docs/troubleshooting.md) | Common problems |
| [Limitations](docs/limitations.md) | Known v1 limits |
| [Examples](docs/examples.md) | Kitchen, entrance, tablet |

### Project & developer references

| Document | Contents |
| --- | --- |
| [PROJECT.md](docs/PROJECT.md) | Current milestone status |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Technical architecture |
| [DECISIONS.md](docs/DECISIONS.md) | Architectural decisions |
| [Development](docs/development.md) | Repository layout, extending widgets |
| [MILESTONES.md](docs/MILESTONES.md) | Milestone history |
| [MILESTONE-16.md](docs/MILESTONE-16.md) | v1 release checklist |
| [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md) | Issue tracker |

### Application UI languages

The dashboard, pairing pages, and App Settings UI are localized in **English**, **Italian**, **German**, **French**, **Danish**, **Spanish**, and **Portuguese** (`locales/*.json`). Homey Flow cards and device settings use the same languages in the compose manifests. This documentation set is in **English** as the canonical product reference.

---

## Screenshot placeholders

Screenshots will be added in a future documentation pass. Planned captures:

<!-- TODO screenshot: Homey App Settings -->
<!-- TODO screenshot: Dashboard Editor -->
<!-- TODO screenshot: Generic pairing code page -->
<!-- TODO screenshot: Dashboard dark theme -->
<!-- TODO screenshot: LightWidget + advanced panel -->
<!-- TODO screenshot: CoverWidget control overlay -->
<!-- TODO screenshot: Notification Center with camera -->
<!-- TODO screenshot: Diagnostics page -->

> Screenshot coming soon: Notification Center ribbon and carousel.
