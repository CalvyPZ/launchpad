# Assignments — Notes & To-Do cycle

**Date:** 2026-05-13

## Context

- Client requires **multiple** Sticky Notes and To-Do instances with **isolated** persisted state, **renamable** display names, **Markdown** notes with safe rendering, **recurrence** for to-do resets, and **resizable** widgets that stay usable on mobile (`team/lead-status.md`, `team/delegation-v4.md`).
- Today `js/store.js` persists only `id`, `type`, `position`, and `visible` under `calvybots_widgets`, while `js/widgets/notes.js` and `js/widgets/todo.js` use **global** keys `calvybots_notes` and `calvybots_todo`, so all instances share one blob — this must change.
- **Team default (product) until client overrides:** For **daily** / **weekly** reset, **reset** means clear the `done` flag on **all** tasks while **keeping** task `id` and `text`; for **never**, no automatic reset. Reset is evaluated on **dashboard load** and when the tab becomes **visible** (`document.visibilitychange`), using **device-local** time. User configures: recurrence (`never` | `daily` | `weekly`), time-of-day (`HH:MM`), and for weekly the weekday index **0–6** (Sun–Sat).

## Frontend Dev

Execute in checklist order; touch only the files needed for this track.

### 1. `js/store.js`

- [ ] Extend the **normalised widget record** so each item may include: optional `title` (string), layout fields (**pick one approach:** persist **`minWidth` / `minHeight` (or `width` / `height`) in CSS pixels** on the widget record and apply as inline styles on the shell — **justification:** the current `widget-grid` uses `repeat(auto-fit, minmax(...))` without explicit placement, so **grid-column/row span** would require a placement model rewrite, whereas numeric dimensions compose directly with CSS `resize` and min-size constraints without changing the grid algorithm).
- [ ] Persist per-instance **`notesState`** and **`todoState`** **embedded** in each widget object inside the existing `calvybots_widgets` JSON array (single atomic payload, no second localStorage document).
- [ ] On **`loadWidgets()`** (or dedicated migration helper called from it): if legacy `localStorage` keys `calvybots_notes` (string) and/or `calvybots_todo` (JSON array) exist, **migrate once** — attach parsed content to the **first** widget of matching `type` in current order (`notes` / `todo`), merge into that widget’s embedded state fields, **`removeItem`** the legacy keys after successful merge, then return normalised widgets. If no matching widget exists, document behaviour in a code comment (default: migrate only when a target widget exists).
- [ ] Ensure **`saveWidgets`** round-trips **all** new fields (today it maps only `id`, `type`, `position`, `visible` — extend the mapper so embedded state, title, and dimensions are not stripped).
- [ ] Add small **inline comments** for DST / device-local behaviour where reset boundaries are computed (per manager ask).

### 2. `js/app.js`

- [ ] Treat widget API as **`render(container, context)`** where `context` includes at least **`config`** (with stable **`config.id`**), **`editMode`**, and any narrow **`dashboard`** surface you intentionally expose (e.g. `persistWidgets`). **All** widget reads/writes for typed state must go through **`config.id`**-scoped paths in store payloads, not globals.
- [ ] **Shell header:** In **edit mode**, replace or supplement the static type label with an **inline input** (or `contenteditable` matching site title patterns) bound to **`config.title`** with fallback display to **`widgetLabels[type]`** when title is empty; persist on blur / debounced input via `saveWidgets`. Ensure **remove** button `aria-label` uses the effective display name.
- [ ] When creating a new widget via `addWidget`, initialise **default embedded state** for `notes` / `todo` (empty or sensible defaults) so renderers never read `undefined`.
- [ ] On **dashboard `init`** and on **`visibilitychange`** (when `document.visibilityState === 'visible'`), call into todo logic or store helper so **due resets** run without requiring a full remount (coordinate with `todo.js` so a single evaluation path exists).
- [ ] If shell dimensions are persisted, apply **`style`** min-width/min-height (or width/height per CSS choice) from `config` when building each `article.dash-widget`, and merge user resize updates back into `this.widgets` + `persistWidgets`.

### 3. `js/widgets/notes.js`

- [ ] Remove direct use of **`calvybots_notes`**; read/write **`notesState`** only via **`context.config`** and centralised save through dashboard/store (same pattern as todo).
- [ ] **Markdown:** Load **marked** + **DOMPurify** from a **trusted CDN** (e.g. cdnjs) via **`<script src>` tags in `index.html`** (ES modules if available from CDN, or global `window` bindings — match project’s no-build-step constraint). Renderer: **textarea** for source plus **preview toggle** or **split** view; **never** assign unsanitised HTML — parse Markdown then **`DOMPurify.sanitize`** before insert.
- [ ] Return **`destroy()`** that clears timers/listeners and flushes pending saves.

### 4. `js/widgets/todo.js`

- [ ] Remove **`calvybots_todo`**; persist **`todoState`** on the widget: task list (`id`, `text`, `done`), recurrence (`never` | `daily` | `weekly`), **`timeLocal`** (`HH:MM`), **`weekday`** (0–6 for weekly), and **`lastResetAt`** (ISO string or comparable) **or** equivalent period tracking — document which in code.
- [ ] **Recurrence UI:** Controls for type, time, weekday (visible only when `weekly`), plain-language labels (QA supplement).
- [ ] **Reset logic:** On load and when invoked from app **`visibilitychange`**, if recurrence is `daily` or `weekly`, compare **device-local** clock to configured boundary; when a new period has started since `lastResetAt`, set **all** tasks `done: false`, update **`lastResetAt`**, persist. **`never`:** skip auto reset.
- [ ] Return **`destroy()`** that removes listeners and saves pending edits.

### 5. `css/style.css`

- [ ] **`resize`:** Apply `resize: both` (or vertical-only if design prefers) on **`.widget-content`** or the **shell**, with **`overflow: auto`**, **`min-width` / `min-height`** consistent with store defaults and readability.
- [ ] **Touch / narrow breakpoints:** Either **`resize: none`** below a chosen max-width and rely on fixed min dimensions, **or** provide a **larger drag handle** / edit-only resize affordance — pick one and match QA expectations (no resize fighting vertical scroll).
- [ ] Styles for markdown preview (prose contrast, lists, code) scoped under widget content class to avoid leaking globals.

### 6. `index.html`

- [ ] Add **cdnjs** (or equivalent approved CDN) script tags for **marked** and **DOMPurify** in correct order (DOMPurify available before notes widget runs); keep **module** `js/app.js` ordering intact.
- [ ] If globals are used, add brief HTML comment documenting expected `window` names.

### 7. `js/widgets/clock.js`

- [ ] **Unchanged** functionally; align **`export function render(container, context)`** signature with other widgets (ignore `context` if unused) so `widgetFactories` stay uniform.

---

## Backend Dev

- [ ] Verify **`nginx-site.conf`** still serves **`sw.js`** and **`manifest.json`** with correct types/headers (no regression).
- [ ] **Markdown libraries CDN-only:** If notes use only **cross-origin CDN** scripts (not copied into repo), record **no nginx change** for new MIME paths — browser loads them directly.
- [ ] **Self-hosted vendor files:** If the team later vendors `marked`/`dompurify` under `/js/vendor/`, add a **`location`** or rely on existing `~* \.(js)$` block; note **long-cache** vs update strategy (`immutable` may require filename versioning).
- [ ] **Service worker:** If any **new same-origin** scripts are added to the precache list, update **`sw.js`** `SHELL` array and bump cache version comment/key per existing convention; coordinate with Frontend so offline shell includes new modules.

---

## QA handoff

- Run **`team/qa-complete-v4.md`** — **Supplement: Notes & To-Do widgets — QA acceptance (pending)** in full when a candidate build is ready.
- Explicit **human-friendliness** pass: recurrence labels, empty states, rename/resize discoverability in edit mode, thumb reach on small screens (mirrors `team/lead-status.md` delegation).
- Document test method for time-based cases (simulated clock vs real wait) in QA notes or `tests/report.md` as the team already references.

---

## Definition of done

- **Multiple instances:** Two+ notes and two+ todo widgets hold **independent** content and settings after reload / cold start.
- **Persistence:** No remaining runtime dependency on **`calvybots_notes`** or **`calvybots_todo`**; legacy keys **migrated once** then **cleared**.
- **Rename:** Per-widget display name in shell; persists; no duplicate title inside widget body.
- **Todo schedules:** **`never` / `daily` / `weekly`** with user **local** time and weekly weekday; reset semantics per **team default** above; runs on **load** + **tab visible**.
- **Notes:** Markdown renders as intended; **sanitised** output — no script execution from crafted payloads.
- **Resize + mobile:** Desktop/tablet resize respects mins; mobile behaviour matches assignment (no scroll fights / disabled or enlarged handle).
- **PWA:** If `sw.js` precache changes, verified offline shell still loads dashboard.
