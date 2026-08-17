# TODO

## Milestone 12 follow-up (optional, not blocking)

- [ ] Homey Pro: **Show interactive notification** with auto-open + auto-close 15s + action `open-gate`
- [ ] Confirm CTA tap starts the WHEN card (same Action ID) and leaves loading (Action sent / Action failed, never infinite)
- [ ] Confirm existing **Show notification** Flows still run unchanged
- [ ] Second Flow: WHEN notification action pressed, Action ID = same `open-gate` string as the THEN card
- [ ] Verify CTA pending, Action sent feedback, Center stays open, ribbon after auto-close
- [ ] Verify pre-M12 Flows still run without re-saving cards
- [ ] Measure RSS/heap on Homey Pro via `/diagnostics` during show → auto-close → action cycles

## Milestone 11B follow-up (optional, not blocking)

- [ ] Create Homey Flow on Homey Pro: Display → Show notification (`test-info`) and verify ribbon + Center
- [ ] Upsert same key with severity `warning` / highlight; confirm no duplicate
- [ ] Remove by key + Remove all; confirm other Display unchanged
- [ ] Offline Display: publish via Flow, reconnect, snapshot shows notification
- [ ] Dismiss locally → Flow upsert re-surfaces; Flow remove + show restores visibility
- [ ] Confirm `notification_count` / `highest_notification_severity` on device after Flow ops (dismiss does not change them)
- [ ] If Homey CLI compose rewrites `app.json`, commit the generated file as-is

## Milestone 11 follow-up (optional, not blocking)

- [ ] Exercise Notification Center on Homey Pro with two Wall Displays (shared notification + local dismiss)
- [ ] Confirm highlight pulse and `prefers-reduced-motion` on Shelly Wall Display browser
- [ ] Measure RSS/heap on Homey Pro via `/diagnostics` with several active notifications

## Next milestone (do not start here)

Only when a later milestone is requested:

- [ ] Optional global Flow: show notification on all Displays
- [ ] Additional widget types (sensors, thermostats)
- [ ] Drag & drop editor enhancements (still Homey App Settings only)
- [ ] Shelly authenticated RPC if probe fails with 401
- [ ] Shelly hardware controls (reboot, brightness, volume) via official APIs only
