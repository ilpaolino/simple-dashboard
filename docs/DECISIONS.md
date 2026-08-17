# Decisions

Architectural choices for Milestone 16 (v1). Earlier decisions remain in force below and in prior milestone docs.

## LocalDashboard is the product name; app id is unchanged

**Choice:** User-facing branding is **LocalDashboard**. The Homey application identifier remains `dev.dadda.simpledashboard`.

**Why:** Homey uses the app id for install/update identity. Renaming it would publish a different app and break in-place upgrades.

## LAN HTTP trust uses socket IP only

**Choice:** The local HTTP server derives client identity from `socket.remoteAddress` only. `X-Forwarded-For` is ignored.

**Why:** The server binds directly on Homey Pro LAN. Trusting forwarded headers would let any client impersonate a paired Display IP.

---

Architectural choices for Milestone 15. Earlier decisions remain in force below and in prior milestone docs.

## Generic Web Display remains IP-based

**Choice:** Runtime and persistent routing identity for Generic displays stays `settings.ip`. Pairing code is not stored on the device.

**Why:** Wall browsers must work after cache/cookie clears; IP is the configured Homey setting.

## Pairing code is temporary correlation only

**Choice:** Six-digit codes live in `GenericDisplayPairingManager` RAM, bound to client IP, consumed after successful Homey pairing.

**Why:** Simplifies first setup without inventing browser credentials.

## No browser-persisted identity

**Choice:** No localStorage, cookies, UUID, or fingerprint for recognition.

**Why:** Explicit M15 requirement; IP remains the sole routing key.

## Pairing sessions are runtime-only

**Choice:** Pending codes are lost on app restart; browsers must show a fresh code.

**Why:** Minimal persistence; codes are cheap to regenerate.

## Layout is never inferred automatically

**Choice:** Viewport and browser capabilities are diagnostics/runtime metadata only.

**Why:** Layout stays user-configured in App Settings / Device Store.

## Browser capabilities are runtime metadata

**Choice:** `GenericBrowserCapabilityStore` holds the latest `generic-client-hello` per online Generic display.

**Why:** Useful for diagnostics and future UX; not identity.

---

Architectural choices for Milestone 14. Earlier decisions remain in force below and in prior milestone docs.

## Hardware features are discovered, not assumed

**Choice:** Shelly-specific controls (today: reboot) are exposed only after `Shelly.ListMethods` discovery and mapping in `lib/shelly/mapFeatures.ts`. No brightness/volume/reload without official RPC documentation.

**Why:** Avoid reverse-engineering; firmware may differ by model.

**Refs:** [Shelly.ListMethods](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly#shellylistmethods), [Shelly.Reboot](https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Shelly#shellyreboot).

## Discovery occurs at pairing, startup and manual request

**Choice:** Hardware discovery runs at Shelly pairing (after identity), once per display at app startup (sequential), and via Homey Maintenance action `button.rediscover_hardware`. No `setInterval` polling.

**Why:** Minimal LAN load; predictable RAM footprint.

## Shelly RPC is isolated behind a dedicated client/service

**Choice:** `ShellyWallDisplayRpcClient` + `ShellyWallDisplayHardwareService`. Flow handlers and Device classes never build raw RPC payloads.

**Why:** Single timeout/error normalization; testability.

## Unknown differs from unsupported

**Choice:** `HardwareFeatureStatus`: discovery failure → `unknown`; successful discovery without method → `unsupported`.

**Why:** Diagnostics must not treat offline devices as “feature absent”.

## Generic Web Display does not expose Shelly hardware controls

**Choice:** Shelly reboot Flow card, RPC discovery, and maintenance rediscovery exist only on `shelly_wall_display` driver.

**Why:** Driver separation from Milestone 2 remains strict.

## Reboot requires no additional confirmation

**Choice:** Flow Action `shelly_reboot_display` executes immediately. Expected disconnect after reboot is logged, not treated as failure.

**Why:** Flow execution is intentional automation.

## Hardware profile is runtime-only

**Choice:** `ShellyHardwareProfileStore` in RAM; not Homey Settings / Device Store. Device Settings labels are a read-only mirror for users.

**Why:** Profile is reconstructable; avoids stale persisted capability assumptions.

---

Architectural choices for Milestone 13. Earlier decisions remain in force below and in prior milestone docs.

## Camera media extends Notifications

**Choice:** Optional camera/media is a field on the existing `DisplayNotification`. There is no Camera Overlay, Event Overlay, or second Notification Center / NotificationManager.

**Why:** One attention surface. A parallel camera system would duplicate lifecycle, RAM, and UX.

## Camera selected through Homey Flow

**Choice:** The Show cards gain an optional autocomplete **Camera / Media**. The user picks a Homey Device. The app never asks for IP, RTSP URL, username, or password.

**Why:** Official Flow arguments. A second `type: "device"` on a Device card only lists devices paired in *this* app; cameras belong to other apps, so autocomplete is the documented way to pick any Homey Device. `required: false` keeps pre-M13 Flows valid (`args.media` may be `undefined`).

## Video preferred with image fallback

**Choice:** If Homey exposes both a **browser-playable** video and an image, video is the main view and image is placeholder/fallback. RTSP/RTMP/WebRTC/HLS/DASH are **not** treated as playable on the Wall Display `<video>` element.

**Why:** Homey brokers those types to its own frontends (WebRTC proxy as of 12.12) and does not transcode. Sending RTSP to `<video>` would show a broken player.

## Media lives only while visible

**Choice:** Live media starts only when the Notification Center is open **and** the current carousel item has media. Close, auto-close, hide, dismiss, swipe, disconnect, destroy, and camera upsert all stop and clean up immediately. At most one live session per Display.

**Why:** RAM/CPU/network. Preloading neighbour cards would keep extra streams.

## No transcoding on Homey

**Choice:** No ffmpeg, no persistent restream, no in-process media server. `/notification-media/:id/video` returns 415.

**Why:** Homey Pro must not become a transcoding appliance. Snapshot fallback is the stable path for real cameras today.

## Backend owns media resolution

**Choice:** `NotificationMediaResolver` inspects Homey `Device.images` / `Device.videos` (defensively parsed) and emits a frontend-safe `NotificationMedia`. The browser never sees Device ids, tokens, or stream URLs.

**Why:** Capability detection belongs on Homey; the Wall Display must not hold camera credentials.

## No arbitrary URL proxy

**Choice:** Image bytes are fetched by the backend from the Homey-local image URL (same host as Homey’s local API only) and served at `GET /notification-media/:id/image` on port **7999**, scoped to Display IP + notification + media binding.

**Why:** An open `/proxy?url=` would be SSRF. The client cannot choose a camera id or URL.

## Live snapshot refresh when video is not playable

**Choice:** While the Notification Center shows an image (or a video fallback image), the frontend refetches the scoped snapshot every **3 s** (one in flight; next fetch starts when the previous completes). Cache-busting query; `Cache-Control: private, no-store`; Homey image GET is also `no-store`. Stop immediately on close / swipe / auto-close. The backend reuses the resolved Homey image URL for a few seconds so refresh does not re-list devices on every tick.

**Why:** Typical Homey cameras expose RTSP / WebRTC / HLS, which the Wall Display `<video>` cannot play without transcoding. Homey camera apps call `Image.update()` about every 3s; polling faster only re-downloaded the same JPEG and wasted RAM/bandwidth on Homey Pro and the Wall Display.

## Visible auto-close remaining time

**Choice:** When presentation auto-close is scheduled, the header shows remaining seconds (in addition to the progress bar). Manual ribbon open still does not start auto-close.

**Why:** A doorbell that closes in 60s should make that deadline obvious, not only via a thin bar.

---

Architectural choices for Milestone 12. Earlier decisions remain in force below and in prior milestone docs.

## Notifications remain the single attention system

**Choice:** No Event Overlay / second NotificationManager / parallel attention protocol. Auto-open, auto-close, and actions extend the existing Notification Center.

**Why:** Wall Displays need one global attention surface; duplicating systems increases RAM and UX confusion.

## Auto-open is notification metadata

**Choice:** `autoOpen` is stored on each `DisplayNotification`. The light Show card always uses `true`. The interactive card configures it from Flow. Snapshot/reconnect never storms auto-open.

**Why:** Homey Flow authors decide presentation; reconnect must not replay historical opens.

## Auto-close affects presentation only

**Choice:** Auto-close closes the fullscreen Center after N seconds when opened via auto-open. It never removes, dismisses, or TTL-deletes SoT notifications. Ribbon stays. Manual ribbon open does not start the countdown. User interaction cancels the timer. **`dismissable: false` skips auto-close** so a blocking notification cannot time out.

**Why:** Homey remains lifecycle SoT; auto-close is UX, not state mutation. “Cannot be hidden” must also mean it stays on screen.

## Notification actions are semantic events

**Choice:** The Display emits `actionId` over a typed WebSocket message. It never receives Homey `deviceId` / capability / value commands for notification CTAs. Backend validates against SoT before triggering Flow.

**Why:** Security and architecture: Homey Flow owns automation consequences.

**User-facing split:**

- **ID azione** (`actionId`) — routing key the Flow author invents. Written on the SHOW card and again on the WHEN card so Homey can tell `open-gate` apart from `acknowledge` on the same Display. Not a Homey device, not shown on screen.
- **Testo pulsante** (`actionLabel`) — CTA on the button.
- **Testo azione** (`actionText`) — optional explanation above the button.

See [MILESTONE-12.md](MILESTONE-12.md#what-action-id-is-for).

## Homey Flow owns automation

**Choice:** Device Flow Trigger `notification_action_pressed` (Shelly-prefixed twin) carries tokens; optional Action ID arg filters via `registerRunListener(args, state)`.

**Why:** Official Homey trigger-state pattern is event-context-safe; avoids fragile global “last action”.

## One action per notification

**Choice:** M12 supports a single optional CTA (`actionId`, `label`, optional `text`).

**Why:** Keep Wall Display UI and protocol simple.

## Existing M11/M11B Flow compatibility

**Choice:** Keep the original lightweight Device Action Card `show_notification` / `shelly_show_notification` unchanged (M11B args only). Add a separate interactive card `show_interactive_notification` / `shelly_show_interactive_notification` for auto-open, auto-close, and action.

**Why:** Extending the same card with many new args would bloat every simple Flow and risk surprising Homey migrations. Two cards keep “light” Flows untouched and make advanced options opt-in.

**Simple card semantics on upsert:** `autoOpen=true`, auto-close disabled, action cleared (so a light Show of the same key does not leave a stale CTA).

## Upsert auto-open decision

**Choice:** Auto-open on `notification-added` and on `notification-updated` when `autoOpen` is not false — including when that id is already in the visible list (second Flow Show of the same key after auto-close). Snapshot/reconnect never auto-opens.

**Why:** Auto-close only hides the Center; the notification stays on the ribbon. A doorbell that rings again is still an upsert of `doorbell`, so skipping auto-open on update made the second ring invisible. Re-presenting is what Flow “Show” means. Snapshot/reconnect stays quiet so reconnect does not storm the wall.

---

Architectural choices for Milestone 11B. Earlier decisions remain in force below and in prior milestone docs.

## Notifications are controlled natively through Homey Flow

**Choice:** Primary operational path is Homey Device Flow Action Cards → NotificationManager. External HTTP Web API remains available for diagnostics/tests but is not required for normal use.

**Why:** Homey users expect Flow automation without custom HTTP callers.

## Device Flow Action Cards for commands

**Choice:** Parameterized notification commands use Device Flow Action Cards on each Wall Display driver (`driver.flow.compose.json`). Homey Compose injects the `device` argument with a per-driver `driver_id` filter so cards appear under the selected device in Flow.

**Why:** App-level cards shared with `driver_id=a|b` validate, but `class: other` Wall Displays were hard to discover in the Flow device picker. Per-driver device cards match Homey’s Device cards pattern. Homey forbids duplicate Flow card IDs across drivers, so Shelly uses prefixed IDs (`shelly_show_notification`, …) with the same titles and shared run listeners.

**Refs:** [Flow](https://apps.developer.homey.app/the-basics/flow), [Device cards](https://apps.developer.homey.app/the-basics/flow#device-cards), [Flow arguments](https://apps.developer.homey.app/the-basics/flow/arguments).

## Notification Key enables deterministic upsert

**Choice:** Logical identity is `displayId + notificationKey`. Same key on one Display upserts; same key on another Display is a separate instance. Internal UUID `id` is unchanged for frontend dismiss tracking.

**Why:** Flow authors need stable keys (`lavatrice`, `raccolta-rifiuti`) without managing UUIDs.

## Capabilities represent state, not notification payload

**Choice:** Read-only `notification_count` and `highest_notification_severity` reflect Homey/backend SoT aggregates. Title/message/icon/highlight are never stuffed into capability strings/JSON.

**Why:** Homey capabilities are for state; parameterized commands belong in Flow Action Cards.

**Refs:** [Custom capabilities](https://apps.developer.homey.app/the-basics/devices/capabilities).

## Local dismiss remains independent from Flow removal

**Choice:** Display dismiss stays runtime-local. Flow remove / remove-all delete SoT notifications. Flow **Show / upsert** of the same key clears local dismiss on that Display so the notification can reappear (the card means “show”). Generic HTTP `updateNotification` of the same id without going through upsert still keeps dismiss. Remove then re-show creates a new id when the key was removed.

**Why:** A silent upsert after dismiss left the gateway skipping the realtime push, so Wall Displays stayed empty while Homey still held an active notification. “Show notification” must be able to surface again.
## Optional Flow title uses Homey `required: false`

**Choice:** Title and icon Flow args use official `required: false`. Empty/omitted title → no title.

**Why:** Documented Homey optional-argument pattern; no custom workaround.

## Flow `titleFormatted` omits `[[device]]`

**Choice:** Device Flow cards omit `[[device]]` from `titleFormatted` (Homey injects the device argument and rejects that token in formatted titles). Non-device args of show-notification cards are referenced in `titleFormatted` as required by validate.

**Why:** Stay within official Homey validation rules.

---

Architectural choices for Milestone 11. Earlier decisions remain in force below and in prior milestone docs.

## Notifications are global dashboard chrome

**Choice:** Notifications do not occupy grid cells. The severity triangle and Notification Center are overlays outside the grid.

**Why:** Notifications are Display-level alerts, not layout widgets. Grid geometry must not resize when they appear.

## Four severity levels

**Choice:** Exactly `critical` > `warning` > `success` > `info`, with centralized numeric priority (never alphabetical).

**Why:** Deterministic indicator color and carousel ordering across IT/EN and future Flow cards.

## Notification Center supports multiple notifications

**Choice:** Active notifications are an array shown one-at-a-time in a carousel with previous/next and swipe.

**Why:** Wall displays need a compact modal, not a scrolling list of cards.

## Dismiss is local to a Display

**Choice:** Dismiss hides a notification only on the current Display. Other Displays and the backend source of truth are unchanged.

**Why:** Two kitchens may share an alert; one user clearing it must not silence the other screen.

## Non-dismissable notifications stay on screen

**Choice:** `dismissable: false` hides Hide, X, and Dismiss, ignores backdrop / Escape, and skips auto-close. The Center stays open until Homey removes the notification (or the visible list becomes empty). Carousel navigation to another visible notification is still allowed.

**Why:** The Flow checkbox is labelled “can be hidden”. Closing the modal would put a blocking alarm/doorbell away from the Display.

## Dismiss state is runtime-only

**Choice:** `Map<displayId, Set<notificationId>>` in RAM. Never Homey Settings / disk / database. App restart clears dismiss.

**Why:** Matches DisplayRegistry / realtime session philosophy. Intentional reappearance after reboot if Homey still considers the notification active.

## Backend controls notification lifecycle

**Choice:** Only Homey/backend publish, update, and remove. No frontend TTL timers.

**Why:** Homey remains source of truth; Flow cards can drive the same API later.

## Severity indicator

**Choice:** Top-right **corner ribbon** (page-fold) uses the highest visible severity color; hidden when the visible list is empty. Realtime `notification-added` / `notification-updated` also open the Notification Center immediately.

**Why:** At-a-glance urgency on a wall display; a floating triangle was easy to miss, and “Show notification” should present the modal without requiring a second tap.

## Highlight uses CSS

**Choice:** Highlight pulse is `@keyframes` between severity tint and modal gray. No JS animation loops. Respect `prefers-reduced-motion`.

**Why:** Wall-display CPU/battery and accessibility.

## Notification API prepared for Flow integration

**Choice:** `NotificationManager.publishNotification` / `updateNotification` / `removeNotification` (+ Homey Web API) without Flow UI yet.

**Why:** Milestone 12+ can add Flow cards without redesigning the Center.

## Carousel does not loop

**Choice:** Previous on first / next on last is a no-op.

**Why:** Predictable touch UX; avoids accidental wrap on wall panels.

## Controlled notification icons

**Choice:** Fixed icon keys (`info`, `warning`, `success`, `error`, `home`, `bell`, `door`, `washing-machine`) rendered as inline SVG. No arbitrary HTML/SVG from payloads.

**Why:** Security and footprint; extend the allow-list when needed.

## Soft per-Display notification cap

**Choice:** `MAX_NOTIFICATIONS_PER_DISPLAY = 32`.

**Why:** Prevent unbounded growth without designing for thousands of alerts.

---

Architectural choices for Milestone 10. Earlier decisions remain in force below and in prior milestone docs.

## Tap vs long press

**Choice:** Tap on LightWidget keeps the fast ON/OFF toggle. Long press opens `LightControlPanel`. The recognizer never emits both for the same pointer sequence.

**Why:** Wall users need one-tap power and a deliberate path into advanced controls. Deterministic Pointer Events avoid ghost toggles after opening the panel.

**Constants:** `LONG_PRESS_MS = 500`, `LONG_PRESS_MOVE_TOLERANCE_PX = 12` in `lib/realtime/constants.ts`.

## Capability-driven LightControlPanel

**Choice:** The panel renders only controls whose Homey capabilities are present: `onoff`, `dim`, `light_temperature`, and both `light_hue` + `light_saturation` for color. No editor toggles to enable dimmer/temperature/color.

**Why:** Homey remains the source of capability truth. Showing disabled stubs for missing capabilities would mislead users.

**Refs:** [Lights best practices](https://apps.developer.homey.app/the-basics/devices/best-practices/lights), capability JSON in `node-homey-lib`.

## Normalized frontend values

**Choice:** Dim and color temperature use UX integers 0…100. Temperature mapping follows Homey semantics (higher = warmer → 100 = warm, 0 = cool). Hue/saturation also use 0…100. The backend denormalizes to Homey `[0, 1]`.

**Why:** The browser must not depend on Homey’s unit interval. Matches the CoverWidget percent pattern.

## Send-on-release

**Choice:** Dim, temperature, and color pad update local preview while dragging. One intent is sent on pointer release (or cancel without send).

**Why:** Avoids flooding Homey during drag on wall displays.

## Brightness separated from color

**Choice:** The color pad controls hue and saturation only. Brightness remains on the dimmer slider.

**Why:** Matches Homey’s separation of `dim` from `light_hue` / `light_saturation` and keeps the picker light-weight.

## Reuse WidgetControlOverlay

**Choice:** LightWidget hosts `LightControlPanel` inside the same global overlay shell as CoverWidget. Only one overlay is active at a time.

**Why:** Avoids a second modal stack; shared Escape / backdrop / close behavior.

## One pending command per light widget

**Choice:** Toggle, dim, temperature, and color share a single pending slot per widget (same as M7/M9). No per-capability pending queues.

**Why:** Simplest robust policy against command storms; Homey confirmation remains the source of truth.

## Optional light_mode writes

**Choice:** When Homey documents `light_mode`, set-temperature writes `temperature` and set-color writes `color` before the value capabilities.

**Why:** Official Homey light UI uses `light_mode` to switch between temperature and color components.

---

Architectural choices for Milestone 9. Earlier decisions remain in force below and in prior milestone docs.

## Cover tile opens control overlay

**Choice:** Tapping CoverWidget opens `WidgetControlOverlay` with `CoverControlPanel`. The tile does not send open/close/stop or position commands directly.

**Why:** Cover control needs a target preview, Open/Close shortcuts, and optional Stop. Putting that UX in a dedicated panel keeps the grid tile simple and reusable for other widget types later.

## WidgetControlOverlay

**Choice:** One global overlay shell outside the grid (backdrop, title area, close affordances, Escape). Hosts widget-specific panels; only one overlay at a time.

**Why:** Shared chrome for future control panels (e.g. light dimmer) without inventing a second overlay stack or embedding modals inside grid cells.

## Send on release

**Choice:** The vertical slider updates a local target preview while dragging. A single `set-position` intent is sent on pointer release. Open/Close send one position command each.

**Why:** Avoids flooding Homey with intermediate values during a drag. Pointer Events keep touch and mouse consistent on wall displays.

## Current state and target are distinct

**Choice:** UI always shows Homey-confirmed current percent separately from the pending/preview target.

**Why:** Homey remains source of truth. Collapsing current and target would imply the cover has already arrived at the commanded position.

## No movement interpolation

**Choice:** Neither the tile bar nor the overlay invents mid-travel positions. Progress appears only when Homey reports capability updates.

**Why:** Same as Milestone 8: simulated motion lies when devices move slowly or report sparsely.

## Open/Close use position commands

**Choice:** Open = `set-position` 100%; Close = `set-position` 0%. No separate Homey “open/close” capability writes.

**Why:** Official control path for position covers is `windowcoverings_set`. Reuses one intent, one confirmation path, and one denormalization rule.

**Refs:** [windowcoverings_set](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/windowcoverings_set.json), [Window coverings best practices](https://apps.developer.homey.app/the-basics/devices/best-practices/window-coverings).

## Stop only when officially supported

**Choice:** Stop is exposed only when Homey documents `windowcoverings_state` on the device. Stop writes `idle`. Devices without that capability never show Stop.

**Why:** Do not invent stop via undocumented APIs or guessed capabilities. Matches Homey’s official stop semantics.

**Refs:** [windowcoverings_state](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/windowcoverings_state.json).

## Cover confirmation is progress-aware

**Choice:** `set-position` confirms on Homey percent within **1%** of target **or** the first coherent progress from the baseline toward the target. Timeout **8000 ms** (acknowledgement / start of motion, not full travel). Stop confirms when `windowcoverings_state === idle` (timeout **4000 ms**) and may replace an in-flight set-position. Successful confirmation emits `command-succeeded`.

**Why:** Waiting for full physical travel would leave wall UX pending for tens of seconds. First coherent progress (or near-target report) is enough to know Homey accepted the command. Intermediate reports must not leave the client stuck pending without an explicit success signal.

## Overlay close does not cancel commands

**Choice:** Closing the overlay (backdrop, X, Escape, or live-config dismiss) does not abort Homey writes already sent. Pending lifecycle continues until confirm / reject / timeout.

**Why:** Homey already received the command. Cancelling UI must not pretend the device stopped, and must not orphan pending bookkeeping.

## Live config while overlay is open

**Choice:** If the open widget is removed from the live dashboard configuration, or the bound device changes unsafely, the overlay closes. Otherwise capability `widget-state` updates continue to feed the panel.

**Why:** Avoid controlling a widget/device that no longer exists on this Display, without discarding unrelated live updates.

---

Architectural choices for Milestone 8. Earlier decisions remain in force below and in prior milestone docs.

## CoverWidget read-only first

**Choice (M8):** The first CoverWidget implementation shows only state/position. No open/close/stop, slider, or gestures.

**Status:** Partially superseded by Milestone 9. The read path, normalization, and tile visuals remain; interactive control now uses WidgetControlOverlay + widget intents (`set-position` / `stop`).

**Why (historical):** Matched the successful LightWidget pattern (read snapshot/realtime first). Control reuses the Milestone 7 widget-intent command path without rewriting the tile.

## 0–100 normalized UX

**Choice:** The frontend always receives an integer percent where `0% = closed` and `100% = open`, regardless of Homey’s internal representation.

**Why:** Official Homey `windowcoverings_set` is already `0…1` with the same semantics; the backend still owns normalization so the browser never depends on Homey’s scale.

**Refs:** [windowcoverings_set capability](https://github.com/athombv/node-homey-lib/blob/master/assets/capability/capabilities/windowcoverings_set.json), [Window coverings best practices](https://apps.developer.homey.app/the-basics/devices/best-practices/window-coverings).

## No inferred movement

**Choice:** The vertical bar paints only the latest Homey value. No interpolation, simulated travel, or estimated mid-positions.

**Why:** Homey remains source of truth. Invented motion would lie when devices move slowly or report sparsely.

**Note:** Milestone 9 keeps this rule for both the tile and the control panel.

## Device icons are decorative

**Choice:** Tile icons are large, low-opacity, top-right, and never encode ON/OFF/percent.

**Why:** State must stay readable as text/bar. Icons must not compete with pending spinners or tap targets.

## Official Homey assets only when documented

**Choice:** Milestone 8 uses lightweight inline SVG fallbacks. Homey Web API exposes `Device.icon` / `iconObj`, but there is no documented auth-free URL suitable for tiles served by this app’s LAN HTTP server.

**Why:** Do not reverse-engineer Homey asset paths or scrape proprietary icons. If Homey documents a safe public icon URL later, it can replace the fallback without changing widget contracts.

## Shared Device Widget visual language

**Choice:** LightWidget and CoverWidget share CSS tokens/classes and the icon helper, but remain separate widget definitions/renderers.

**Why:** Consistency without a mega-class that would couple every device type’s lifecycle.

## Capability-keyed subscriptions

**Choice:** `RealtimeSubscriptionManager` keys listeners by `(deviceId, capabilityId)` instead of device id alone.

**Why:** CoverWidget needs `windowcoverings_set` while LightWidget needs `onoff`. Same manager, no duplicate infrastructure. Milestone 9 may also subscribe `windowcoverings_state` when present.

---

Architectural choices for Milestone 7. Earlier decisions remain in force below and in prior milestone docs.

## Commands use widget intents

**Choice:** The client sends `{ type: 'widget-action', widgetId, action, requestId }` (plus action-specific fields such as `positionPercent`). It never sends Homey `deviceId`, capability id, or raw Homey values.

**Why:** A wall browser must not be able to command arbitrary Homey devices. The backend resolves `widgetId` against the Display’s current dashboard configuration and allowed actions.

## Homey confirms final state

**Choice:** Visual success is only applied when Homey realtime delivers a matching capability update. `command-accepted` means “validated and sent to Homey”, not “device confirmed”. Milestone 9 adds `command-succeeded` when confirmation matches.

**Why:** Homey remains source of truth. API acceptance and WebSocket send success are not sufficient.

**API used:** `Device#setCapabilityValue({ capabilityId, value })` via `homey-api` / `HomeyAPI.createAppAPI`.

**Refs:** [Device#setCapabilityValue](https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#setCapabilityValue), [Device#makeCapabilityInstance](https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#makeCapabilityInstance).

## Pending is separate from real state

**Choice:** LightWidget keeps painting the last Homey-confirmed ON/OFF and overlays pending/error feedback. CoverWidget keeps painting Homey-confirmed percent and shows target/pending separately in the panel.

**Why:** Optimistic UI would lie about device state on slow or failed devices. Pending is a command lifecycle state, not a capability value.

## No concurrent commands per widget

**Choice:** While a widget is pending, further taps are ignored. The backend also rejects `already_pending`. Milestone 9 allows cover **stop** to replace an in-flight set-position.

**Why:** Prevents toggle races and duplicate Homey writes without introducing a command queue. Stop is the intentional interrupt.

## No offline command queue

**Choice:** Socket loss clears pending on both sides. Reconnect uses a full snapshot. Commands are not buffered or replayed.

**Why:** Avoids unbounded queues and surprising delayed toggles after reconnection.

## Interaction architecture is extensible

**Choice:** `WidgetDefinition.interactions` maps gestures (`tap` | `double-tap` | `long-press` | `swipe`) to action ids. Milestone 7 implements `tap → toggle` for LightWidget. Milestone 9 uses tile tap to open the cover overlay; panel actions map to `set-position` / `stop`. Milestone 10 implements `long-press → open-control` for LightWidget with panel intents `set-dim` / `set-temperature` / `set-color`.

**Why:** Future gestures should not require rewriting the WebSocket envelope or the interaction controller.

## Command timeout is fixed at 4000 ms

**Choice (M7):** `COMMAND_TIMEOUT_MS = 4000` for light toggle. Not user-configurable.

**Status:** Still true for light toggle / dim / temperature / color and cover stop. Milestone 9 adds cover `set-position` = **8000 ms**. See `COMMAND_TIMEOUTS` in `lib/realtime/constants.ts`.

**Why:** Fast enough for wall UX, long enough for typical Homey/device round-trips. Cover set-position needs a slightly longer ack window without waiting for full travel.

## Realtime mismatch clears pending

**Choice:** If Homey reports a value inconsistent with the pending intent, adopt Homey’s value, clear pending, send `command-rejected` with `unexpected_state`, and do not retry.

**Why:** Deterministic; Homey always wins; avoids leaving the UI stuck in pending when another actor changed the device.

## Toggle target is server-derived

**Choice:** For light toggle, backend reads current Homey `onoff` and sets the opposite. The client cannot impose the target.

**Why:** Prevents stale-client desync and forged capability values. Cover `set-position` is different: the client sends a validated UX percent; the backend denormalizes to Homey `[0, 1]`.

---

Architectural choices for Milestone 6. Earlier decisions remain in force below and in prior milestone docs.

## WebSocket over SSE

**Choice:** WebSocket on the shared HTTP port (`/realtime`), not SSE.

**Why:** Later milestones need bidirectional messages (display → Homey commands). WebSocket is the lightest official Node pattern that already supports that without Socket.IO overhead.

**Library:** `ws@8.18.3` (~192 KiB on disk). Node 22’s built-in WebSocket is client-oriented; `ws` is the standard server upgrade path and is already a transitive dependency of `homey-api` / `engine.io-client`. Declaring it directly keeps the version explicit.

**Refs:** [ws documentation](https://github.com/websockets/ws), [Node http upgrade](https://nodejs.org/api/http.html#event-upgrade).

## Shared HTTP/WebSocket port

**Choice:** One configurable TCP port (default `7999`) for both HTTP and WebSocket upgrades.

**Why:** Wall displays already know one URL; Homey App Settings already configure one port; no second firewall hole.

## One socket per DisplaySession

**Choice:** Each WebSocket is bound to exactly one Display via IP recognition → `DisplayRegistry` → `DisplayRealtimeSession`.

**Why:** Prevents anonymous global Homey event fans-out and keeps trust local to the paired Display.

## Newest connection wins

**Choice:** If the same Display opens a second WebSocket, the previous session is closed.

**Why:** Deterministic single-session semantics for online/offline and subscription ownership.

## Selective subscriptions

**Choice:** Only Homey devices referenced by the Display’s dashboard widgets are subscribed (`extractReferencedDeviceIds` / capability pairs).

**Why:** Homey Pro RAM and listener budget; never subscribe to the whole device list.

## Reference-counted subscriptions

**Choice:** `RealtimeSubscriptionManager` shares one Homey `makeCapabilityInstance` across Displays that reference the same device+capability; unsubscribe at `refCount === 0`.

**Why:** Avoid duplicate Homey realtime listeners when multiple wall displays show the same device.

**Refs:** [Device#makeCapabilityInstance](https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.html#makeCapabilityInstance), [DeviceCapability#destroy](https://athombv.github.io/node-homey-api/HomeyAPIV3.ManagerDevices.Device.DeviceCapability.html).

## Full snapshot after reconnect

**Choice:** After reconnect, send a complete `dashboard-snapshot`. No event replay / catch-up queue.

**Why:** Simpler consistency; offline gaps are corrected atomically; no unbounded buffers.

## Full configuration updates

**Choice:** Structural dashboard edits are sent as a complete `dashboard-configuration` (plus fresh widget runtime states), not incremental widget-added/moved/deleted events.

**Why:** Deterministic `applyConfiguration()` on the client; avoids intermediate mixed layouts.

## Targeted runtime updates

**Choice:** Capability changes use `widget-state` messages for the affected widget only.

**Why:** Bandwidth and render cost stay low as device counts grow.

## Connection overlay

**Choice:** Lost connection is a global overlay (not a grid cell). Overlay is removed only after a valid snapshot is applied — not merely when the socket opens.

**Why:** Clear UX; prevents showing stale widgets as “live” before sync completes.

## Online status from realtime sessions

**Choice:** Display online/offline is derived from an active WebSocket session, not from the previous 5-minute HTTP lastSeen window.

**Why:** Heartbeat + session lifecycle are a stronger liveness signal for wall displays that stay open.

## Local trust model

**Choice:** LAN-only; clients must match a configured Display IP. No cloud auth in this milestone. Displays cannot receive another Display’s config.

**Why:** Matches Homey Pro local deployment; auth can be layered later without rewriting the protocol.

## Config save order

**Choice:** validate → persist Device Store → update registry → diff subscriptions → push complete config to connected sessions.

**Why:** Homey remains source of truth before any push; offline Displays are unaffected until reconnect snapshot.

---

Architectural choices for Milestone 5. Earlier decisions remain in force below and in prior milestone docs.

## Homey Device Repository

**Choice:** All access to Homey devices and zones is centralized in `HomeyDeviceRepository`, backed by the official `homey-api` client created with `HomeyAPI.createAppAPI({ homey })`.

**Why:** The frontend must not call Homey. A single backend layer normalizes id, name, zone, availability, and capability values, and can be mocked in tests.

**Permission:** `homey:manager:api` is required. It grants ManagerApi / Homey Web API access so this app can read devices that it does not own. Implications: stricter App Store review, not allowed on Homey Cloud (this app is already `platforms: ["local"]`), and the app is in the Tools category as Homey recommends for this permission. No other permissions are requested.

**APIs used:** `homey.api.getOwnerApiToken()`, `homey.api.getLocalUrl()`, `homey.cloud.getHomeyId()` (inside `createAppAPI`); then `devices.getDevices()`, `devices.getDevice({ id })`, `zones.getZones()`, `Device#makeCapabilityInstance` / `DeviceCapability#destroy` for selective realtime, and (from Milestone 7+) `Device#setCapabilityValue` for widget commands.

**Package:** `homey-api@3.16.1` — last stable line that supports Node `>=16`. `3.17+` requires Node 24, which is incompatible with Homey `>=12.9.0` (Node 22).

**Refs:** [Permissions](https://apps.developer.homey.app/the-basics/app/permissions), [HomeyAPI.createAppAPI](https://athombv.github.io/node-homey-api/HomeyAPI.html), [Device](https://athombv.github.io/node-homey-api/HomeyAPIV3Local.ManagerDevices.Device.html), [ManagerApi](https://apps-sdk-v3.developer.homey.app/ManagerApi.html).

## Widgets store references, not copies

**Choice:** LightWidget persists only `{ deviceId }`.

**Why:** Name, zone, availability, and on/off must not drift from Homey. A rename in Homey appears after the next dashboard refresh without reconfiguring the widget.

## Homey remains source of truth

**Choice:** Every dashboard load and every editor open re-reads devices and zones from Homey. There is no long-lived device cache.

**Why:** Homey is the only authoritative store for device identity and state. The dashboard holds a snapshot, not a replica.

## Read-only first

**Superseded by Milestone 7 / 10:** LightWidget can toggle `onoff` and, via LightControlPanel, set dim / temperature / color through validated widget intents. Cover control arrived in Milestone 9.

## Snapshot plus realtime

**Choice:** Homey state is still snapshotted at HTTP bootstrap and after every WebSocket connect. Live capability updates use official capability instances; `DashboardRenderer.updateWidgetState` applies them without rebuilding the grid.

**Why:** Snapshot remains the reconnect source of truth; realtime patches keep the open display current without polling.

## Broken references remain visible

**Choice:** If the bound device is removed, unreachable, unavailable, or no longer exposes the required capability, the widget stays on the grid in the `unavailable` visual state. The stored `deviceId` is never auto-replaced or deleted.

**Why:** The user must see that the configuration still exists. Correction is explicit in the Dashboard Editor.

## Homey-inspired visual language

**Choice:** LightWidget is a simple rounded tile with a clear ON/OFF/unavailable hierarchy. CSS classes `widget-light--state-on|off|unavailable|pending|error` are derived from visual + command status. No proprietary Homey assets or undocumented internals are copied.

**Why:** The tile should feel at home next to Homey without pixel-perfect cloning.

## Server-side light compatibility

**Choice:** A device is LightWidget-compatible when it has capability `onoff`. Filtering happens in the repository. The editor receives `{ id, name, zoneName }[]` only.

**Why:** The settings UI should not know Homey capability objects. Dim/color are not required now, but the same `deviceId` can gain those later.

---

Architectural choices for Milestone 4. Earlier decisions remain in force below and in prior milestone docs.

## App Settings for dashboard editing

**Choice:** The visual dashboard editor is a Custom App Settings page (`settings/index.html` + compiled `settings/editor.js`) using Homey Style Library classes and `Homey.api` against the app Web API.

**Why:** Official Homey Pro surface for complex configuration. No external UI, no parallel configurator outside Homey.

**Widget editor dialog:** Homey Settings expose `Homey.alert` / `Homey.confirm` (message dialogs) and `Homey.popup(url)` (new window). There is no official in-view modal for custom forms, so the dashboard editor uses an in-page dialog overlay with Homey form classes (`homey-form-select`, `homey-form-input`). Preview and widget list appear only after a display is selected, inside that dialog. Add/edit uses the same dialog (preview stays visible) with Apply, Cancel, and Remove. Remove always asks for confirmation via `Homey.confirm` when available.

**Refs:** [App Settings](https://apps.developer.homey.app/advanced/custom-views/app-settings), [HTML/CSS styling](https://apps.developer.homey.app/advanced/custom-views/html-and-css-styling), [Web API](https://apps.developer.homey.app/advanced/web-api).

## Device configuration remains per-device

**Choice:** Widget configuration is stored on each Homey Device via Device Store key `dashboard`.

**Why:** Each Wall Display has its own layout and widgets. Homey remains the only source of truth.

**Refs:** [Device Store / persistent storage](https://apps.developer.homey.app/the-basics/app/persistent-storage), [Devices](https://apps.developer.homey.app/the-basics/devices).

## Explicit placement

**Choice:** Every widget has an explicit `WidgetPlacement` (`row`, `column`, `rowSpan`, `columnSpan`). Top-left origin; spans extend right and down.

**Why:** Deterministic layout, simple validation, no ambiguity for multi-cell widgets.

## No automatic collision resolution

**Choice:** Overlaps and out-of-bounds placements are rejected. The system never auto-moves widgets.

**Why:** Explicit placement keeps configuration predictable and reviewable.

## Widget Registry

**Choice:** Widget types register through a central `WidgetRegistry` (definitions) plus a frontend renderer registry. The dashboard renderer does not switch on `widget.type` with large `if` chains.

**Why:** Adding a widget should be a registration + folder, not a rewrite of the engine.

## Widget isolation

**Choice:** Each widget lives in its own folder (`lib/widgets/<type>` for shared contracts; `frontend/widgets/<type>` for DOM/CSS).

**Why:** Keeps CSS and logic separated so later visual polish can target one widget at a time.

## Internal layout per span

**Choice:** Widgets declare allowed spans and use span-specific CSS classes (`widget-layout-1x1`, `2x1`, `3x1`, …). Internal layout may differ by span.

**Why:** Predisposes architecture for richer variants without changing the grid contract.

## Per-widget chrome

**Choice:** Title and Date & Time widgets accept optional `chrome`: `plain` (no border/background, default) or `card` (border + background). Missing `chrome` is treated as `plain`.

**Why:** The screenshot look is borderless, but some layouts still want a framed card. The choice is per widget, not global.

## Dashboard dark / light theme

**Choice:** `theme` (`dark` | `light`) is a **per-display dashboard** setting. Widgets have no theme of their own: they inherit CSS tokens (`--widget-fg`, `--widget-card-surface`, …) from the dashboard `data-theme`. Default is `dark`. Missing `theme` is treated as `dark`.

**Why:** Each Wall Display is an independent Homey device. Background, text, and widget chrome colors must stay consistent on that screen. Per-widget themes would break contrast.

## Reload-only configuration for now

**Superseded by Milestone 6:** connected Displays receive live `dashboard-configuration` pushes. Offline Displays still pick up changes on the next full snapshot after reconnect.

## Device Settings note only

**Choice:** Device Advanced Settings show a read-only `label` pointing users to App Settings for grid/widgets. No widget editor in Device Settings.

**Why:** Matches Homey UX expectations and keeps one editor surface.

**Refs:** [Device settings](https://apps.developer.homey.app/the-basics/devices/settings).

---

## Milestone 3 decisions still in force

### Vanilla frontend

HTML + CSS + TypeScript only. `esbuild` is **devDependency** only.

### Square grid cells / centered grid / proportional gap / fixed safety margin

Unchanged.

### Layout immutable after initial render (geometry)

Geometry still calculated once per `applyConfiguration` call; no permanent resize listeners.

### DashboardBootstrap DTO

Extended with `widgets` + `locale`; still no Homey APIs in the browser.

### Portrait and landscape layout ids

Unchanged.

### Process memory on diagnostics

Unchanged (`process.memoryUsage()`).

---

## Milestone 2 decisions still in force

Homey is Source of Truth; runtime state is not persisted; separate drivers; IP is routing; Shelly hardware validation; diagnostics permanent; online timeout 5 minutes; pairing modes per driver.

## Milestone 1 decisions still in force

Homey Compose; custom pairing; `Homey.createDevice`; native device settings; class `other`; adapter isolation; EN+IT; TypeScript strict, no `any`.
