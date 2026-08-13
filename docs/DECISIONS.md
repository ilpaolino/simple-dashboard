# Decisions

Architectural choices for Milestone 3. Earlier decisions remain in force below and in [MILESTONE-0.md](MILESTONE-0.md) / [MILESTONE-1.md](MILESTONE-1.md) / [MILESTONE-2.md](MILESTONE-2.md).

## Vanilla frontend

**Choice:** Dashboard UI is HTML + CSS + TypeScript only. No Vue, React, Angular, Svelte, or UI component libraries. Source lives in `frontend/`; build emits a single IIFE `assets/dashboard/dashboard.js` plus `dashboard.css`.

**Why:** Wall displays (especially Shelly Wall Display WebViews) benefit from a tiny bundle, low RAM, fast startup, and minimal dependencies. Framework convenience is explicitly out of scope.

**Build note:** `esbuild` is a **devDependency** only (bundle `frontend/main.ts` + shared `lib/dashboard` math into one browser file). It is not shipped to Homey (`.homeyignore` excludes `node_modules/` and `scripts/`).

## Square grid cells

**Choice:** Every cell is always square. The engine never stretches cells to fill the viewport.

**Why:** Predictable geometry for future widgets and consistent touch targets across aspect ratios.

## Centered grid

**Choice:** After computing the maximum fitting square cell size, the grid is centered horizontally and vertically within the safe area. Unused space remains empty.

**Why:** Prefer geometric predictability over using 100% of the screen.

## Proportional gap

**Choice:** `gap = clamp(cellSize × 0.08, 4px, 20px)`.

**Why:** Gaps stay visible on small displays and do not explode on large ones. Limits are fixed constants for this milestone.

## Fixed safety margin

**Choice:** Outer margin is a centralized constant (`SAFETY_MARGIN_PX = 12`). Not configurable via Homey settings yet.

**Why:** Avoids edge clipping on embedded browsers / viewport differences without adding settings surface area.

## Layout immutable after initial render

**Choice:** Geometry is calculated once on page load. No permanent `resize` or `orientationchange` listeners. Orientation/viewport changes require a page reload.

**Why:** Lower runtime complexity and CPU/RAM on fixed wall mounts; predictable layout for debugging.

## Widget span compatibility

**Choice:** Data model includes `GridPlacement` with `rowSpan` / `columnSpan`. Milestone 3 does not render multi-cell widgets, but types and structural tests ensure 1×2 / 2×1 / 2×2 placements can fit later without rewriting the engine contracts.

**Why:** Avoid a future rewrite of cell identity and layout math when widgets arrive.

## DashboardBootstrap DTO

**Choice:** Backend sends only `displayId` + `{ rows, columns }`. No Homey APIs, device names, or adapter details in the frontend payload.

**Why:** Clear backend/frontend separation; minimal attack/data surface on the LAN page.

## Portrait and landscape layout ids

**Choice:** Layout ids are `{columns}x{rows}`. Non-square grids ship both orientations (`2x4` / `4x2`, `3x6` / `6x3`). Square grids (`2x2`, `3x3`) are orientation-invariant, so they are not duplicated. Orientation is chosen in Homey Device Settings; the dashboard does not auto-rotate.

**Why:** Wall displays may be mounted portrait or landscape. The grid engine already sizes square cells to the viewport; the user still needs an explicit column/row count that matches the mount.

**Migration:** Generic devices paired before landscape variants existed store only `2x4` / `3x6`. On device `onInit` (and when saving a layout) the stored `supportedLayoutIds` is expanded so the new options are selectable without re-pairing.

## Process memory on diagnostics

**Choice:** `/diagnostics` shows Node `process.memoryUsage()` RSS and heapUsed. Homey Apps SDK does not expose a dedicated “app RAM” metric; this is the official Node API available in the Homey Node runtime.

**Why:** Milestone performance budget requires an honest, non-invented measurement path.

---

## Milestone 2 decisions still in force

### Homey is Source of Truth

`DisplayRegistry` is an in-memory projection of Homey Devices.

### Runtime state is not persisted

`lastSeenAt`, sessions, match status, `lastRenderedAt`, layout errors live only in RAM.

### Separate Homey Drivers

`shelly_wall_display` and `generic_web_display`.

### IP is routing, not identity

### Hardware identity validation (Shelly)

Official `GET /rpc/Shelly.GetDeviceInfo`.

### Diagnostics is a permanent feature

### Online timeout without heartbeat (5 minutes)

### Pairing modes per driver

---

## Milestone 1 decisions still in force

### Homey Compose for drivers

### Custom pairing: injected Homey, no `/homey.js`

### `Homey.createDevice` instead of `add_devices`

### Native device settings only

### Device class `other`, empty capabilities, `connectivity: lan`

### Adapter isolation / Shelly.GetDeviceInfo / configuration snapshot

### Localization EN + IT

### TypeScript strict, no `any`
