# Getting started

This guide covers installation, URLs, and a complete first-time configuration walkthrough.

## Requirements

| Requirement | Detail |
| --- | --- |
| **Homey hub** | Homey **Pro** (local platform only) |
| **Homey version** | `>=12.9.0` (Node.js 22 on Homey) |
| **Network** | Display and Homey on the same LAN (IPv4) |
| **Display** | Shelly Wall Display **or** any compatible web browser/tablet |
| **Developer tools** (optional) | Node.js 18+, [Homey CLI](https://apps.developer.homey.app/the-basics/getting-started/homey-cli) |

LocalDashboard does **not** run on Homey Cloud.

## URLs

Replace `<HOMEY_LAN_IP>` with your Homey’s LAN address (from the Homey app or router):

| URL | Purpose |
| --- | --- |
| `http://<HOMEY_LAN_IP>:7999/` | Dashboard (or Generic pairing page if unknown) |
| `http://<HOMEY_LAN_IP>:7999/diagnostics` | Runtime diagnostics (when enabled in App Settings) |

Default port is **7999**. If you change it in App Settings, use your configured port instead.

## Install on Homey Pro

### From the developer (pre-release / sideload)

On a machine with the Homey CLI:

```bash
git clone <repository-url> simple-dashboard
cd simple-dashboard
npm install
npm run assets
npm run build
homey app validate
homey app install          # persistent install
# or
homey app run --remote     # development with live logs
```

**Important:** `homey app run` without `--remote` uses local Docker. **LAN dashboard access only works when the app runs on Homey itself** (`--remote` or `install`).

### From the Homey App Store

When published, install **LocalDashboard** from the Homey app like any other app. The technical app id remains `dev.dadda.simpledashboard`.

## App Settings

Open: **Homey → More → Apps → LocalDashboard → Configure** (gear icon).

| Setting | Default | Description |
| --- | --- | --- |
| **HTTP port** | 7999 | TCP port for HTTP and WebSocket |
| **Enable diagnostics** | off | Allows `/diagnostics` page on the LAN |

Changing the port restarts the HTTP/WebSocket server automatically.

Below the settings form you will find the **Dashboard Editor** for widget configuration.

## Pair a Display

Choose one driver when adding a device:

### Shelly Wall Display

1. Homey → **Add device** → **LocalDashboard** → **Shelly Wall Display**.
2. Enter the display’s **IPv4 address**.
3. LocalDashboard probes the device and shows detected hardware info.
4. Confirm and add the device.
5. Open Device **Advanced settings** → set **Layout** (2×2 or 3×3).
6. On the Shelly browser, open `http://<HOMEY_LAN_IP>:7999/`.

Details: [Shelly Wall Display](shelly-wall-display.md).

### Generic Web Display

1. On the tablet/browser, open `http://<HOMEY_LAN_IP>:7999/` — a **6-digit pairing code** appears.
2. Homey → **Add device** → **LocalDashboard** → **Generic Web Display**.
3. Enter the pairing code.
4. Confirm the detected IP and add the device.
5. Refresh the browser — the dashboard loads.
6. Set **Layout** in Device Advanced settings (2×4, 4×2, 3×6, or 6×3).

Details: [Generic Web Display](generic-web-display.md).

---

## First configuration walkthrough

This walkthrough assumes a **Generic Web Display** in the kitchen. Adapt names as needed.

### 1. Install and open App Settings

Install LocalDashboard. Open App Settings and confirm port **7999**. Enable diagnostics if you want `/diagnostics` during setup.

### 2. Pair the Display

Follow the Generic pairing steps above. After refresh, you should see an empty dashboard or “No widgets configured” — that is normal.

### 3. Set layout

Device → **Advanced settings** → **Layout** → choose **2 × 4 (portrait)** for a vertical tablet.

### 4. Open Dashboard Editor

App Settings → **Dashboard Editor** → select **Kitchen** (your device name).

### 5. Set appearance

Choose **Dark** or **Light** theme. This applies to the whole dashboard on this Display.

### 6. Add a Title widget

- **Add Widget** → **Title**
- Text: `Kitchen`
- Alignment: **Center**
- Position: Row **1**, Column **1**
- Size: **2 × 1** (spans two columns)
- Apply

### 7. Add Date & Time

- **Add Widget** → **Date & Time**
- Mode: **Date & time**
- Position: Row **1**, Column **3**
- Size: **1 × 1**
- Apply

### 8. Add a Light widget

- **Add Widget** → **Light**
- Select a Homey light that has the `onoff` capability
- Position: Row **2**, Column **1**
- Apply

### 9. Save

Save the dashboard. If the kitchen Display is connected, it updates **live** without a manual browser refresh.

### 10. Verify on the Display

Open `http://<HOMEY_LAN_IP>:7999/` on the tablet:

- Title and clock visible
- Light shows name and ON/OFF state
- **Tap** the light tile — state should change after Homey confirms (pending spinner, then final state)

### 11. Optional: Cover widget

Add a **Cover** widget bound to a Homey device with `windowcoverings_set`. Tap the tile to open the position overlay.

### 12. Optional: notification Flow

Create a Homey Flow:

**WHEN** (anything you like)  
**THEN** Kitchen Display → **Show notification**  
- Notification Key: `test`  
- Message: `Hello from Flow`  
- Severity: Info  

The Display should show the notification ribbon and open the Notification Center.

Next: [Dashboard Editor](dashboard-editor.md) · [Widgets](widgets.md) · [Notifications](notifications.md)
