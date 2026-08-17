# Camera media in notifications

Optional **camera or media** can appear **inside** the Notification Center — there is no separate camera overlay or second notification system.

## How it works

```text
Homey Flow: Show notification + Camera/Media device
        ↓
NotificationMediaResolver (backend, Homey API)
        ↓
Safe descriptor on notification (no credentials, no device id on wire)
        ↓
Notification Center opens with media
        ↓
Frontend NotificationMediaController
        ↓
GET /notification-media/<notificationId>/image  (scoped to Display IP)
```

Video path `GET .../video` returns **415 Unsupported Media Type** — LocalDashboard does not transcode on Homey.

## Security boundary

The browser **never** receives:

- Homey API tokens
- Camera credentials or RTSP URLs
- Raw Homey device ids for media binding
- Arbitrary URL proxy parameters

Image bytes are fetched by the **backend** from Homey-local image URLs and served on port **7999** only to the matching Display IP and notification.

## Flow configuration

On **Show notification** or **Show interactive notification**, optional argument:

**Camera / Media** — autocomplete any Homey device (typically a camera app device).

Omitting media keeps pre-v1 Flow behavior unchanged.

## Image behavior

When Homey exposes a **snapshot image**:

- Image shown in Notification Center while that carousel item is visible
- While Center is open on an image (or video fallback), snapshot **refreshes every 3 seconds**
- Refresh stops immediately on close, swipe, dismiss, auto-close, or disconnect
- This is **refreshed snapshots**, not live transcoded video

## Video limitations (important)

Homey cameras often expose RTSP, WebRTC, HLS, DASH, or RTMP. LocalDashboard **detects** these but the wall browser **cannot** play them directly without transcoding.

| Homey exposes | Wall Display behavior |
| --- | --- |
| Browser-playable video only | `<video>` attempt (rare for Homey cameras) |
| Video + image | Prefer video path; fallback to image if playback fails |
| Video types not playable + image | **Snapshot fallback** with 3 s refresh |
| Image only | Snapshot with 3 s refresh while visible |
| Neither | Media area shows unavailable state |

Do **not** describe snapshot refresh as “live video” — it is periodic still frames from Homey.

## Media lifecycle

| Event | Media |
| --- | --- |
| Center opens on notification with media | Start fetch/refresh |
| Swipe to another notification | Stop previous; start if new item has media |
| Close Center / dismiss / auto-close | Stop all media immediately |
| Notification removed while open | Stop and clean up |
| Camera device removed/unavailable | Placeholder / error; notification text remains |

At most **one** live media session per Display.

## Doorbell example

See [Examples — Entrance dashboard](examples.md#b-entrance-dashboard-doorbell) for a full Flow setup with media + Action ID.

## Diagnostics

`/diagnostics` lists active media sessions (count, notification id) without exposing URLs or credentials. After closing the Center, **active media sessions** should return to **0**.

## Related

- [Notifications](notifications.md)
- [Security](security.md)
- [Troubleshooting — Camera image](troubleshooting.md#camera-image-unavailable)
