# Milestone 13 — Camera Media inside Notifications

**Status:** Done.

## Summary

Incremental evolution of Milestone 11 / 11B / 12:

- Optional Homey camera/media on the **existing** `DisplayNotification`
- User picks a Homey Device in Flow (not URL / credentials)
- Backend `NotificationMediaResolver` detects image / video / none
- Video only when the Wall Display browser can play it without transcoding
- Image snapshot as placeholder and fallback
- Live media exists only while the Notification Center shows that notification
- M12 action / auto-open / auto-close unchanged

No Event Overlay, no Camera Overlay, no second NotificationManager, no ffmpeg.

## Architecture

```text
Homey Flow (Show / Show interactive)
        │  optional autocomplete: Camera / Media
        ▼
NotificationMediaResolver (Device → descriptor; no open streams)
        ▼
NotificationManager (public media + backend-only mediaBinding.deviceId)
        ▼
RealtimeGateway → WebSocket snapshot/push (no tokens / URLs / Device ids)
        ▼
Notification Center (existing)
        ▼
NotificationMediaController (at most one live session)
        │
        ├─ GET /notification-media/:id/image  (same port, Display IP + binding)
        └─ GET /notification-media/:id/video  (415 — no transcoding / RTSP pipe)
        │
optional Notification Action (M12) → Homey Flow Trigger
```

## Homey media research (official SDK v3)

Verified against:

- [Images](https://apps.developer.homey.app/advanced/images) — `ManagerImages` / `Image`; **5 MB** limit; consume via stream or Homey URL
- [Videos](https://apps.developer.homey.app/advanced/videos) — `ManagerVideos` + `Device.setCameraVideo`; types **WebRTC, HLS, DASH, RTSP, RTMP, Other**; Homey **does not transcode**; Homey Pro 12.12+ serves videos as WebRTC to **Homey’s own frontends**
- [Flow arguments](https://apps.developer.homey.app/the-basics/flow/arguments) — `required: false` keeps old Flows valid; extra `type: "device"` on a Device card lists **devices paired in this app** (cameras are other apps) → **autocomplete** is the official way to pick any Homey Device

**Not assumed / not implemented:** consuming another app’s live WebRTC/RTSP from this app’s Wall Display `<video>`, ffmpeg restream, arbitrary URL proxy.

## Playback strategy

| Homey Device exposes | Browser strategy |
| --- | --- |
| Image + playable progressive video (`other` / MP4) | Snapshot placeholder → `<video>` → fallback to image on failure |
| Image + RTSP / RTMP / WebRTC / HLS / DASH | Image with **3 s** live snapshot refresh (`videoPlayable: false`) |
| Image only | Same live snapshot refresh while the Center is open |
| Video only, not browser-playable | Unavailable media strip; notification still usable |
| Nothing | Unavailable media strip |

Production `/video` returns **415**. The frontend state machine still supports `videoPlayable` for tests and a future light-weight path.

## Media lifecycle

```text
Center closed / notification not visible
  → no player, no fetch, no session

Center open + current notification has media
  → resolve (backend) / start controller (frontend)
  → image placeholder if hasImage; live snapshot refresh every 3 s while image / fallback-image is shown
  → video only if videoPlayable
  → video fail → keep image (still refreshing), or show “Video unavailable”

Close / auto-close / hide / dismiss / swipe / disconnect / destroy / upsert camera change
  → stop + cleanup immediately
```

Auto-close (example **60 s** doorbell): closes Center only; ribbon + SoT notification remain; media stops; manual reopen may start media again **without** a new auto-close (M12).

Retry: **one** manual Retry control on the error state. No infinite retry loop.

## Security

- Frontend never receives Homey tokens, camera credentials, RTSP URLs, or raw Device objects
- Public `NotificationMedia` is a capability descriptor + opaque `sourceId`
- Image GET is bound to **DisplaySession IP + notification + mediaBinding**
- Fetch of Homey images is **same-host as Homey local URL only** (no SSRF)
- Display A cannot fetch Display B’s notification media
- Removed / foreign / unbound notifications return 404

## Flow

Optional autocomplete **Camera / Media** on both Show cards (`required: false`).

Omitted argument → `media = undefined` / clear on upsert (same pattern as M12 action on the simple card).

User selects “Camera ingresso”. The app chooses image vs video.

Doorbell reference Flow uses Auto Close **60** seconds, camera, and action `open-gate`.

## Tests

See `test/notification-m13.test.ts` plus existing M11 / M11B / M12 suites.

`npm test`: 332 passed.

## Frontend performance (local after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML | 760 B | 438 B |
| CSS | 40818 B | 6591 B |
| JS | 98476 B | 21997 B |
| **Total** | **140054 B** | **29026 B** |

M12 reference: 129194 B raw / 26605 B gzip. Delta ≈ **+10.9 KiB** raw / **+2.4 KiB** gzip. **Zero new runtime npm packages.**

RAM on Homey Pro is not measured in CI. After Center close, `activeMediaSessions` must be 0 and image `src`/`video` are cleared (no player, no fetch).

## Known limitations

- Homey camera **video types are not played** on the Wall Display browser (RTSP/WebRTC/HLS/DASH/RTMP). Snapshot is used when Homey exposes an image, refreshed every 3 s while visible.
- No ffmpeg / restream / HLS.js / WebRTC stack on Homey Pro.
- `/video` is explicitly unsupported (415).
