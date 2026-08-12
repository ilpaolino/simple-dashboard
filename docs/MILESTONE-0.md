# Milestone 0 — Local HTTP Server PoC

Living project docs: [PROJECT.md](PROJECT.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [MILESTONES.md](MILESTONES.md).


## 1. Architectural choices

### Component split (App / Logger / SettingsManager / HttpServer)

| Component | Responsibility | Why |
| --- | --- | --- |
| `app.ts` (`WelcomeWallApp`) | Homey lifecycle wiring only (`onInit` / `onUninit`) | Keeps the Homey entry point thin; matches SDK expectation to extend `Homey.App` ([App](https://apps-sdk-v3.developer.homey.app/App.html)) |
| `lib/Logger.ts` | Single logging facade (`info` / `warn` / `error`) | Avoid scattered `console.log`; central place for future Homey diagnostics sinks |
| `lib/SettingsManager.ts` | Read/validate `httpPort`, emit change notifications | Uses official persistent settings API only |
| `lib/HttpServer.ts` | Bind/listen/close/restart Node HTTP server | Isolates socket lifecycle and bind errors |
| `lib/WelcomePage.ts` | Pure HTML rendering for `/` | Keeps HTTP transport separate from presentation |
| `lib/port.ts` | Port parsing/validation | Small, unit-testable pure functions |

No drivers, devices, flows, widgets, Homey Web API routes, or dashboard logic were added.

### Logging via Homey SimpleClass (not `console.log`)

Homey documents `log()` and `error()` on `SimpleClass` ([reference](https://apps-sdk-v3.developer.homey.app/SimpleClass.html)). There is **no** documented `warn()` API.

Mapping used:

- `INFO` → `homey.log('[INFO]', …)`
- `WARN` → `homey.log('[WARN]', …)` (documented `log` channel + explicit level tag)
- `ERROR` → `homey.error('[ERROR]', …)`

`AppLogger` accepts additional `LogSink` implementations so future Homey diagnostics exporters can be plugged in without changing call sites.

### Settings via ManagerSettings + `/settings/index.html`

- App runtime reads/writes with `this.homey.settings.get/set` and listens to the `set` event ([ManagerSettings](https://apps-sdk-v3.developer.homey.app/ManagerSettings.html)).
- UI uses the official custom settings view pattern with `/homey.js`, `onHomeyReady`, `Homey.get`, `Homey.set` ([App Settings](https://apps.developer.homey.app/advanced/custom-views/app-settings)).

Setting key: `httpPort` (default `7999`).

### Local HTTP with Node.js `http` (not Homey App Web API)

The Homey App Web API (`api` routes in the manifest) is authenticated under `/api/app/<id>/` and is not suitable for an open LAN page for Shelly Wall Display.

This milestone uses Node.js `http.createServer`, which Homey officially documents in the Node.js 22 upgrade guide, including `requireHostHeader: false` for clients that omit the Host header ([Node.js 22 guide](https://apps.developer.homey.app/upgrade-guides/node-22)).

Bind address: `0.0.0.0` so LAN clients can connect when the app runs **on Homey Pro**.

### Port change = stop previous server, then start new one

`HttpServer.restart()` serializes restarts through a promise chain to avoid overlapping listen/close races and leaked sockets when settings change quickly.

### TypeScript strict mode

Configured per Homey TypeScript guide (`outDir: .homeybuild/`, `sourceMap: true`) plus `strict` / `noImplicitAny` ([TypeScript guide](https://apps.developer.homey.app/guides/tools/typescript)).

### Platform scope

Manifest `platforms: ["local"]` and `compatibility: ">=12.9.0"` — Homey Pro only for this PoC; custom settings views are not supported on Homey Cloud ([App Settings note](https://apps.developer.homey.app/advanced/custom-views/app-settings)).

---

## 2. Manual test checklist

### Setup

- [ ] `npm install` succeeds on the developer machine
- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] Homey CLI installed and logged in (`homey login`)
- [ ] App installed/run with `homey app run --remote` (or `homey app install`)

### Server start

- [ ] App starts without crash
- [ ] Homey logs show HTTP server started on port `7999` (or configured port)
- [ ] From a PC/phone on the same LAN: open `http://<HOMEY_IP>:7999/`
- [ ] Page title/heading shows **Simple Dashboard**
- [ ] Client IP is shown and looks plausible
- [ ] User Agent is shown
- [ ] Method shows `GET`
- [ ] URL shows `/` (or the requested path/query)
- [ ] Timestamp is present (ISO-8601)

### Shelly Wall Display (optional but recommended)

- [ ] Configure Wall Display browser/URL to `http://<HOMEY_IP>:7999/`
- [ ] Simple Dashboard welcome page loads on the display

### Settings / port change

- [ ] Open app settings in Homey UI
- [ ] Default port field shows `7999` (first run)
- [ ] Change port to another free port (e.g. `8001`) and save
- [ ] Logs show server stop + start on the new port
- [ ] Old port no longer answers
- [ ] New port serves the Simple Dashboard welcome page

### Error handling

- [ ] Set an invalid port in settings UI (e.g. `0`, `70000`, empty) → UI validation message
- [ ] Occupy target port with another process on Homey (or restart onto a busy port) → app logs port occupied / start failure; no crash loop that leaves sockets hanging
- [ ] Stop/uninstall app → previous port is released (`onUninit` stops the server)

### Development caveats

- [ ] Confirmed that LAN access was tested with `--remote` (not only local Docker `homey app run`)

---

## 3. Limitations (intentionally out of scope)

Not implemented in Milestone 0:

- Dashboard UI / Vue (or any SPA)
- WebSocket
- Homey devices / drivers / pairing
- Flow cards
- Homey Manager API usage beyond settings + logging lifecycle
- Homey App Web API (`api` manifest routes)
- Widgets
- Display-specific configuration (Shelly Wall Display provisioning beyond hitting `/`)
- Authentication / TLS
- Reverse proxy / path routing beyond `/`
- Multi-homed NIC selection (binds `0.0.0.0`)
- Homey Cloud / Bridge support
- App Store publication assets polish beyond minimal placeholders
- Shipping logs to Homey diagnostics exporters (extension point only via `LogSink`)

### Known runtime constraints

- Must run on Homey Pro (`homey app run --remote` / install) for real LAN binding
- Some clients may omit `Host`; server disables the Node 20+ Host requirement as per Homey docs
- Privileged ports (`< 1024`) may fail depending on Homey process privileges; prefer ports `>= 1024`
