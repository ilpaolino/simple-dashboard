# Known issues

## Current v1 limitations (LocalDashboard)

These are intentional or accepted for v1. They are **not** bugs blocking release unless marked otherwise.

- **LAN-local trust model** — Display access is gated by configured IPv4 only. No cloud auth, no pairing-code rate limit (codes expire in 8 minutes; diagnostics mask all but the last two digits).
- **Pairing codes are runtime-only** — lost on app restart; refresh the browser for a new code.
- **Homey camera video is not live-played on the Wall Display** — RTSP/WebRTC/HLS/DASH/RTMP fall back to snapshot refresh (3 s) when Homey exposes an image; `/notification-media/:id/video` returns 415.
- **No global “notify all Displays” Flow** — notification actions are always device-scoped.
- **Soft cap of 32 notifications per Display** — excess publish is rejected.
- **Dismiss is runtime-local per Display** — cleared on app restart; Flow upsert re-surfaces on the same key.
- **No offline command queue / event replay** — reconnect uses a full snapshot.
- **Generic identity at pairing is a generated UUID** — routing remains IP-based in settings.
- **IPv4 only** — no hostname pairing / mDNS discovery.
- **Shelly hardware beyond reboot** — brightness/volume/etc. remain unimplemented pending official RPC documentation.
- **Fullscreen is detected, not forced** (browser requires user gesture).
- **Automated tests do not drive Homey mobile UI, Flow editor, or physical wall hardware** — use [MILESTONE-16.md](MILESTONE-16.md) manual checklist.

## Runtime constraints

- LAN bind, IP probe, Homey Web API, capability realtime, and capability writes require the app to run **on Homey Pro**, not only in local Docker (`homey app run` without `--remote`).
- Privileged HTTP ports (`< 1024`) may fail on Homey.
- Frontend assets must be built (`npm run build`) before packaging.
- `homey:manager:api` is local-only; this app uses `platforms: ["local"]`.
- `homey-api@3.17+` requires Node 24. This project pins `3.16.1` for Homey Pro Node 22.

## Homey platform notes

- Homey Compose overwrites root `app.json` when the CLI runs. Prefer editing `.homeycompose/`.
- Homey Apps SDK does not expose an official “app RAM” metric beyond `process.memoryUsage()`.

---

## Historical: fixed / superseded / deferred by milestone

<details>
<summary>Milestone 15 and earlier (reference)</summary>

### Fixed during Milestone 15

- Generic pairing required manual IP entry → temporary 6-digit code pairing.
- Unknown browsers saw a generic unconfigured page → dedicated pairing page.

### Deferred by design (M15)

- Unknown Shelly browsers may see the Generic pairing page until paired via Shelly driver.
- Audio capability is a probe only; expiry refresh uses page reload.

### Fixed during Milestone 13

- Optional Homey camera media inside notifications; RTSP not treated as playable `<video>`; 3 s snapshot refresh.

### Fixed during Milestone 12

- Notification CTA pending forever; auto-open semantics; non-dismissable closes; Flow action path.

### Fixed during Milestone 11B / 11

- Homey Flow cards; Notification Center; aggregate capabilities.

### Fixed during Milestone 10 / 9 / 8

- Light advanced panel; Cover interactive control; CoverWidget read path.

Earlier milestone-specific deferrals (two Show cards, one action per notification, no Kelvin labels, no movement interpolation, etc.) remain documented in [DECISIONS.md](DECISIONS.md) and historical milestone files.

</details>
