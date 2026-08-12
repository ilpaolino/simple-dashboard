# Welcome Wall (Homey App)

Milestone 0 — local HTTP server proof of concept for Homey Pro.

This app starts a local HTTP server on Homey (default port **7999**) and serves a minimal **Welcome Wall** HTML page. No dashboard, devices, flows, or WebSockets.

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
npm test
npm run typecheck
```

## Run on Homey Pro (required for real LAN access)

A plain `homey app run` uses a local Docker container. **Port binding for LAN clients (browser / Shelly Wall Display) only works when the app runs on Homey itself.**

```bash
homey app run --remote
```

Then open:

```text
http://<HOMEY_LAN_IP>:7999/
```

You should see the Welcome Wall page with client IP, User-Agent, method, URL, and timestamp.

### Install persistently (without live logs)

```bash
homey app install
```

## Configure the HTTP port

1. Open the Homey mobile/web app
2. Go to **More → Apps → Welcome Wall → Configure / Settings**
3. Set **HTTP port** (1–65535)
4. Save

The previous server is closed and a new one is started on the updated port. If the port is occupied, the error is logged via the Homey app logger.

## Useful Homey CLI commands

| Command | Purpose |
| --- | --- |
| `homey app run --remote` | Run on Homey with live logs |
| `homey app install` | Install on Homey |
| `homey app validate` | Validate the app package |
| `homey app quit` | Stop a remote `run` session |

## Local automated tests

Unit/integration tests do **not** require Homey hardware:

```bash
npm test
```

Coverage includes port validation, logger routing, settings change handling, welcome HTML rendering, HTTP start/restart, and port-in-use errors.

## Documentation for this milestone

See [docs/MILESTONE-0.md](docs/MILESTONE-0.md) for architecture decisions, manual test checklist, and known limitations.
