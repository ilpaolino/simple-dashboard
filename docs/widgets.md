# Widgets

Widgets are the building blocks of a LocalDashboard grid. Each widget has a **type**, unique **id**, **placement** (position + span), **configuration**, and optional **interactions**.

Notifications are **not** widgets — see [Notifications](notifications.md).

## User view

On the Display you see tiles and labels bound to Homey. Device widgets (Light, Cover) show live state from Homey and update over WebSocket without refreshing the page.

## Developer view (brief)

| Concept | Role |
| --- | --- |
| **Widget Registry** | Registers types, allowed spans, validation |
| **Configuration** | Persisted in Device Store (`dashboard`) |
| **Runtime state** | Resolved from Homey + realtime (not duplicated in config) |
| **Renderer** | Frontend module per type (`frontend/widgets/`) |
| **Interactions** | Map gestures to semantic actions (`widget-action` over WebSocket) |

Architectural rule: the browser sends **intents** (`widgetId` + `action`); the backend resolves Homey `deviceId` and capabilities. See [Security](security.md).

## Widget catalog (v1)

| Type | Spans | Binds Homey device | Interaction |
| --- | --- | --- | --- |
| [Title](#title-widget) | 2×1, 3×1 | No | None |
| [Date & Time](#date--time-widget) | 1×1, 2×1 | No | None |
| [Light](#light-widget) | 1×1 | Yes (`onoff` required) | Tap, long-press |
| [Cover](#cover-widget) | 1×1 | Yes (`windowcoverings_set`) | Tap → overlay |

---

## Title widget

### Purpose

Static heading text — room name, section title, house name, or context label.

### Configuration

| Field | Required | Options |
| --- | --- | --- |
| **text** | Yes | Any non-empty string |
| **alignment** | Yes | `left`, `center`, `right` |
| **chrome** | No | `plain` (default) or `card` (border/background) |

### Spans

- **2 × 1** — two columns, one row
- **3 × 1** — three columns, one row

### Appearance

Inherits dashboard theme. `plain` chrome is borderless; `card` adds a framed look.

### Behavior

Read-only. No WebSocket commands. Re-renders when dashboard configuration changes.

<!-- TODO screenshot: Title widget on dashboard -->

---

## Date & Time widget

### Purpose

Live clock and/or date on the wall — always current, not frozen at page load.

### Configuration

| Field | Required | Options |
| --- | --- | --- |
| **mode** | Yes | `time`, `date`, `date-time` |
| **chrome** | No | `plain` or `card` |

### Spans

- **1 × 1**
- **2 × 1**

### Update lifecycle

The frontend runs a **client-side timer** to refresh the displayed time/date. This avoids polling Homey for clock data. The timer is **cleared** when the widget is removed or configuration is replaced.

Locale formatting follows the dashboard bootstrap locale (Homey app language: EN, IT, DE, FR, DA, ES, PT).

### Behavior

Read-only. No Homey device binding.

---

## Light widget

### Purpose

Control and monitor a Homey light device from the wall.

### Homey compatibility

A device is selectable when it exposes the official **`onoff`** capability. Optional capabilities unlock advanced controls:

| Capability | Advanced control |
| --- | --- |
| `onoff` | Toggle (required) |
| `dim` | Brightness slider |
| `light_temperature` | Color temperature slider |
| `light_hue` + `light_saturation` | Color pad (both required) |
| `light_mode` | Written when setting temperature/color (if present) |

### Configuration (persisted)

| Field | Required | Notes |
| --- | --- | --- |
| **deviceId** | Yes | Homey device id only — name/zone/state **not** stored |
| **title** | No | Optional override; otherwise Homey device name |

### What you see

- Device **name** and **zone** (from Homey, live)
- **ON / OFF** state (from Homey — source of truth)
- Decorative **light icon** (non-interactive, low opacity)
- **Unavailable** styling if device missing, offline, or lacks `onoff`
- **Pending** overlay while a command awaits Homey confirmation
- **Error** feedback on timeout or rejected command

### Single tap — toggle

```text
Tap tile
  → widget-action { action: toggle }
  → backend validates session + widget ownership
  → reads current Homey onoff, writes opposite
  → pending overlay (up to 4 s)
  → Homey realtime confirms onoff
  → tile shows confirmed state + command-succeeded
```

LocalDashboard **does not** assume success when the tap is sent. If Homey reports a different state, the UI follows Homey.

Further taps while pending are ignored. There is **no offline queue** — disconnect clears pending state.

### Long press — advanced panel

Hold **~500 ms** (minimal movement) to open **Light control panel** inside the global overlay:

- **Brightness** (if `dim`) — drag preview, send on **release**
- **Temperature** (if `light_temperature`) — 0 = cool, 100 = warm (Homey semantics)
- **Color** (if hue + saturation) — hue × saturation pad, send on release

Tap and long-press are **mutually exclusive** for one gesture — opening the panel does not also toggle.

Closing the overlay does **not** cancel in-flight Homey writes.

<!-- TODO screenshot: LightWidget tile -->
<!-- TODO screenshot: Light advanced control panel -->

---

## Cover widget

### Purpose

Monitor and control a Homey cover (blind, shutter, garage door) with position feedback.

### Homey compatibility

Requires official **`windowcoverings_set`**. Optional **`windowcoverings_state`** enables **Stop** (writes `idle`).

### Configuration (persisted)

| Field | Required |
| --- | --- |
| **deviceId** | Yes |
| **title** | No (optional override) |

### What you see

- Device name and zone
- **Position** as **0–100%** (0 = closed, 100 = open)
- Vertical **bar** fill height = current percent
- Decorative cover icon
- **Unavailable** if device or capability missing

Homey stores position as 0–1; LocalDashboard normalizes to integer percent for display.

### Interaction — tap opens overlay

The tile tap does **not** move the cover. It opens **Cover control panel**:

| Control | Behavior |
| --- | --- |
| **Vertical slider** | Drag = preview only; **release** sends `set-position` |
| **Open** | Sends position 100% |
| **Close** | Sends position 0% |
| **Stop** | Only if `windowcoverings_state` exists; sends `stop` → idle |

Pending state is shown separately from Homey-confirmed position. The UI does not simulate physical movement between Homey reports.

Confirmation: set-position within ~1% of target or first coherent progress (timeout **8 s**); stop when state is idle (timeout **4 s**).

<!-- TODO screenshot: CoverWidget tile -->
<!-- TODO screenshot: Cover control overlay -->

---

## Unavailable widgets

If the bound Homey device is removed, offline, or missing required capabilities:

- The widget **stays on the grid**
- Visual state: **unavailable**
- Stored `deviceId` is **not** auto-deleted

Fix the binding in the Dashboard Editor or restore the Homey device.

## Adding new widget types (developers)

High-level steps — see [Development](development.md):

1. Define type in `lib/widgets/<type>/` (config, validation, spans).
2. Register in `WidgetRegistry`.
3. Add frontend renderer in `frontend/widgets/<type>/`.
4. If device-bound, add subscription extraction and command handler actions.
5. Add editor UI in `frontend/settings/editor.ts`.

Do not send raw Homey device ids from the browser.

## Related

- [Dashboard Editor](dashboard-editor.md)
- [Grid & layout](grid-and-layout.md)
- [Realtime](realtime.md)
