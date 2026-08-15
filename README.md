# Simple Dashboard

Homey Pro app (`dev.dadda.simpledashboard`) — Wall Display recognition plus a vanilla HTML/CSS/TypeScript grid dashboard with WebSocket realtime sync.

This milestone includes widgets, Homey LightWidget (read-only), and live WebSocket updates. It does **not** include Flow cards or Homey device control from the display.

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

1. Open the Homey mobile/web app
2. Add device → **Simple Dashboard**
3. Choose **Shelly Wall Display** or **Generic Web Display**
4. Enter the display IPv4 address
5. Shelly: confirm detected hardware info, then add
6. Generic: add after entering the IP
7. Open Advanced settings → set layout (Shelly: 2x2 / 3x3 — Generic: 2x4 / 4x2 / 3x6 / 6x3)
8. Open the dashboard URL from the display browser (WebSocket sync starts automatically; editor saves apply live when connected)

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
- [TODO.md](docs/TODO.md)
- [KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)
