# Milestones

## Milestone 0 — Local HTTP server PoC

**Status:** Done. Details: [MILESTONE-0.md](MILESTONE-0.md).

## Milestone 1 — Wall Display device, pairing, native Homey integration

**Status:** Done (superseded driver layout by M2). Details: [MILESTONE-1.md](MILESTONE-1.md).

## Milestone 2 — Display Registry, Device Recognition & Diagnostics

**Status:** Done. Details: [MILESTONE-2.md](MILESTONE-2.md).

## Milestone 3 — Vanilla Grid Rendering Engine

**Status:** Done. Details: [MILESTONE-3.md](MILESTONE-3.md).

### In scope (implemented)

- Layout from Homey Device Settings → `DisplayRegistry` → `DashboardBootstrap`
- Vanilla HTML/CSS/TypeScript frontend (no UI frameworks)
- Square cells, centered grid, fixed safety margin, proportional clamped gap
- Diagnostic cell labels with stable internal cell ids
- `GridPlacement` types for future spans (not rendered yet)
- Layout immutable after initial render
- Invalid layout + unconfigured display error pages (EN/IT)
- Diagnostics: layout, grid size, last rendered, layout error, process memory
- Automated geometry/span/handler tests + performance measurement script

### Out of scope (explicitly deferred)

- Real Homey widgets (lights, covers, thermostats, sensors, …)
- WebSocket / realtime
- Flow cards
- Overlays / popups / cameras
- Drag & drop / visual editor
- Multi-page dashboards
- Dynamic resize / orientation listeners
- Configurable safety margin

## Later milestones (not started)

- Widget model + Homey capability bindings
- Live updates
- Display hardware controls beyond recognition

## Manual test checklist (Milestone 3)

- [ ] Build completed (`npm run build`)
- [ ] TypeScript strict without errors (`npm run typecheck`)
- [ ] Lint completed (`npm run lint`)
- [ ] Automated tests completed (`npm test`)
- [ ] App started on Homey Pro (`homey app run --remote`)
- [ ] Shelly Wall Display recognized
- [ ] Grid 2×2 displayed
- [ ] Grid 3×3 displayed
- [ ] Cells are square
- [ ] Gap is uniform
- [ ] Grid is centered
- [ ] Safety margin present
- [ ] No overflow
- [ ] No dynamic resize (reload required after orientation change)
- [ ] Generic Display with vertical layout (2×4 / 3×6)
- [ ] Generic Display with horizontal layout (4×2 / 6×3)
- [ ] Invalid configuration handled
- [ ] Unknown display handled
- [ ] Diagnostics updated
- [ ] Italian UI
- [ ] English UI
- [ ] Bundle size documented
- [ ] RAM observed/documented via diagnostics (`process.memoryUsage`)
