# Decisions

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

**Choice:** Saves update Device Store immediately; Wall Displays pick up changes on page refresh. `DashboardRenderer.applyConfiguration` exists so a future live channel can re-apply without rewrite.

**Why:** Milestone scope excludes WebSocket/SSE/polling while still preparing the renderer.

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
