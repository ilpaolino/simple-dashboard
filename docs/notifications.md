# Notifications

Notifications are a **global attention system** on each Display. They are **not widgets** — they do not use grid cells.

## What you see

| Element | Description |
| --- | --- |
| **Severity ribbon** | Top-right corner fold; color = highest severity among visible notifications; hidden when none |
| **Notification Center** | Full-screen modal carousel; one notification at a time |
| **Swipe / prev-next** | Move between notifications (no wrap at ends) |
| **Highlight** | Optional pulse animation using severity color; respects `prefers-reduced-motion` |

## Severity

Fixed priority (highest wins for ribbon color):

```text
critical  >  warning  >  success  >  info
```

## Icons

Flow/API payloads use controlled icon keys only:

`info`, `warning`, `success`, `error`, `home`, `bell`, `door`, `washing-machine`

Arbitrary HTML or custom SVG from external sources is rejected.

## Source of truth

**Homey / backend** publishes, updates, and removes notifications (primarily via **Homey Flow**). The Display browser:

- does **not** invent notification TTLs;
- may **dismiss locally** (hide on this screen only);
- receives updates over WebSocket when online.

### Local dismiss

Dismiss on Display A **≠** remove from Homey **≠** dismiss on Display B.

Dismiss state is **runtime RAM** per Display — cleared on **app restart**. If Homey still has the notification, it can reappear after restart.

Flow **Show** / upsert of the same **Notification Key** clears local dismiss on that Display so the notification can surface again.

## Non-dismissable notifications

When `dismissable: false` (Flow: “Can be hidden” unchecked):

- Hide, X, and backdrop/Escape close are blocked
- Auto-close is **skipped** (blocking alerts stay visible)
- Carousel navigation to other visible notifications may still work

## Soft limit

Maximum **32 active notifications per Display**. Additional publish attempts fail with `display_limit`.

## Carousel behavior

- Shows one notification at a time
- Does **not** loop from last to first
- Touch swipe supported

<!-- TODO screenshot: Notification ribbon -->
<!-- TODO screenshot: Notification Center carousel -->

---

## Homey Flow cards

Flow cards are scoped to the **selected Display device** (Shelly or Generic). Shelly devices use internally prefixed card ids (`shelly_show_notification`, …) with identical user-facing titles.

### Trigger

| Card | When |
| --- | --- |
| **A notification action is pressed** | User taps interactive notification button |

Optional **Action ID** argument filters which Flow runs — see [Notification actions](notification-actions.md).

**Tokens:** `notificationKey`, `actionId`, `actionLabel`, `actionText`, `notificationTitle`, `notificationMessage`.

### Actions

#### Show notification (simple)

Creates or **updates** a notification by **Notification Key** on this Display.

| Argument | Required | Notes |
| --- | --- | --- |
| **Notification Key** | Yes | Logical id, e.g. `doorbell`, `laundry-done` |
| **Title** | No | Omitted = no title line |
| **Message** | Yes | Plain text |
| **Severity** | Yes | critical / warning / success / info |
| **Icon** | No | From allowed set |
| **Highlight** | No | Checkbox |
| **Dismissable** | No | Default can hide |
| **Camera / Media** | No | Optional Homey device autocomplete |

**Semantics:** auto-open enabled; no auto-close timer; no action button. Re-showing the same key **updates** the same notification (same internal id).

#### Show interactive notification

Same fields as simple, plus:

| Argument | Notes |
| --- | --- |
| **Open automatically** | Default on |
| **Auto-close (seconds)** | 0 = disabled; closes Center only, not SoT |
| **Enable action** | Optional checkbox |
| **Action ID** | Routing label, e.g. `open-gate` — not shown on screen |
| **Action button label** | CTA text on button |
| **Action text** | Optional explanation above button |
| **Camera / Media** | Optional |

Use this card when you need auto-close and/or a button. Filling **Action ID** + **button label** is enough to show the CTA.

#### Remove notification

Removes by **Notification Key** on this Display.

#### Remove all notifications

Clears all active notifications targeting this Display.

### Aggregate capabilities (read-only)

Each Display device exposes:

| Capability | Meaning |
| --- | --- |
| `notification_count` | Active notifications (SoT, not local dismiss) |
| `highest_notification_severity` | Max severity among active |

These reflect Homey/backend state, not what is locally dismissed on the wall.

---

## Notification Key explained

The **Notification Key** is a short string **you invent** (`doorbell`, `trash`, `washer`).

- Scope: **one Display** + key → at most one active notification
- Same key again → **upsert** (update title/message/severity, keep internal id)
- Different Displays can use the same key independently

Example: key `doorbell` on Entrance Display is separate from `doorbell` on Kitchen Display.

---

## Auto-open and auto-close

| Feature | Behavior |
| --- | --- |
| **Auto-open** | Opens Notification Center when notification arrives/updates (if enabled) |
| **Snapshot/reconnect** | Does **not** storm auto-open for historical notifications |
| **Second Show same key** | Can re-open Center after auto-close (e.g. doorbell rings again) |
| **Auto-close** | Closes Center after N seconds; **ribbon stays**; does **not** remove notification |
| **Manual open from ribbon** | Does **not** start auto-close countdown |
| **User interaction** | Cancels auto-close timer |
| **Non-dismissable** | Skips auto-close |

Header may show **remaining seconds** during auto-close countdown.

---

## Related

- [Notification actions](notification-actions.md) — Action ID deep dive
- [Camera media](camera-media.md) — optional camera in notifications
- [Realtime](realtime.md) — WebSocket messages
- [Examples](examples.md) — doorbell Flow
