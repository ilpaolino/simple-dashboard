# Troubleshooting

Symptom-oriented guide for LocalDashboard v1. Enable [diagnostics](diagnostics.md) when debugging connectivity.

---

## “Display not configured” / “Display non configurato”

**Meaning:** No Homey Display device matches the browser’s source IP.

| Check | Action |
| --- | --- |
| Pairing incomplete | Finish Homey add-device flow |
| Generic code expired | Refresh browser; enter new code in Homey |
| Wrong IP in settings | Device Advanced settings → update **IP address** |
| DHCP changed tablet IP | Update IP or reserve DHCP in router |
| Wrong Homey hub IP in URL | Use Homey LAN IP in `http://…:7999/` |

Generic: [Generic Web Display](generic-web-display.md)  
Shelly mismatch: [Shelly Wall Display](shelly-wall-display.md)

---

## Dashboard does not load (blank / error)

| Check | Action |
| --- | --- |
| App running on Homey Pro | Not Docker-only `homey app run` without `--remote` |
| Port | App Settings → HTTP port; URL must match |
| LAN | Display and Homey same network |
| Invalid layout | Device settings → supported layout for driver type |
| Firewall | Allow TCP port 7999 on Homey |

---

## Connection lost overlay

**Meaning:** WebSocket `/realtime` disconnected or snapshot not yet applied.

| Check | Action |
| --- | --- |
| Wi-Fi sleep on tablet | Disable sleep / keep awake |
| Homey app restarted | Wait for reconnect (exponential backoff up to 30 s) |
| Port changed | Reload page after App Settings save |
| Duplicate tab | Newest connection wins — close extra tabs |

Overlay clears only after a **valid snapshot** is applied, not merely when socket opens.

---

## Widget unavailable

| Cause | What you see |
| --- | --- |
| Homey device offline | Unavailable tile; name may still show |
| Device deleted in Homey | Unavailable; widget **not** auto-removed |
| Missing capability | Light without `onoff`, cover without `windowcoverings_set` |
| Wrong device id in config | Unavailable until rebound in editor |

Fix in **Dashboard Editor** or restore Homey device.

---

## Light tap does nothing

| Check | Action |
| --- | --- |
| Pending command | Wait for timeout (~4 s) or Homey confirm |
| Widget unavailable | See above |
| Second tap while pending | Ignored by design |
| Command rejected | Check diagnostics recent commands |
| WebSocket down | Connection overlay |

Homey must confirm ON/OFF — not instant optimistic UI.

---

## Cover Stop button missing

**Expected** if Homey device has no **`windowcoverings_state`** capability. Position control may still work via `windowcoverings_set`.

---

## Notification not appearing

| Check | Action |
| --- | --- |
| Flow targets correct Display device | Device picker in THEN card |
| Display online | Diagnostics → WebSocket session |
| Locally dismissed | Flow **Show** same key clears dismiss on upsert |
| Wrong Notification Key in remove | Key is case-sensitive after trim |
| 32 notification limit | Remove old notifications |

---

## Notification button does nothing

See [Notification actions](notification-actions.md).

| Check | Action |
| --- | --- |
| Action ID typo | Must match exactly between SHOW and WHEN |
| Missing WHEN Flow | Add trigger on same Display |
| Interactive card used | Simple Show has no button |
| 8 s timeout | Diagnostics; Homey Flow errors |

---

## Camera image unavailable

| Check | Action |
| --- | --- |
| Camera device offline in Homey | Homey app |
| No image capability | Many cameras expose RTSP only — fallback may be limited |
| Video-only camera | May show unavailable or fallback |
| Center closed | Media stops — not an error |
| Diagnostics media sessions | Should be 0 when closed |

See [Camera media](camera-media.md).

---

## Generic browser shows pairing again

| Cause | Fix |
| --- | --- |
| IP changed | Update `settings.ip` |
| Never paired | Complete Homey pairing |
| App restarted during pairing | New code on refresh |
| Wrong device deleted | Re-pair Generic device |

Clearing cookies **does not** cause this alone if IP unchanged.

---

## Shelly reboot unavailable in Flow

| Status in diagnostics | Meaning |
| --- | --- |
| **Unknown** | Discovery failed or device offline — fix network first |
| **Unsupported** | Firmware/model lacks `Shelly.Reboot` in ListMethods |
| **Supported** | Reboot Flow should appear |

Use Maintenance → **Detect hardware capabilities again**.

---

## Port already in use

App Settings → choose another port (e.g. 8099) → Save. Server restarts. Update bookmarks on Displays.

Privileged ports **&lt; 1024** may fail on Homey.

---

## Homey CLI validate EPERM

Some dev machines hit `EPERM` cleaning `.homeybuild/node_modules/.../.idea/`. Compose may still update `app.json`. Remove stray IDE folders or run validate on another machine.

---

## Still stuck?

1. Capture `/diagnostics` (with diagnostics enabled).
2. Note Display type, IP, online status, recent errors.
3. Compare with [Limitations](limitations.md) — may be by design.
