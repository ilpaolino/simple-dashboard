# Displays

Each wall screen or browser that runs LocalDashboard is represented as a **Homey Device** inside the LocalDashboard app. You can have many Displays; each has its own IP, layout, theme, and widget configuration.

## Mental model

```text
Homey (source of truth)
 │
 ├── Display Device: "Kitchen"     settings.ip, settings.layout, dashboard config
 ├── Display Device: "Entrance"    separate dashboard
 └── Display Device: "Bedroom"     separate dashboard
         │
         ▼
   Browser at settings.ip requests http://HOMEY:7999/
         │
         ▼
   LocalDashboard serves THAT device's dashboard
```

A Display Device is **not** the same as a Homey light or cover shown **inside** a widget. Widgets reference other Homey devices by id; Display devices represent the **screen itself**.

## Identity vs routing

| Concept | Where stored | Purpose |
| --- | --- | --- |
| **Device identity** | Homey `data.id` | Permanent Homey device id |
| **Routing IP** | Device setting `ip` | Match browser traffic to this Display |
| **Dashboard config** | Device Store key `dashboard` | Widgets, theme, placement |
| **Layout** | Device setting `layout` | Grid size (columns × rows) |

Changing the IP in settings **does not** change the Homey device identity. It only changes which LAN client receives this dashboard.

## Recognition flow

When any browser opens `http://<HOMEY_LAN_IP>:7999/`:

1. LocalDashboard reads the **client IP** from the TCP connection (not from browser cookies or storage).
2. It looks up that IP in the **DisplayRegistry**.
3. **Match found** → serve dashboard (after layout validation).
4. **No match** → show Generic **pairing page** with a temporary 6-digit code.

For **Shelly** devices, LocalDashboard may also verify that the Shelly hardware id at that IP matches the Homey device’s expected id. A mismatch shows an error page instead of the wrong dashboard.

## Shelly Wall Display vs Generic Web Display

| Feature | Shelly Wall Display | Generic Web Display |
| --- | --- | --- |
| **Intended hardware** | Shelly Wall Display panel | Tablets, phones, kiosk browsers, PCs |
| **Pairing start** | Homey: enter Shelly IP | Browser first: shows code |
| **Homey pairing steps** | Enter IP → confirm hardware | Enter 6-digit code → confirm IP |
| **Device identity** | Shelly hardware id when detected | UUID generated at pairing |
| **IP role** | Routing only | Routing only |
| **Hardware discovery** | `Shelly.ListMethods` at pairing, startup, maintenance | — |
| **Hardware Flow actions** | Reboot (when RPC method present) | — |
| **Browser capability report** | — | Optional `generic-client-hello` over WebSocket |
| **Layout options** | 2×2, 3×3 | 2×4, 4×2, 3×6, 6×3 |
| **Dashboard** | Yes | Yes |
| **Widgets** | Yes | Yes |
| **Notifications** | Yes | Yes |
| **Camera in notifications** | Yes | Yes |
| **Flow cards** | Same titles; Shelly uses prefixed card ids internally | Standard card ids |

## Online / offline

A Display is **online** when it has an active WebSocket session to `/realtime`. Offline Displays do not receive live pushes until they reconnect; they then receive a **full snapshot**.

HTTP “last seen” timestamps in diagnostics are supplementary; WebSocket session state is the primary online indicator.

## Where to configure what

| Task | Where |
| --- | --- |
| IP address | Device Advanced settings |
| Grid layout (2×2, 3×3, …) | Device Advanced settings |
| Widgets, theme, placement | App Settings → Dashboard Editor |
| HTTP port, diagnostics | App Settings (top section) |
| Notifications | Homey Flow (Device cards on each Display) |

Device settings show a read-only note that grid/widgets are managed in App Settings.

## Further reading

- [Shelly Wall Display](shelly-wall-display.md)
- [Generic Web Display](generic-web-display.md)
- [Grid & layout](grid-and-layout.md)
- [Realtime](realtime.md)
- [Data & persistence](data-and-persistence.md)
