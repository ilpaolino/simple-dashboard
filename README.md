# Simple Dashboard

Homey Pro app (`dev.dadda.simpledashboard`) — Wall Display devices and a local HTTP welcome page.

This milestone does **not** include a dashboard UI, Vue, widgets, Flow cards, WebSockets, or Homey device control.

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
npm test
npm run typecheck
```

## Run on Homey Pro

A plain `homey app run` uses a local Docker container. **LAN access (browser / Shelly Wall Display / pairing probe) only works when the app runs on Homey itself.**

```bash
homey app run --remote
```

Welcome page:

```text
http://<HOMEY_LAN_IP>:7999/
```

### Install persistently (without live logs)

```bash
homey app install
```

## Pair a Wall Display

1. Open the Homey mobile/web app
2. Add device → **Simple Dashboard** → **Wall Display**
3. Enter the display IPv4 address
4. If the device is a Shelly Wall Display, confirm manufacturer / model / firmware / serial
5. If it is not recognized, choose **Shelly Wall Display** or **Generic Web Display**
6. Open the new device → **Advanced settings**
7. Verify IP, adapter, detected info, and layout
8. Change the IP and save — the device identity must stay the same

## Configure the HTTP port

1. Open the Homey mobile/web app
2. Go to **More → Apps → Simple Dashboard → Configure / Settings**
3. Set **HTTP port** (1–65535)
4. Save

## Useful Homey CLI commands

| Command | Purpose |
| --- | --- |
| `homey app run --remote` | Run on Homey with live logs |
| `homey app install` | Install on Homey |
| `homey app validate` | Validate the app package |
| `homey app quit` | Stop a remote `run` session |

## Local automated tests

```bash
npm test
npm run typecheck
```

## Documentation

See [`docs/PROJECT.md`](docs/PROJECT.md) to resume the project. Milestone details:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DECISIONS.md](docs/DECISIONS.md)
- [docs/MILESTONES.md](docs/MILESTONES.md)
- [docs/TODO.md](docs/TODO.md)
- [docs/KNOWN_ISSUES.md](docs/KNOWN_ISSUES.md)
