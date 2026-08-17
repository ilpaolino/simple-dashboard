# Notification actions

Interactive notifications can show a **button**. Pressing it runs a Homey Flow on the Display device. This page explains **Action ID** — the most common source of confusion.

## Action ID is not a Homey device

| What Action ID is | What it is not |
| --- | --- |
| A **routing label** you invent | A Homey device id |
| Matched between SHOW and WHEN Flow cards | Shown on the Display |
| Same string on both cards | A capability or zone name |

Think of it like a **channel name** for automation: `open-gate`, `acknowledge`, `silence-alarm`.

## Two Flows, one Action ID

### Flow 1 — Show the notification (THEN)

Device: **Entrance Display**  
Action: **Show interactive notification**

| Field | Example value |
| --- | --- |
| Notification Key | `doorbell` |
| Title | Doorbell |
| Message | Someone is at the entrance |
| Action ID | `open-gate` |
| Action button label | Open gate |
| Action text | Press to open the pedestrian gate |

The user sees the **button label** and **action text** — not the Action ID.

### Flow 2 — Handle the button (WHEN … THEN)

**WHEN**  
Device: **Entrance Display**  
Trigger: **A notification action is pressed**  
Action ID filter: `open-gate` *(same string)*

**THEN**  
Your automation (e.g. open gate, announce TTS, flash lights).

Only Flows whose WHEN card matches the pressed **Action ID** run for that tap. Without the filter, any action button on that Display could start every “action pressed” Flow.

## What happens on the Display when the button is pressed

```text
User taps CTA
  → notification-action over WebSocket
  → backend validates notification still active + actionId matches SoT
  → Homey Flow trigger fires with tokens
  → Display shows neutral feedback ("Action sent" / failure)
  → CTA pending cleared (8 s timeout if trigger fails)
```

**Action sent** means the Flow **trigger** fired — not that your THEN actions necessarily succeeded (e.g. offline gate motor).

The Notification Center **stays open** after a successful action unless the user closes it or auto-close applies.

## Tokens available in WHEN Flow

| Token | Content |
| --- | --- |
| `notificationKey` | e.g. `doorbell` |
| `actionId` | e.g. `open-gate` |
| `actionLabel` | Button text |
| `actionText` | Optional explanation |
| `notificationTitle` | Notification title |
| `notificationMessage` | Notification message |

Use these in Flow actions (log, conditions, etc.).

## Simple vs interactive Show card

| Card | Button | Auto-close | Action |
| --- | --- | --- | --- |
| **Show notification** | No | No | Clears action if same key updated |
| **Show interactive notification** | Optional | Optional | Full control |

Do not use the simple card if you need a CTA — use the interactive card.

## Troubleshooting Action ID

| Problem | Likely cause |
| --- | --- |
| Button visible, nothing runs | Missing WHEN Flow or Action ID typo |
| Wrong Flow runs | Action ID filter empty or mismatched |
| Button stuck loading | Homey trigger error; check diagnostics; 8 s timeout |
| Button missing | Interactive card not used; or Action ID + label not filled |

See [Troubleshooting — Notification button](troubleshooting.md#notification-button-does-nothing).

## Related

- [Notifications](notifications.md) — Flow card reference
- [Examples — Entrance doorbell](examples.md#b-entrance-dashboard-doorbell)
- [MILESTONE-12.md](MILESTONE-12.md) — historical technical notes
