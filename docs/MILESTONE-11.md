# Milestone 11 — Notification Center, Carousel & Highlight States

**Status:** Done.

## Summary

Introduced a global **Notification Center** for Wall Displays:

- Homey/backend owns notification lifecycle (`NotificationManager`)
- Per-Display routing (no automatic broadcast)
- Four severities: `critical` > `warning` > `success` > `info`
- Local dismiss (runtime-only, per Display)
- Severity triangle indicator (top-right chrome)
- Modal carousel with previous/next + touch swipe
- CSS-only highlight pulse (`prefers-reduced-motion` respected)
- Typed WebSocket incremental updates + snapshot inclusion

Notifications are **not** widgets and do not occupy grid cells.

## Architecture

```text
Homey / Web API / future Flow
        │
        ▼
NotificationManager  (source of truth + per-Display dismiss Map)
        │
        ▼
RealtimeGateway
        │  dashboard-snapshot.notifications
        │  notification-added | updated | removed
        ▼
RealtimeClient → NotificationController
        │
        ├─ NotificationIndicator (triangle)
        └─ NotificationCenter (carousel modal)
```

### Dismiss semantics

- `dismissable: false` → blocking: no Hide / X / Dismiss, no backdrop or Escape close, no auto-close. Center stays until Homey removes it.
- `dismissable: true` → Hide closes the Center (ribbon stays); Dismiss hides on that Display only
- Backend keeps the notification active for other Displays
- Dismiss state is `Map<displayId, Set<notificationId>>` (RAM only)
- App restart clears dismiss; still-active notifications can reappear
- Same-id update keeps local dismiss; permanent remove cleans dismissed ids

### Ordering

Visible list sorted by:

1. severity (critical first)
2. `publishedAt` ascending
3. id (tie-break)

Opening from the triangle starts on the highest-severity notification.

### Carousel boundaries

No loop: previous on first / next on last stays put.

### Highlight

CSS `@keyframes` between severity tint and modal surface. No `setInterval` / `rAF` animation loops.

## Protocol additions

Server → client:

- `notifications` on `dashboard-snapshot`
- `notification-snapshot` | `notification-added` | `notification-updated` | `notification-removed`

Client → server:

- `notification-dismiss`
- `notification-center-opened` (metrics)

## Internal API (Flow-ready)

```ts
realtimeGateway.publishNotification({ message, severity, displayIds, … })
realtimeGateway.updateNotification({ id, … })
realtimeGateway.removeNotification(id)
```

Also exposed via Homey Web API:

- `GET /notifications`
- `POST /notifications`
- `PUT /notifications`
- `DELETE /notifications/:notificationId`

Flow cards are **not** implemented in this milestone.

## Limits

- `MAX_NOTIFICATIONS_PER_DISPLAY = 32`
- Controlled icon keys only (no arbitrary HTML/SVG from clients)
- Plain-text title/message rendering

## Frontend performance (measured locally after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML (sample bootstrap page) | 760 B | 438 B |
| CSS | 32031 B | 5310 B |
| JS (minified IIFE) | 80190 B | 17969 B |
| **Total** | **112981 B** | **23717 B** |

Milestone 10 reference total: **88175 B** raw / **19137 B** gzip.

Delta (raw): **+24806 B** (NotificationManager contracts shared carefully; frontend controller + center + indicator + swipe + CSS tokens). Zero new runtime npm packages.

Re-measure: `npm run measure:frontend`.

## Manual checklist

- [ ] build completed
- [ ] `npm run typecheck` without errors
- [ ] lint completed
- [ ] automated tests completed
- [ ] no notifications → no triangle
- [ ] info / success / warning / critical triangle colors
- [ ] max severity with multiple notifications
- [ ] tap triangle opens Notification Center on highest severity
- [ ] optional title / icon layout
- [ ] carousel previous / next / counter
- [ ] swipe left / right
- [ ] dismissable / non-dismissable
- [ ] dismiss only current Display
- [ ] same-id update stays dismissed locally
- [ ] remove cleans dismissed id
- [ ] highlight CSS pulse + reduced motion
- [ ] realtime add / update / remove
- [ ] last notification removed closes Center
- [ ] connection reconnect reconcile
- [ ] no grid resize
- [ ] no LightWidget / CoverWidget interference
- [ ] diagnostics updated
- [ ] IT / EN UI
- [ ] RAM/bundle documented
- [ ] leak test completed
