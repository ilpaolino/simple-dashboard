# Dashboard Editor

The Dashboard Editor is the **only** place to configure widgets and dashboard theme for a Display. It lives in **Homey App Settings**, not on the Display browser.

## How to open

**Homey → More → Apps → LocalDashboard → Configure (App Settings)**

Scroll to the **Dashboard Editor** section.

<!-- TODO screenshot: Dashboard Editor in App Settings -->

Device **Advanced settings** show a read-only note directing you here for grid and widgets.

## Workflow

```text
1. Select Display        (dropdown of paired LocalDashboard devices)
2. Choose theme          (Dark / Light — per Display)
3. Grid preview          (read-only visual of current layout)
4. Add / edit widgets    (dialog overlay)
5. Save                  (validates → persists → pushes live if online)
```

There is **no drag-and-drop** editor in v1. Placement uses explicit row, column, and size fields with a grid preview.

## Select Display

The dropdown lists all Homey devices created by LocalDashboard drivers (Shelly + Generic). Each entry is one physical/logical screen.

Selecting a Display loads:

- its **layout** from device settings (columns × rows);
- its **dashboard configuration** from Device Store (`dashboard`);
- compatible widget types and span options.

## Theme

**Dark** or **Light** applies to the **entire dashboard** on that Display. Widgets inherit CSS tokens from the dashboard theme; they do not have individual themes.

Default when missing: **dark**.

## Add a widget

1. Click **Add Widget** (or edit an existing one from the widget list).
2. Choose **widget type** (Title, Date & Time, Light, Cover).
3. Configure type-specific options (text, Homey device, etc.).
4. Set **position**:
   - **Row** and **Column** — top-left origin; editor labels are 1-based, stored 0-based internally
   - **Size** — allowed spans for that widget type (e.g. Title: 2×1 or 3×1)
5. **Apply** — updates preview in the dialog.
6. **Save** on the main editor page to persist.

## Edit / remove

- Click a widget in the list to edit.
- **Remove** asks for confirmation (via Homey confirm when available).
- Overlapping placements or out-of-bounds positions are **rejected** — the editor does not auto-move other widgets.

## Save behavior

On save:

1. Configuration is **validated** (widget configs, spans, collisions, grid bounds).
2. Stored in Homey **Device Store** key `dashboard` for that Display device.
3. **DisplayRegistry** updated in LocalDashboard runtime.
4. Homey capability **subscriptions** recalculated for that Display.
5. If the Display has an active WebSocket, it receives a **complete updated configuration** immediately.

Offline Displays pick up changes on next connect via **full snapshot**.

## Live updates while editing

The grid preview in the editor dialog reflects placement. The physical Display updates only after **Save** on the main editor (not on every Apply in the dialog).

## What you cannot configure here

| Item | Where |
| --- | --- |
| Display IP | Device Advanced settings |
| Grid layout (2×2 vs 3×3, …) | Device Advanced settings |
| HTTP port | App Settings (top) |
| Notifications | Homey Flow |
| Shelly reboot | Homey Flow on Shelly device |

## Related

- [Grid & layout](grid-and-layout.md) — how placement works
- [Widgets](widgets.md) — each widget type in detail
- [Realtime](realtime.md) — live push after save
