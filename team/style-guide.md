# CalvyBots Dashboard Style Guide (v3)

## Design philosophy

- Charcoal-first dashboard with restrained accent and deliberate depth.
- Keep the interface fast to scan, fast to control, and easy to read in all zones.
- Use layered surfaces and muted shadows to create hierarchy, not harsh contrast.
- Keep motion calm and short; avoid dramatic transitions.

## Colour tokens

- `bg` (`#1c1c1c`) — page background
- `surface` (`#242424`) — major surfaces such as cards and header blocks
- `elevated` (`#2e2e2e`) — raised controls, pills, utility surfaces
- `border` (`#3d3d3d`) — separators and edge treatment
- `accent` (`#2dd4bf`) — cyan action/highlight color
- `text-1` (`#f0f0f0`) — primary text
- `text-2` (`#9a9a9a`) — secondary text
- `text-3` (`#5c5c5c`) — muted metadata
- `accent-active` (`#2dd4bf`) — all active/focus/hover links and controls

### Recent UI/token updates

- Purple/violet highlight tokens are no longer used for active UI states in touched surfaces; controls and focus affordances use `#2dd4bf`.
- Font stack remains default dark theme family and now explicitly aligns with the `Outfit` import and Tailwind `fontFamily.sans`.
- Notes and To-Do shells continue to rely on existing widget contracts (`render(container, widgetRow, dashboard)`) and do not render widget titles.

## Typography scale

- Headline (`h1`)
  - `1.5rem` to `1.875rem`
  - `font-weight: 600`
  - `line-height: 1.2`
- Section title (`.widget-title`)
  - `0.72rem`
  - `font-weight: 600`
  - `line-height: 1.1`
  - all caps with extra tracking
- Body (`p`, `div`, `li`, widget copy)
  - `1rem`
  - `font-weight: 400`
  - `line-height: 1.45`
- Caption/helper (`small`)
  - `0.75rem`
  - `line-height: 1.3`
  - use muted text tone

## Spacing

- Base unit: `4px`
- Keep dense spacing inside cards and generous section gaps outside.

## Depth model

- `body` uses low-contrast ambient gradients to avoid flatness.
- Cards use layered gradients, edge tint and soft lift.
- Hover actions use border-lightening + small lift.
- Use `rgba` accents for subtle depth accents, avoid heavy bloom.

## Header shell + home controls toolbar

### Current header/edit behavior

- Time/date is now a read-only readout in the header.
- Time displays as `HH:MM` in 24h format with no seconds.
- Date renders in smaller white text on the next line.
- The Edit/Done control is now placed in the tab row; the edit action bar (`.home-toolbar`) renders below the nav.

- Header is now minimal brand chrome: logo + live header clock/date readout in `header.site-header`; no inline editable title.
- `clockTime` uses the large cyan `.header-clock-time` display, and `clockDate` uses smaller white `.header-clock-date` beneath it.
- Edit controls are now in a dedicated toolbar below nav (`.home-toolbar` and `.home-toolbar-btn`) so action affordances are grouped and distinct from page navigation.
- Edit/Done uses `.nav-tab` styling in navigation and Add Widget uses `.btn-primary` (`.home-toolbar-btn.btn-primary`) in the edit action row.
- Edit-mode hint text is paired with the toolbar and references widget title fields for renaming.

## App shell navigation (Home / Tools / Debug)

- **Placement:** A compact **primary nav** sits above the edit controls row (`nav.app-nav`), full width, `surface` background and `border` bottom edge (same band as header chrome).
- **Tabs:** `button.nav-tab` — uppercase, tracked label (`~0.8rem`, `font-weight: 500`), inactive `text-2`, active `text-1` with a **2px bottom border** in `accent` (`#2dd4bf`). Hover/focus raises label to `text-1` without a filled pill background.
- **Semantics:** Tabs use `role="tablist"` / `role="tab"` with `aria-selected` and `tabindex` roving on the active tab only; each page panel uses `aria-hidden` when off-screen so assistive tech focuses the visible surface.
- **Keyboard:** Tab into the tablist, activate with **Space** or **Enter**; **Arrow keys** are not wired for roving (optional follow-up).
- Keep a dedicated **right-aligned** Debug tab (`ml-auto`) and place the Edit/Done tab/button immediately to the left of Debug.
- Edit mode uses `nav-tab` visual style and an adjacent content row (`.home-toolbar`) for secondary edit actions.

## Page transition (Home / Tools / Debug)

- **Mechanism:** A horizontal **track** (`.pages-track`, `width: 300%`) holds three **panels** (`.page-panel`, `width: 33.333%` each) inside a clipping **viewport** (`.pages-viewport`, `overflow: hidden`). Switching pages toggles a modifier class: **Home** → `transform: translateX(0)`; **Tools** → `transform: translateX(-33.333333%)`; **Debug** → `transform: translateX(-66.666667%)` (one panel per viewport width).
- **Motion:** `320ms` `cubic-bezier(0.4, 0, 0.2, 1)` on `transform` only — calm, not intrusive; no full document navigation or reload.
- **State:** Page choice is client-side only (`currentPage` on the Alpine root); each page owns its widget list and separate canonical `localStorage` keys (`launchpad_widgets`, `launchpad_tools_widgets`, `launchpad_tools_landing_widgets`) with transparent fallback to legacy `calvybots_*` keys during migration.

## Component patterns

- Card (`.dash-widget`): gradient fill, soft border, lift on hover.
- Primary button: gradient accent with strong contrast text.
- Soft button: dark neutral gradient + border.
- Inputs: dark background, high contrast focus outline.
- Widget shell: title and controls stay inside each widget.

## Header toolbar controls

- Header uses a dedicated action bar (`.home-toolbar`) directly under the tab row (visible only in edit mode).
- `Done` and `Add Widget` actions use shared shell control tokens:
  - Edit/Done uses `nav-tab` state in `nav.app-nav`; the toolbar contains add-widget controls only.
  - `.home-toolbar-btn.btn-primary` for Add Widget.
- Toolbar utilities use cyan (`#2dd4bf`) as the accent and preserve 42px minimum touch target behavior.
- Edit mode guidance text (`.edit-mode-hint`) should be in-band with toolbar controls and reflect current edit behavior.

## Interaction

- Hover: keep to short duration, subtle movement.
- Focus: visible `:focus-visible` and consistent contrast.
- Touch: minimum `42px` controls for mobile.
- Add-widget control now uses a keyboard-operable combobox/listbox pattern: open/close with Enter/Space/Arrow keys and close/return focus on Escape.

### Server sync (widgets)

- Widget layout and content sync to `/api/widgets` in the background; there is **no** header strip or other in-UI sync status.
- The app persists to `launchpad_*` keys locally and reads from legacy `calvybots_*` keys when no canonical payload exists; failures to reach the server are logged to the console (`console.error`), not shown as app chrome.

## Motion

- Default transition cap: `240ms`
- `ease-out` only
- Keep load states lightweight and deliberate.

## Accessibility requirements

- No duplicated widget titles.
- Icon-only controls require clear accessible names.
- All controls must have clear names and labels.
- Widget drag handles use accessible names (`aria-label`) and support keyboard reorder with arrow keys while in edit mode.

## Mobile web app bookmarking

- `manifest.json` present with:
  - `display: standalone`
  - `start_url`
  - `scope`
  - `theme_color`
  - `background_color`
  - `icons`
- `apple-mobile-web-app-capable` metadata should be available.
- Add safe-area padding in shell and layout containers using `env(safe-area-inset-*)` with non-safe-area fallbacks.

## Footer debug strip (widget sync state)

- The footer now displays a live sync debug strip inside the existing `x-data="launchpad"` shell.
- The strip surfaces:
  - last successful sync timestamp (GET and PUT),
  - current local sync state (`synced`, `pending`, `uploading`),
  - next outbound attempt countdown (`debounced` countdown vs periodic retry interval),
  - last outbound outcome (`success`, `queued`, `failed`, `skipped`),
  - retrieve policy as explicit `bootstrap-only / not currently polling` text.
- Visual treatment uses the existing cyan token family on dark UI surfaces and adds no new purple/violet active accents.
- Debug strip is only rendered when `currentPage === 'debug'`.

## To-Do widget (v4)

Align implementation with `js/widgets/todo.js`, `js/store.js`, and `css/style.css`.

### Data model

- Per-task fields in `todoState.tasks[]`: `id`, `text`, `done`, optional `color`.
- **`color`:** stored on each task; **`null` / empty / “none”** means “no accent” — the row uses the default border colour (`border` token `#3d3d3d`). Other values are normalised in `normalizeTodoTaskColor()`; legacy hexes from earlier pickers remain accepted for migration.
- **`TODO_TASK_PALETTE`** (9 swatches, 3×3 row-major in UI): Cyan `#2dd4bf`, Blue `#3b82f6`, Green `#22c55e`, Red `#ef4444`, **None** (centre), Purple `#a855f7`, Pink `#ec4899`, White `#f0f0f0`, Orange `#f97316`.

### Edit mode

- Shows recurrence block (`never` / `daily` / `weekly`), local time, weekday when weekly.
- “New task” row always available.
- Task row: compact **done** toggle (✓ / ◯, touch-safe) + text input; left **colour bar** opens fixed-position 3×3 palette; **drag handle** (`≡`) for reorder; **remove** (`×`); Pointer-events drag for within-list and **cross-list** moves onto another To-Do widget’s list.

### Display mode

- No recurrence UI; “New task” row still shown.
- **No checkbox:** done state is toggled by tapping the **full-width task label button** (`todo-task-text-toggle`); completed tasks use **strikethrough** + muted text.
- Same colour bar, drag handle, remove, Pointer-events drag, and cross-list behaviour as edit mode.
- Colour picker panel is **`position: fixed`** (viewport-clamped) so it is not clipped by the widget or scroll container.

### Interaction & accessibility

- Primary accent remains **cyan** (`#2dd4bf`) for focus rings and shell actions; task border colours may use the full palette above.
- Touch: prefer **~44px** minimum hit areas on drag handle, remove, edit-mode done toggle, and text-toggle row (see `.todo-item-handle`, `.todo-task-remove`, `.todo-task-done-toggle`, `.todo-task-text-toggle`).
- Icon-only controls need explicit `aria-label` / `aria-pressed` where stateful (`aria-pressed` on done toggles).

### Pointer-events drag-and-drop pattern (v4)

- Drag uses Pointer Events only (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `lostpointercapture`) for both widget and task reordering.
- Widget reordering attaches pointer handling to `.widget-handle`; a fixed-position clone adopts `.dnd-ghost-widget` and follows `event.clientX/Y` using `transform: translate(...)`.
- Task reordering attaches pointer handling to `.todo-item-handle`; a fixed-position clone adopts `.dnd-ghost-task`.
- While dragging tasks, all `.todo-list` elements participate as drop targets; insertion is driven by midpoint logic and visualized with `.dnd-task-placeholder` and `.is-list-drop-target`.
- Pointer drag over state is reflected with `.dnd-over` and body suppression is handled via `body.dnd-active` (`user-select: none`, `touch-action: none`).
- Mobile/touch: `touch-action: none` on drag handles (`.widget-handle`, `.todo-item-handle`), on drag ghosts (`.dnd-ghost-widget`, `.dnd-ghost-task`), and on `body.dnd-active` while a drag is in progress — so `.todo-list` and widget shells can scroll normally when not dragging.

## Tools diagnostics widgets (Status + Log)

- Diagnostics is owned by `js/site-diagnostics.js` with a local subscriber API (`subscribeLogs` / `subscribeProbes`, each returning a disposer) and a ring-buffer log capped at 500 entries.
- Tools diagnostics widgets run on the tools panel only; shell still renders widget titles.
- Probe outcomes are grouped by status (`ok`, `warn`, `crit`) and surfaced in Status rows:
  - Healthy: `#22c55e` (`emerald`) + `text-emerald-400`.
  - Warning: `#f59e0b` (`amber`) + `text-amber-400`.
  - Critical: `#ef4444` (`red`) + `text-red-400`.
- Status rows show the probe label, detail text, and per-result timestamp; overall header uses `text-xs` uppercase label + status chip-like row.
- Log renders a scrollable terminal-style stream, newest entries appended at the bottom and with auto-scroll when already pinned.
- Log filtering is binary: `All` and `Warn + Error` (`warn`/`crit`/`error` filter), defaulting to `All`.
- Console integration captures `warn` and `error` only (not `console.log`) with recursion guard and routes to diagnostics log only.
- Probe writes and console capture are append-only; manual refresh and automatic visibility/poll refresh are available for Status.
- **Widget server sync** — two extra Status rows (merged after static probes): **Widgets GET (retrieve)** for the initial `/api/widgets` load, and **Widgets PUT (push)** for live outbound state (idle / debounced / in flight / offline queue / last failure). `js/app.js` calls `reportWidgetSyncRetrieve`, `reportWidgetSyncPushFromDashboard`, and `reportWidgetSyncPushEvent`; structured **info** log lines mark GET/PUT milestones, while existing `console.error` / `console.warn` on sync failures still flow through the Log via console hooks.

## Tools debug widget (Fortnight calculator)

- Added on Debug page tools track (`toolsWidgets`) via `js/widgets/fortnight-tools.js`; widget rows keep per-instance settings in `widgetRow.fortnightState`.
- Inputs in the widget: FN start date, line number at FN start, rotate-from, rotate-to, and target date.
- Output sentence format is fixed: `On {Date} you will be on line {line number}`.
- Line progression: count Sundays after FN start through target date, then advance by +1 every second Sunday (`Math.floor(sundayCount / 2)`), wrapping to the configured range.
- Storage and UX: all fields persist in the row, and target date can be changed directly without re-entering other values.
- Edge handling documented in implementation:
  - rotate-from / rotate-to is normalized by swap when out of order;
  - target date before FN start returns the configured start-line;
  - line-at-start is clamped into the rotation range.
