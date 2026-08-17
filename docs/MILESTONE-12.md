# Milestone 12 — Notification Lifecycle, Auto-Close & Native Flow Actions

**Status:** Done.

## Summary

Incremental evolution of the Milestone 11 / 11B notification system:

- Configurable `autoOpen` / `autoCloseSeconds` on `DisplayNotification`
- Optional single semantic `action` (actionId + label + optional text)
- Display → WebSocket → backend validation → Homey Device Flow Trigger
- Extended Show Notification Flow args (backward-compatible defaults)
- No parallel Event Overlay / second NotificationManager

## Architecture

```text
Homey Flow (Show notification)
        │
        ▼
NotificationManager (SoT + upsert key)
        │
        ▼
RealtimeGateway → WebSocket
        │
        ▼
Notification Center (auto-open / auto-close presentation)
        │ user presses CTA
        ▼
notification-action (typed WS)
        │
        ▼
Backend validation (authoritative SoT)
        │
        ▼
Device Flow Trigger (actionId filter via args + state)
        │
        ▼
User Homey automation
```

## Auto-open strategy

| Event | Behavior |
| --- | --- |
| `notification-added` + `autoOpen=true` | Open Center; may start auto-close |
| `notification-updated` of already-visible id | Update content only (no reopen loop) |
| `notification-updated` when id was not visible (restore after dismiss) | Treat like new visibility → honor `autoOpen` |
| Snapshot / reconnect | Apply list; **never** auto-open storm |
| Manual ribbon open | Open Center; **no** auto-close countdown |

Default `autoOpen = true` preserves M11/M11B push behavior for the simple Show card and for interactive cards when auto-open is left on.

## Auto-close

- Presentation only: closes Center; ribbon + SoT notification remain
- Never removes / dismisses / TTL-deletes
- Skipped when `dismissable: false` (blocking notification stays on screen)
- One timer; cancelled on user interaction, carousel change, dismiss, close, destroy, reschedule
- CSS progress bar (`prefers-reduced-motion` keeps a static hint)

## Notification action

- At most one CTA per notification
- `actionId` is semantic only (not capability / device / URL)
- Client payload is not trusted; backend resolves title/key/action from SoT
- Success = Flow trigger delivered (not “gate opened”)
- Action does not auto-remove the notification

### What Action ID is for

Homey has **one** WHEN card for every notification button:

> Display Ingresso → Viene premuta un'azione di una notifica

The same Display can show different buttons over time (doorbell, laundry, alarm). Without a filter, **every tap** would start **every** Flow that uses that WHEN card.

**ID azione** is the filter you invent so Homey knows *which* button was pressed.

```text
You type ID azione = open-gate  when you SHOW the notification
                        │
                        │  (stored on that notification)
                        ▼
User taps [ Apri cancello ] on the Wall Display
                        │
                        ▼
Homey: “a notification action was pressed, actionId = open-gate”
                        │
                        ▼
Only Flows whose WHEN card also says ID azione = open-gate continue
```

It is **not**:

- a Homey device
- a capability (`onoff`, …)
- the text on the button
- something you pick from a list

It is a **short name you choose**, like a Notification Key. You write it twice: once when showing the notification, once on the WHEN card that should react.

| You want this tap to mean… | A good Action ID |
| --- | --- |
| Open the pedestrian gate | `open-gate` |
| I saw the message, do nothing else | `acknowledge` |
| Call / notify someone | `call-owner` |
| Open the main door | `open-main-door` |

**Format:** `A–Z`, `a–z`, `0–9`, `.`, `_`, `-` only; 1–64 characters; no spaces.

### Action ID vs button label vs action text

These three fields exist only on **Show interactive notification**.

| Flow field (IT / EN) | Role | Shown on Display? |
| --- | --- | --- |
| **ID azione** / Action ID | Glue between SHOW and WHEN. Homey uses it to pick the right Flow. | No |
| **Testo pulsante** / Action button label | What the user reads on the button. | Yes |
| **Testo azione** / Action text | Optional sentence above the button. | Yes, only if filled |

Two notifications can share the same Action ID (same meaning) with different button labels (`Apri cancello` vs `Open gate`). Homey still matches on the ID, not on the label.

### Practice: two Flows for the doorbell

**Flow A — show the notification** (WHEN doorbell sensor / THEN)

THEN → Display Ingresso → **Mostra notifica interattiva**

- Chiave notifica: `doorbell`
- Titolo: `Campanello`
- Messaggio: `Qualcuno ha suonato all'ingresso`
- Abilita azione: on
- **ID azione: `open-gate`**
- Testo pulsante: `Apri cancello`
- Testo azione: `Premi per aprire il cancello pedonale`

**Flow B — react to the tap** (WHEN / THEN)

WHEN → Display Ingresso → **Viene premuta un'azione di una notifica**

- **ID azione: `open-gate`** ← must be the same string as Flow A

THEN → open the gate (or any other Homey action)

What the user sees:

```text
Campanello
Qualcuno ha suonato all'ingresso
Premi per aprire il cancello pedonale   ← testo azione
[ Apri cancello ]                       ← testo pulsante  (not the ID)
```

Tap → Flow B runs → Homey opens the gate. The Display never talks to the gate.

### Practice: two different buttons on the same Display

If later you also show a laundry notification with ID azione `acknowledge`, create a **third** Flow:

WHEN → Display Ingresso → Viene premuta un'azione di una notifica  
ID azione: `acknowledge`  
THEN → e.g. remove the notification

A tap on `Apri cancello` still runs only Flow B (`open-gate`). A tap on `Ho capito` runs only the laundry Flow. That is the whole point of Action ID.

If the WHEN card’s ID azione is **empty**, that Flow runs for **any** tap on that Display. Fill it whenever more than one CTA exists.

If **Abilita azione** is off **and** ID / button label are empty, there is no CTA. Filling **ID azione** and **Testo pulsante** is enough (the checkbox is not required).

### Troubleshooting: message without button

The notification body can appear while the action button does not. Check in this order:

1. The THEN card must be **Mostra notifica interattiva**, not **Mostra notifica**. The simple card never has a button (and it *clears* a previous action on the same key).
2. Fill **ID azione** (`open-gate`) **and** **Testo pulsante** (`Apri cancello`). After this app version, that is enough even if **Abilita azione** is off.
3. Re-run the Flow (or save and test again). Reload the Wall Display page so it picks up the new dashboard JS.
4. The action is the **filled** coloured button. **Nascondi** is secondary when an action exists.

### Troubleshooting: button stays loading and Flow does not start

The tap must reach Homey as a typed `notification-action` WebSocket message. After this fix, reload the Wall Display page (new `dashboard.js`) and run the interactive Show Flow again. If the CTA still fails, the button leaves loading after 8 seconds and shows Action failed.

## Flow cards

| Kind | Generic ID | Shelly ID |
| --- | --- | --- |
| Action (simple / M11B) | `show_notification` | `shelly_show_notification` |
| Action (interactive / M12) | `show_interactive_notification` | `shelly_show_interactive_notification` |
| Trigger | `notification_action_pressed` | `shelly_notification_action_pressed` |

Trigger filter: optional Action ID arg compared to `state.actionId` via `registerRunListener` (event-context-safe; no global last-action Condition).

Tokens: `notificationKey`, `actionId`, `actionLabel`, `actionText`, `notificationTitle`, `notificationMessage`.

## Backward compatibility

The original **Show notification** card is unchanged (same ID and args as M11B). Existing Flows keep working without re-edit.

M12 options live only on **Show interactive notification**. Simple Show upserts force `autoOpen=true`, disable auto-close, and clear any previous action on that key.

## Frontend performance (local after `npm run build`)

| Asset | Raw | gzip |
| --- | --- | --- |
| HTML | 760 B | 438 B |
| CSS | 38690 B | 6275 B |
| JS | 89744 B | 19892 B |
| **Total** | **129194 B** | **26605 B** |

M11B reference ~112981 B raw / ~23717 B gzip. Zero new runtime npm packages.

## Official Homey references consulted

- [Flow](https://apps.developer.homey.app/the-basics/flow)
- [Flow arguments](https://apps.developer.homey.app/the-basics/flow/arguments) (checkbox, number, optional `required: false`, trigger state)
- [Flow tokens](https://apps.developer.homey.app/the-basics/flow/tokens)
- [Device cards](https://apps.developer.homey.app/the-basics/flow#device-cards)
- [`ManagerFlow#getDeviceTriggerCard`](https://apps-sdk-v3.developer.homey.app/ManagerFlow.html#getDeviceTriggerCard)
- [`FlowCardTriggerDevice#trigger`](https://apps-sdk-v3.developer.homey.app/FlowCardTriggerDevice.html)
