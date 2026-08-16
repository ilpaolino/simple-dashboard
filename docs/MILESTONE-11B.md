# Milestone 11B — Native Homey Flow Integration for Notifications

**Status:** Done.

## Summary

Incremental Homey Flow integration on top of Milestone 11. The Notification Center, carousel, dismiss, highlight, and realtime frontend were **not** rewritten.

Added:

- Device-scoped Flow Action Cards (shared for Shelly + Generic via app-level cards + `driver_id` filter)
- `notificationKey` upsert semantics (`displayId + key`)
- Remove by key (idempotent) and remove-all for one Display
- Optional read-only aggregate capabilities: `notification_count`, `highest_notification_severity`

## Flow cards

| Driver | IDs | EN / IT title |
| --- | --- | --- |
| Generic Web Display | `show_notification`, `remove_notification`, `remove_all_notifications` | Show / Remove / Remove all |
| Shelly Wall Display | `shelly_show_notification`, `shelly_remove_notification`, `shelly_remove_all_notifications` | Same titles (Homey requires unique IDs per app) |

Defined in each driver’s `driver.flow.compose.json` (Homey Compose injects `device` + `driver_id` filter). This makes the cards appear **under the selected Wall Display** in Flow, including `class: other` devices.

Registered once in `app.onInit` via `registerNotificationFlowCards` (shared run listeners).

## Notification Key

- Trimmed, 1–64 chars
- Pattern: `[A-Za-z0-9._-]+`
- Uniqueness: `displayId + notificationKey`
- Internal notification `id` (UUID) unchanged for frontend / dismiss tracking

## Upsert

`NotificationManager.upsertForDisplay(...)`:

- existing key → `updateNotification` (same id → local dismiss retained)
- new key → `publishNotification` + key index

## Capabilities (state only)

| Capability | Type | Semantics |
| --- | --- | --- |
| `notification_count` | number, getable | Active SoT count (ignores local dismiss) |
| `highest_notification_severity` | enum, getable | `none\|info\|success\|warning\|critical` (SoT) |

Not used as command transport. Updated on add/update/remove (not on dismiss).

## Official Homey references

- [Flow](https://apps.developer.homey.app/the-basics/flow)
- [Flow arguments](https://apps.developer.homey.app/the-basics/flow/arguments) (`required: false` for optional title/icon)
- [Device cards](https://apps.developer.homey.app/the-basics/flow#device-cards)
- [Custom capabilities](https://apps.developer.homey.app/the-basics/devices/capabilities)
- [`ManagerFlow#getActionCard`](https://apps-sdk-v3.developer.homey.app/ManagerFlow.html#getActionCard)
- [`Device#addCapability`](https://apps-sdk-v3.developer.homey.app/Device.html#addCapability) / [`setCapabilityValue`](https://apps-sdk-v3.developer.homey.app/Device.html#setCapabilityValue)

## Frontend performance

No frontend delta vs Milestone 11 (JS ~78.3 KiB / ~80.2 KiB uncompressed measure; CSS ~32 KiB). Backend-only Flow + capability wiring. Zero new runtime npm packages (`homey-api`, `source-map-support`, `ws` unchanged).

Homey validate: `npx homey app build` succeeds with 3 Flow actions + 2 custom capabilities.

## Manual checklist

- [x] build / typecheck / lint / tests (automated)
- [ ] Flow Show / Remove / Remove All on Shelly + Generic (Homey Pro)
- [ ] upsert same key; severity realtime; offline → reconnect snapshot
- [ ] dismiss vs Flow remove semantics
- [ ] capability aggregates ignore dismiss; update on Flow remove
- [ ] IT/EN Flow strings; diagnostics Flow counters
