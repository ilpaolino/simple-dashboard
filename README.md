# Simple Dashboard

Homey Pro app (`dev.dadda.simpledashboard`) — Wall Display recognition, runtime registry, and diagnostics.

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

Recognition page:

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
7. Open Advanced settings → verify IP and layout

## Configure HTTP port and diagnostics

1. More → Apps → Simple Dashboard → Configure / Settings
2. Set **HTTP port**
3. Toggle **Enable diagnostics** / **Abilita diagnostica**
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
