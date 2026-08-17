# Generic Web Display

The **Generic Web Display** driver is for any compatible web browser or tablet that should act as a LocalDashboard screen — without Shelly-specific hardware integration.

## Intended use

- Wall-mounted Android/iOS tablets in kiosk mode
- Spare phones or small PCs with a browser
- Any device that can open `http://<HOMEY_LAN_IP>:7999/` full-screen

## Pairing flow

Pairing is **browser-first**, then **Homey**:

```text
1. Browser (unknown IP) opens http://HOMEY:7999/
        ↓
2. Pairing page shows 6-digit code (valid ~8 minutes)
        ↓
3. Homey → Add device → Generic Web Display → enter code
        ↓
4. Homey shows detected IP → user confirms
        ↓
5. Device created; browser refreshes → dashboard
```

### Properties of the pairing code

| Property | Behavior |
| --- | --- |
| **Length** | 6 digits |
| **Lifetime** | 8 minutes |
| **Storage** | Runtime RAM only — lost on app restart |
| **Purpose** | Temporary correlation between browser IP and Homey pairing UI |
| **Reuse** | Consumed after successful pairing; same IP gets a new code if needed |

The code is **not** stored on the Display device and is **not** a long-term credential.

## IP-based recognition (no browser storage)

After pairing, LocalDashboard recognizes the Display by **configured IPv4** (`settings.ip`):

- **No** cookies, localStorage, or browser UUID
- Clearing browser cache/cookies **does not** break recognition (same IP → same dashboard)
- If the tablet gets a **new IP** (DHCP change, VLAN move), update **`settings.ip`** in Homey or re-pair

The Homey device **`data.id`** is a **UUID generated at pairing** — it is not the IP address.

## Pairing code expiry

If the code expires before Homey pairing completes:

- Entering the old code in Homey fails
- Refresh the browser page to generate a new code

The pairing page checks expiry periodically and may reload to refresh the code.

## Supported grid layouts

| Layout id | Grid | Label in settings |
| --- | --- | --- |
| `2x4` | 2 × 4 | Portrait |
| `4x2` | 4 × 2 | Landscape |
| `3x6` | 3 × 6 | Portrait |
| `6x3` | 6 × 3 | Landscape |

Portrait/landscape pairs share the same cell count but swap columns and rows for different physical orientations.

## Browser capability reporting

When connected over WebSocket, a Generic display may send **`generic-client-hello`** with runtime metadata (viewport size, user agent, touch support, etc.).

Important:

- Capabilities are stored in **RAM** for diagnostics
- They do **not** change dashboard layout automatically
- Layout remains what you configure in Homey

View reported capabilities in `/diagnostics` under **Generic browser profiles**.

## Pairing WebSocket

Unknown IPs may open a limited WebSocket before pairing completes — only for pairing completion notification and client hello. Privileged widget commands and notification actions are **rejected** until the Display is paired and recognized.

## Comparison with Shelly

See the full table in [Displays](displays.md). Generic displays have **no** Shelly RPC discovery or reboot Flow.

## Common scenarios

### Same tablet, cleared browser data

Still works — IP unchanged, Homey device unchanged.

### Tablet moved to another room (new IP)

Browser shows pairing page again. Either update `settings.ip` in Homey to the new address or complete pairing with a new code.

### App restarted on Homey

Pending pairing codes are cleared. Refresh browser for a new code if still unpaired. **Paired** devices and dashboard config persist.

## Troubleshooting

See [Troubleshooting — Generic browser asks to pair again](troubleshooting.md#generic-browser-shows-pairing-again).
