# Data & persistence

LocalDashboard follows: **persist configuration; rebuild runtime state**.

## Persistence table

Verified against current implementation:

| Data | Stored where | Survives app restart? | Notes |
| --- | --- | --- | --- |
| HTTP port | Homey app settings `httpPort` | **Yes** | Default 7999 |
| Diagnostics enabled | App settings `diagnosticsEnabled` | **Yes** | Default off |
| Display Homey device | Homey device record | **Yes** | Shelly or Generic driver |
| Display identity `data.id` | Homey device data | **Yes** | Shelly hw id or UUID |
| Routing IP | Device setting `ip` | **Yes** | Not the identity |
| Layout | Device setting `layout` | **Yes** | e.g. `3x3`, `2x4` |
| Dashboard config | Device Store `dashboard` | **Yes** | Widgets, theme, placement |
| Widget `deviceId` bindings | Inside `dashboard` JSON | **Yes** | References only |
| Adapter metadata | Device Store keys | **Yes** | e.g. `adapterId` |
| Shelly hardware labels | Device settings (mirror) | **Yes** | Read-only labels from last discovery |
| Active notifications | RAM (`NotificationManager`) | **No** | Recreate via Flow if needed |
| Notification Key index | RAM | **No** | |
| Local dismiss per Display | RAM | **No** | Cleared on restart |
| WebSocket sessions | RAM | **No** | Reconnect → snapshot |
| Homey capability subscriptions | RAM (+ Homey listeners) | **No** | Rebuilt on session open |
| Pending widget commands | RAM | **No** | Cleared on disconnect |
| Generic pending pairing codes | RAM | **No** | Refresh browser for new code |
| Generic browser capability profile | RAM | **No** | Re-sent on hello after connect |
| Shelly hardware profile | RAM | **No** | Rediscovered at startup / maintenance |
| Notification media image cache | RAM (short TTL) | **No** | |
| Diagnostics recent buffers | RAM (bounded) | **No** | |

## Philosophy

| Persist | Rebuild at runtime |
| --- | --- |
| What the user configured | What Homey reports right now |
| Which device id a widget references | Device name, zone, capability values |
| Which IP serves which dashboard | Online/offline, subscriptions |

---

## What happens when something disappears?

### Display goes offline (network / browser closed)

**User sees:** Connection lost overlay on next open attempt; or frozen last state until overlay.

**Backend:** WebSocket session ends; subscriptions for that Display released (ref-counted); pending commands for that Display cancelled.

**On reconnect:** Full **dashboard-snapshot** restores config, widget states, and visible notifications (respecting dismiss set still in RAM until restart).

### Homey device used by widget goes offline

**User sees:** Widget remains on grid in **unavailable** state.

**Backend:** May fail subscription or show stale last state until Homey reports again.

**Fix:** Restore device on Homey; widget recovers without reconfiguring if binding still valid.

### Homey device is removed

**User sees:** Widget **stays visible** as **unavailable** — configuration is **not** silently deleted.

**Why:** You should notice broken bindings and fix them in the Dashboard Editor.

**Fix:** Edit widget to bind a different device, or remove widget.

### Camera / media device removed

**Notification** text and actions remain. Media area shows unavailable / fallback. HTTP image endpoint returns 404 when binding invalid.

### Notification removed by Flow

Removed from SoT; Displays receive `notification-removed` when online. Local dismiss sets cleaned for that id.

### Homey app restarts

| Cleared | Preserved |
| --- | --- |
| Notifications, dismiss, pairing codes, WS sessions | All Homey devices, dashboard configs, settings |
| Shelly hardware runtime profile | Shelly device settings labels (may be stale until rediscovery) |

Displays reconnect and receive fresh snapshots. Flows may need to re-show critical notifications.

### Generic pairing after app restart

Pending codes **lost**. Unpaired browser must refresh for a new code. **Paired** Displays unaffected.

### IP address changes (Generic tablet)

Browser may show pairing page. Update **`settings.ip`** in Homey to match new DHCP address.

### Shelly at wrong IP / wrong hardware

**Mismatch page** — identity at IP ≠ expected Shelly id. Fix IP or Homey device assignment.

## Related

- [Displays](displays.md)
- [Generic Web Display](generic-web-display.md)
- [Realtime](realtime.md)
- [Troubleshooting](troubleshooting.md)
