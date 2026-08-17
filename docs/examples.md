# Examples

Worked examples that teach LocalDashboard concepts. Adjust device names, zones, and Flow devices to match your home.

---

## A. Kitchen dashboard

**Goal:** Room title, clock, two lights, one cover on a **Generic** tablet (2×4 portrait).

### Devices

- Homey Display: **Kitchen** (Generic Web Display)
- Layout: **2 × 4 (portrait)** (`2x4`)
- Theme: **Dark**

### Widget layout (editor coordinates: row/col labels 1-based)

| Widget | Row | Col | Size | Config |
| --- | ---: | ---: | --- | --- |
| Title “Kitchen” | 1 | 1 | 2×1 | center alignment |
| Date & Time | 1 | 3 | 1×1 | date-time mode |
| Light “Ceiling” | 2 | 1 | 1×1 | Homey ceiling light |
| Light “Worktop” | 2 | 2 | 1×1 | Homey under-cabinet light |
| Cover “Blinds” | 3 | 1 | 1×1 | Homey cover with `windowcoverings_set` |

### Usage

- Tap lights to toggle; long-press ceiling for dim/color if supported.
- Tap cover tile → slider / Open / Close / Stop (if supported).

### Concepts taught

- Per-Display dashboard config
- Multi-cell Title span
- Multiple Light widgets sharing realtime infrastructure
- Cover overlay interaction

---

## B. Entrance dashboard (doorbell)

**Goal:** Doorbell notification with camera snapshot, auto-close, and gate action.

### Devices

- Homey Display: **Entrance** (Shelly or Generic)
- Homey camera device from camera app (exposes image and/or video capabilities)

### Dashboard (minimal)

| Widget | Notes |
| --- | --- |
| Title “Entrance” | 2×1 or 3×1 |
| Light “Porch” | Optional |
| Cover “Gate” | Optional — separate from Flow gate action |

### Flow 1 — Show doorbell (THEN)

**WHEN** Doorbell driver → “Ring pressed” (your trigger)

**THEN** Entrance Display → **Show interactive notification**

| Field | Value |
| --- | --- |
| Notification Key | `doorbell` |
| Title | Doorbell |
| Message | Someone is at the entrance |
| Severity | warning |
| Highlight | on |
| Open automatically | on |
| Auto-close | 60 seconds |
| Camera / Media | Entrance camera device |
| Action ID | `open-gate` |
| Action button label | Open gate |
| Action text | Press to open the pedestrian gate |

### Flow 2 — Handle gate (WHEN … THEN)

**WHEN** Entrance Display → **A notification action is pressed**  
Action ID: `open-gate`

**THEN** Your gate device → Open (or scene)

### Expected behavior

1. Notification opens Center with camera **snapshot** (refreshed ~3 s while open).
2. After 60 s Center closes; **ribbon remains** if notification not removed.
3. Tap **Open gate** → WHEN Flow runs; button shows brief pending then “Action sent”.
4. RTSP/WebRTC streams are **not** live-played on the wall — snapshots only if Homey provides images.

See [Notification actions](notification-actions.md) · [Camera media](camera-media.md)

---

## C. Generic tablet pairing & IP identity

**Goal:** Understand Generic pairing without browser storage.

### Steps

1. Factory-reset browser or use private mode — no prior LocalDashboard data.
2. Open `http://<HOMEY_LAN_IP>:7999/` → note **6-digit code**.
3. Homey add device → Generic → enter code → confirm IP → add.
4. Refresh browser → dashboard (empty or configured).
5. Clear all site data for Homey IP in browser settings.
6. Reload `http://<HOMEY_LAN_IP>:7999/` → **still recognized** (same IP).
7. Move tablet to guest Wi-Fi (new IP) → pairing page again.
8. Fix: update **`settings.ip`** on the Homey device OR re-pair.

### Concepts taught

- Code = temporary; IP = routing
- No cookie/localStorage identity
- App restart clears **pending** codes, not paired devices

---

## D. Simple laundry notification (Flow only)

**WHEN** Washing machine → finished

**THEN** Kitchen Display → **Show notification**

| Field | Value |
| --- | --- |
| Key | `washer` |
| Message | Washing done |
| Severity | success |
| Icon | washing-machine |

Upsert: another Flow with same key `washer` updates the same notification instead of duplicating.

---

## Related

- [Getting started — walkthrough](getting-started.md#first-configuration-walkthrough)
- [Notifications](notifications.md)
- [Widgets](widgets.md)
