# Simple Dashboard

Homey Pro app (`dev.dadda.simpledashboard`) — Wall Display recognition plus a vanilla HTML/CSS/TypeScript grid dashboard with WebSocket realtime sync, interactive Light/Cover widgets, Flow-driven Notification Center, Shelly hardware discovery, and Generic Web Display pairing via temporary code.

See [`docs/PROJECT.md`](docs/PROJECT.md) for current milestone status.

## Requirements

- Homey Pro (local platform)
- Homey firmware compatible with Apps SDK v3 / Node.js 22 (`>=12.9.0`)
- Developer machine with:
  - Node.js 18+ (22 recommended)
  - [Homey CLI](https://apps.developer.homey.app/the-basics/getting-started/homey-cli)

## Install Homey CLI

```bash
npm install -g homey
homey login
```

## Project setup

```bash
cd /path/to/simple-dashboard
npm install
npm run assets
npm run build
npm test
npm run typecheck
npm run measure:frontend
```

## Run on Homey Pro

A plain `homey app run` uses a local Docker container. **LAN access (browser / Shelly Wall Display / pairing probe) only works when the app runs on Homey itself.**

```bash
homey app run --remote
```

Dashboard (recognized display):

```text
http://<HOMEY_LAN_IP>:7999/
```

Diagnostics:

```text
http://<HOMEY_LAN_IP>:7999/diagnostics
```

### Install persistently (without live logs)

```bash
homey app install
```

## Pair a display

### Shelly Wall Display

1. Open the Homey mobile/web app
2. Add device → **Simple Dashboard** → **Shelly Wall Display**
3. Enter the display IPv4 address
4. Confirm detected hardware info, then add
5. Open Advanced settings → set layout (2x2 / 3x3)
6. Open `http://<HOMEY_LAN_IP>:7999/` from the display browser

### Generic Web Display

1. On the tablet/browser, open `http://<HOMEY_LAN_IP>:7999/` (pairing page shows a 6-digit code)
2. In Homey: Add device → **Simple Dashboard** → **Generic Web Display**
3. Enter the pairing code from the browser
4. Confirm the detected IP, then add
5. Refresh the browser → dashboard loads
6. Configure layout in Advanced settings (2x4 / 4x2 / 3x6 / 6x3) and widgets in App Settings

Identity is always the configured **IP address** (not browser storage). Clearing cache/cookies does not break recognition.

## Configure HTTP port and diagnostics

1. More → Apps → Simple Dashboard → Configure / Settings
2. Set **HTTP port** (HTTP and WebSocket share this port)
3. Toggle **Enable diagnostics** / **Abilita diagnostica**
4. Save
5. Use **Dashboard Editor** in the same settings page for widgets (live push when the display is connected)

## Useful Homey CLI commands

| Command | Purpose |
| --- | --- |
| `homey app run --remote` | Run on Homey with live logs |
| `homey app install` | Install on Homey |
| `homey app validate` | Validate the app package |
| `homey app build` | Build the app archive |

## Documentation

Persistent project memory lives in [`docs/`](docs/):

- [PROJECT.md](docs/PROJECT.md)
- [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [DECISIONS.md](docs/DECISIONS.md)
- [MILESTONES.md](docs/MILESTONES.md)
- [MILESTONE-6.md](docs/MILESTONE-6.md)
- [MILESTONE-12.md](docs/MILESTONE-12.md) (Action ID: filter that matches SHOW ↔ WHEN)
- [MILESTONE-13.md](docs/MILESTONE-13.md) (optional camera media inside notifications)
- [MILESTONE-15.md](docs/MILESTONE-15.md) (Generic pairing code + browser capabilities)
- [TODO.md](docs/TODO.md)
- [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)
