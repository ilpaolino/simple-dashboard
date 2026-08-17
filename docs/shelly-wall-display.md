# Shelly Wall Display

The **Shelly Wall Display** driver is for Shelly’s wall-mounted panel hardware. It uses Shelly-specific pairing and optional hardware RPC discovery.

## Pairing

1. In Homey: **Add device** → **LocalDashboard** → **Shelly Wall Display**.
2. Enter the panel’s **IPv4 address** on your LAN.
3. LocalDashboard probes the device and reads hardware metadata (manufacturer, model, firmware, serial/id).
4. Review the summary and confirm.
5. Homey creates a Display device. The device’s **`data.id`** is the Shelly hardware identity when detection succeeds (not the IP).
6. Set **IP address** and **Layout** in Device Advanced settings if not already correct.
7. Open the Shelly browser to `http://<HOMEY_LAN_IP>:7999/`.

If another Homey device already uses the same IP, pairing validation fails — each Display needs a unique routing IP.

## Identity and IP

| Field | Meaning |
| --- | --- |
| **`data.id`** | Shelly hardware id (Homey device identity) |
| **`settings.ip`** | IPv4 used to route HTTP/WebSocket to this panel |

If you move the panel to a new IP, update **`settings.ip`** in Homey. The Homey device identity does not change.

If a **different** Shelly (different hardware id) appears at the configured IP, LocalDashboard shows a **hardware mismatch** page instead of serving the wrong dashboard.

## Supported grid layouts

| Layout id | Grid | Typical use |
| --- | --- | --- |
| `2x2` | 2 columns × 2 rows | Compact square |
| `3x3` | 3 columns × 3 rows | Larger square |

Layout ids use the format **`{columns}x{rows}`** (e.g. `3x3` = 3 columns, 3 rows).

## Hardware discovery

LocalDashboard does **not** assume Shelly features exist. It discovers them via official RPC:

```text
Shelly.ListMethods  →  map known methods  →  runtime hardware profile
```

Discovery runs:

- at **pairing** (after identity probe; failure does not block pairing);
- once per Shelly display at **app startup** (sequential, no periodic polling);
- on **Maintenance** action **Detect hardware capabilities again** on the device.

### Feature status labels

| Status | Meaning |
| --- | --- |
| **Supported** | Discovery succeeded and the RPC method exists |
| **Unsupported** | Discovery succeeded but method absent on this firmware/model |
| **Unknown** | Discovery failed or device offline — not the same as “unsupported” |

Read-only labels in Device Advanced settings mirror the last profile (e.g. reboot support, RPC method count, last error).

## Hardware commands (v1)

Currently implemented:

| Command | How | Notes |
| --- | --- | --- |
| **Reboot** | Flow Action **Reboot display** (`shelly_reboot_display`) | Executes `Shelly.Reboot` when discovered; brief disconnect is expected |

**Not implemented** (no official Wall Display RPC documented for LocalDashboard v1): brightness, volume, browser reload, screen on/off, etc.

Generic Web Display devices **never** expose Shelly hardware controls.

## Dashboard and notifications

Shelly displays use the same dashboard engine, widgets, WebSocket realtime, and Notification Center as Generic displays. Flow cards appear under the Shelly device in Homey Flow with the same user-visible titles; internal card ids use a `shelly_` prefix for Homey compatibility.

## Diagnostics

The `/diagnostics` page includes a **Shelly hardware** section per configured Shelly display: discovery status, reboot support, method count, last error.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Mismatch page | IP points to wrong physical device; verify Shelly id |
| Reboot Flow missing | Hardware discovery — see Device settings / diagnostics |
| Dashboard not loading | IP, port, app running on Homey Pro |

See also [Troubleshooting](troubleshooting.md) · [Diagnostics](diagnostics.md)
