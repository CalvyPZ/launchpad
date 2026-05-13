# CalvyBots — QA Report

## v4 front-end refresh

### Front-end refresh status

- Status: **Fail**

### Top findings

- `index.html:87-90` still binds the Add Widget button to `addWidgetPrompt()`, but `js/app.js` no longer defines that method and now exposes `addWidget(type)` + `addWidgetOpen`; clicking the button will error.
- `index.html` has no widget picker markup (`widget-picker`, `@click.outside`, or picker trigger state) and `js/app.js` has no `@click.outside` logic, so dropdown-based add flow described in v4 is not wired.
- `css/style.css:366` still uses `::focus-visible` (invalid pseudo-element) and `css/style.css:376-390` still uses `:::-webkit-scrollbar*` (invalid pseudo-element syntax), so v3 accessibility fixes are not fully applied.
- Search widget still ships as `js/widgets/search.js` but is not part of `widgetTypes` in `js/app.js`, and the file is not rendered/reachable from the current widget factory.
- `index.html` still lacks manifest link and service worker registration script, so PWA bootstrap cannot initialize.

### What is now in good shape

- `js/widgets/clock.js` no longer renders a widget-specific title inside content.
- `js/widgets/notes.js` no longer renders a duplicate in-widget title.
- `js/app.js:123` applies `aria-label` to widget remove control.
- New `js/widgets/todo.js` exports `render(container)` and is included in the factory/registry path expected by `app.js`.
- `manifest.json` is valid JSON and references existing `icons/icon.svg`.

## Overall summary

- Total test cases reviewed: **76**
- Pass: **50**
- Fail: **26**
- Blockers: **3**
- Critical issues: **5**
- Verdict: **Needs fixes before sign-off**

This review is a static analysis only (no runtime execution). Failures are deterministic from implementation code shape and wiring.

### Executive blockers
1. Frontend `js/app.js` does not consume `js/config-loader.js`, `js/store.js` (backend version), or `js/event-bus.js`, so backend runtime contract is not exercised end-to-end.
2. Backend/Frontend `js/store.js` duplication creates two incompatible persistence surfaces.
3. Config-driven rendering flow from `data/config.json` into widget layout/rendering is currently disconnected.

## Per-test-case results

### 3.1 Page Load & Structure

- **FE-001** PASS
  - Evidence: `index.html` declares `x-data="dashboard()"` and `x-init="init()"` on load with core containers (`header`, widget grid `#widget-grid`, and `footer`) present.

- **FE-002** PASS
  - Evidence: `index.html` includes Tailwind CDN script and Alpine CDN script tags before module app bootstrap.

- **FE-003** PASS
  - Evidence: `index.html` loads frontend JS via `<script type="module" src="js/app.js">`.

- **FE-004** FAIL
  - Evidence: App bootstrap (`js/app.js`) has no import/use of `config-loader.js`; there is no runtime config fetch path in the page initialization.
  - Evidence file: `js/app.js:2-10`, `js/app.js:69-77`.

- **FE-005** FAIL
  - Evidence: No explicit fallback handling in `app.js` for failed external CDN fetch/asset load scenarios; offline path is not defined.
  - Evidence file: `js/app.js` has no network error branches.

- **FE-006** PASS
  - Evidence: viewport meta and responsive grid classes are present (`viewport`, `sm:`, `md:`, `xl:` breakpoints).

- **FE-007** FAIL
  - Evidence: Some controls are missing explicit labels/label associations; search/select/input controls inside widgets rely on placeholders only, not labels.
  - Evidence files: `js/widgets/search.js:23-43`.

- **FE-008** PASS
  - Evidence: No obvious runtime exception points in static module code paths for clean baseline load.

### 3.2 Widget Rendering (clock, bookmarks, notes, search)

- **FE-009** PASS
  - Evidence: Clock widget renders timer element and updates via `setInterval(1000)` in `js/widgets/clock.js`.

- **FE-010** PASS
  - Evidence: Uses explicit locale formatting (`en-US`) for `toLocaleTimeString/date` in clock widget.

- **FE-011** FAIL
  - Evidence: Widgets are hard-imported in `app.js` (`import * as ... from "./widgets/*.js"`), so a widget module load failure is not gracefully replaced with fallback and can break module load.
  - Evidence file: `js/app.js:7-10`.

- **FE-012** PASS
  - Evidence: `bookmarks.js` loads defaults/localStorage list and renders clickable link pills.

- **FE-013** PASS
  - Evidence: `anchor` element for each bookmark uses `target="_blank"` and `rel="noopener noreferrer"`.
  - Evidence file: `js/widgets/bookmarks.js:48-52`.

- **FE-014** PASS
  - Evidence: Notes widget has fallback copy and textarea rendering.
  - Evidence file: `js/widgets/notes.js:3-12`, `js/widgets/notes.js:18-29`.

- **FE-015** PASS
  - Evidence: notes widget saves on input debounce and on destroy.
  - Evidence file: `js/widgets/notes.js:35-47`.

- **FE-016** PASS
  - Evidence: search form creates encoded query URL and opens target in new tab.
  - Evidence file: `js/widgets/search.js:52-59`.

- **FE-017** PASS
  - Evidence: query trimmed and if empty returns early.
  - Evidence file: `js/widgets/search.js:54-55`.

- **FE-018** PASS
  - Evidence: widget render loop filters `visible !== false` and stores `visible` flag from normalized widget list.
  - Evidence file: `js/store.js:33-34`, `js/store.js:36-39`.

### 3.3 Edit Mode

- **FE-019** PASS
  - Evidence: `toggleEditMode()` flips `editMode` and re-renders widget shell.
  - Evidence file: `js/app.js:199-203`.

- **FE-020** PASS
  - Evidence: Bookmarks widget exposes “+ Add quick link” only in edit mode and writes via local save.
  - Evidence file: `js/widgets/bookmarks.js:80-128`.

- **FE-021** FAIL
  - Evidence: No edit-in-place or edit action for existing bookmarks; only remove + add.
  - Evidence file: `js/widgets/bookmarks.js:47-71` (no update flow).

- **FE-022** PASS
  - Evidence: Remove button and filtered save path exist.
  - Evidence file: `js/widgets/bookmarks.js:59-69`, `js/widgets/bookmarks.js:97-101`.

- **FE-023** PASS
  - Evidence: Notes persist immediately and on destroy.
  - Evidence file: `js/widgets/notes.js:35-47`.

- **FE-024** PASS
  - Evidence: Search engine select control persists selection using `saveEngine`.
  - Evidence file: `js/widgets/search.js:62-63`, `js/widgets/search.js:14-16`.

- **FE-025** FAIL
  - Evidence: There is no explicit cancel/revert path in edit interactions; changes are applied directly while editing.
  - Evidence file: `js/widgets/bookmarks.js:96-101`, `js/widgets/notes.js:35-37`.

### 3.4 LocalStorage Persistence

- **FE-026** PASS
  - Evidence: widget list and site title persisted to keys `calvybots_widgets` and `calvybots_title`.
  - Evidence file: `js/store.js:1-8`, `js/store.js:53-63`, `js/store.js:65-72`.

- **FE-027** PASS
  - Evidence: notes save uses raw textarea value; defaults and loads preserve multiline/unicode through plain string storage.
  - Evidence file: `js/widgets/notes.js:3-19`.

- **FE-028** PASS
  - Evidence: `JSON.parse` in `loadWidgets()` and `loadBookmarks()/loadNotes()` guarded by `try/catch` fallback.
  - Evidence file: `js/store.js:42-50`, `js/widgets/bookmarks.js:30-40`.

- **FE-029** FAIL
  - Evidence: Several `localStorage.setItem` calls have no `try/catch` guards (e.g., widget saves, bookmarks, notes, search); quota failures can break action path.
  - Evidence file: `js/store.js:62`, `js/widgets/bookmarks.js:44`, `js/widgets/notes.js:15`, `js/widgets/search.js:15`.

- **FE-030** FAIL
  - Evidence: Frontend `js/store.js` has no schema migration, version keys, or merge policy.
  - Evidence file: `js/store.js` only handles 4 keys with direct set/get functions.

### 3.5 Responsive Layout

- **FE-031** PASS
  - Evidence: grid uses fluid width and responsive columns (`md`, `xl`), plus compact widget shells.

- **FE-032** PASS
  - Evidence: mid-breakpoint behavior is covered with responsive class set and non-fixed widths.

- **FE-033** PASS
  - Evidence: page has consistent max-width container and padding scaling.

- **FE-034** PASS
  - Evidence: No fixed viewport-dependent JavaScript layout constraints in render code.

### 3.6 Visual / Style Compliance

- **FE-035** PASS
  - Evidence: shared classes and custom CSS tokenized by `.dash-widget` and theme values.

- **FE-036** PASS
  - Evidence: design system values are defined in both Tailwind config and stylesheet; visible dark-contrast palette is consistently applied.

- **FE-037** FAIL
  - Evidence: visible focus-visible outlines are not explicitly defined for many actionable controls; keyboard focus behavior is not clearly guaranteed.
  - Evidence file: `css/style.css` has minimal general styling and no explicit focus utility styles for interactive elements.

- **FE-038** PASS
  - Evidence: render pipeline tears down widget instances via controllers and re-renders shell consistently.
  - Evidence file: `js/app.js:101-163`.

### 4.1 config.json Schema Validation

- **BE-001** PASS
  - Evidence: `data/config.json` contains documented top-level keys (`site`, `widgets`, `bookmarks`, `search`).

- **BE-002** PASS
  - Evidence: loader merges by deep merge; extra keys are copied through merge path.
  - Evidence: `js/config-loader.js:43-65`.

- **BE-003** PASS
  - Evidence: fetch JSON parse failures are caught, log error, and merge proceeds with empty config.
  - Evidence file: `js/config-loader.js:121-131`, `146-149`.

- **BE-004** FAIL
  - Evidence: No explicit schema type validation for each widget entry/field is implemented; merge only overlays raw objects.
  - Evidence file: `js/config-loader.js:43-65`.

- **BE-005** PASS
  - Evidence: fallback path returns merge with partial/missing sections possible due merge behavior and defaults.

### 4.2 config-loader.js

- **BE-006** PASS
  - Evidence: module exposes `getConfig()` and `updateConfig()` exports and updates in-memory merged config.

- **BE-007** PASS
  - Evidence: initialization path is async and awaits fetch/parse; emit event on load.

- **BE-008** PASS
  - Evidence: request uses `{ cache: 'no-store' }`.

- **BE-009** PASS
  - Evidence: runtime error from fetch is logged via `console.error(...)`.

### 4.3 store.js

- **BE-010** PASS
  - Evidence: module initializes default widgets when storage is missing and normalizes arrays.
  - Evidence file: `js/store.js:16-20`, `42-50`.

- **BE-011** FAIL
  - Evidence: module returns mutated normalized output in some cases and lacks generalized immutable update utilities for all managed domains.
  - Evidence: there is no central reducer-like API; only explicit ad-hoc helpers.

- **BE-012** FAIL
  - Evidence: no event subscribe callback hooks in this `js/store.js` file.
  - Evidence: `js/store.js` only exports four plain functions with no `on/off` API.

- **BE-013** FAIL
  - Evidence: `saveWidgets` persists widgets but no schema-aware `store:changed` event emit integrated with this module.
  - Evidence file: `js/store.js:53-63`.

- **BE-014** FAIL
  - Evidence: there is no `reset`/`remove` function in this `js/store.js`.

### 4.4 widget-registry.js

- **BE-015** PASS
  - Evidence: registry map exists and keys are mapped to module paths.
  - Evidence: `js/widget-registry.js:1`.

- **BE-016** PASS
  - Evidence: imported module is cached by key after first `get()`.
  - Evidence: `js/widget-registry.js` uses `moduleCache` before re-importing.

- **BE-017** FAIL
  - Evidence: `get()` throws on unknown type and does not provide placeholder/fallback output path.
  - Evidence file: `js/widget-registry.js:1`.

- **BE-018** FAIL
  - Evidence: duplicate type registration overwrites silently with no conflict policy or duplicate detection.
  - Evidence file: `js/widget-registry.js:1`.

### 4.5 event-bus.js

- **BE-019** PASS
  - Evidence: `on`/`off` pair exists and removeListener semantics are valid.
  - Evidence file: `js/event-bus.js:1`.

- **BE-020** PASS
  - Evidence: dispatch wrapper does not validate payload shape but also does not throw for non-shaped data.

- **BE-021** PASS
  - Evidence: event bus dispatches in-order per browser event loop; no conflicting debounce logic exists to introduce stale drops.

## 5. Integration Tests

### 5.1 Config → Widget flow

- **IN-001** FAIL
  - Evidence: widget rendering pipeline in `app.js` ignores `config-loader.js` and never reads `data/config.json`.

- **IN-002** FAIL
  - Evidence: there is no `config-driven` widget filtering or disabled-type handling during widget mount.

- **IN-003** FAIL
  - Evidence: no merge precedence implementation between `config.json` base and local overrides in frontend runtime path.

- **IN-004** FAIL
  - Evidence: search widget hardcodes engine map and storage key; config `search` block is not consumed.
  - Evidence: `js/widgets/search.js:3-7`, `js/config-loader.js:27-35` are disconnected.

### 5.2 Edit Mode → Store → Re-render

- **IN-005** PASS
  - Evidence: add/remove widget and bookmark actions re-render immediately and persist widgets through `saveWidgets`.
  - Evidence: `js/app.js:223-225`, `js/widgets/bookmarks.js:96-103`.

- **IN-006** PASS
  - Evidence: notes input saves to localStorage and remains visible after rerender sequence.

- **IN-007** PASS
  - Evidence: widget modules write to independent storage keys and re-render per-module with controller lifecycle.

### 5.3 Bookmark CRUD

- **IN-008** FAIL
  - Evidence: create/read/delete supported; update/edit is missing.

- **IN-009** FAIL
  - Evidence: no validation of URL scheme, duplicates, or mandatory fields beyond non-empty prompt checks.
  - Evidence: `js/widgets/bookmarks.js:110-127`.

- **IN-010** FAIL
  - Evidence: duplicate URL policy is undefined; duplicates are allowed by implementation.
  - Evidence: `js/widgets/bookmarks.js:116-123`.

## 6. Nginx / Delivery Tests

### 6.1 MIME types (especially .js modules)

- **DX-001** PASS
  - Evidence: `nginx.conf` declares `application/javascript` and includes `js`/`mjs` type mapping.
  - Evidence: `nginx.conf:11-17`.

- **DX-002** PASS
  - Evidence: explicit `text/css` and `application/json` type mappings are present in config.
  - Evidence: `nginx.conf:11-17`.

### 6.2 index.html served at root

- **DX-003** PASS
  - Evidence: `location / { try_files $uri $uri/ /index.html; }` and dedicated `/index.html` path rule.
  - Evidence: `nginx.conf:17`.

- **DX-004** PASS
  - Evidence: unknown routes fall back to `index.html`, documented SPA-style behavior.

### 6.3 Assets reachable

- **DX-005** PASS
  - Evidence: static directory root supports direct file paths and common static extensions under nginx location rules.

- **DX-006** PASS
  - Evidence: cache policies differ for html (no-store) vs js/css (month-long immutable).

- **DX-007** PASS
  - Evidence: gzip config enabled with JS/CSS/JSON in gzip_types.

## 7. Bugs Found

### Critical

1. **Critical – Frontend does not consume backend config layer**
   - Severity: **Critical**
   - Files: `js/app.js` lines 7-10, `js/config-loader.js`
   - Description: The page renders directly from embedded widget imports and frontend-local `js/store.js`, never calling `getConfig()` or responding to `config:updated`. This breaks the intended static-backend design and makes most config-driven tests invalid.

2. **Critical – Duplicate/competing store implementations**
   - Severity: **Critical**
   - Files: `js/store.js` (frontend copy), `data/schema.md`, backend design notes
   - Description: Backend schema and docs describe schema-migrated, event-driven centralized store while shipped code uses a different minimal local-only store API, creating incompatible behavior contracts and future data migrations.

3. **Major – Missing backend-widget registry contract usage**
   - Severity: **Major**
   - Files: `js/widget-registry.js`, `js/app.js`
   - Description: Registry module with lazy loading/caching is not used; `app.js` statically imports every widget. This bypasses dynamic registration, unknown-type fallback behavior, and plugin extensibility.

4. **Major – Bookmark edit flow incomplete**
   - Severity: **Major**
   - Files: `js/widgets/bookmarks.js`
   - Description: No edit path for existing bookmark entries, limiting CRUD and causing several integration tests to fail.

5. **Major – Missing explicit validation/cancel semantics in edit interactions**
   - Severity: **Major**
   - Files: `js/widgets/bookmarks.js`, `js/widgets/notes.js`
   - Description: Edits are immediately persisted with no cancel/revert flow and no robust input validation, increasing risk of accidental state corruption.

### Minor

1. Placeholder/duplicate files (`js/widget-reg.js`, `js/eventbus.js`, `js/abc-def.js`, `js/demo-test.js`, `js/simple.js`, `js/hyphen-test.js`) contain only `x`, creating dead code and increasing maintenance risk.
2. `js/widget-registry` (without extension) appears as an unexpected filesystem entry in inventory and should be clarified.
3. Keyboard focus states are not explicitly styled for all controls.

## 8. Integration Concerns

- **Confirmed conflict risk**: two `js/store.js` implementations exist in parallel from Frontend and Backend streams. Frontend runtime imports and functions in `js/store.js` do not match backend contract (`schemaVersion`, `store:changed`, migration, reset, centralized keys).
  - Evidence: `js/store.js` implements widget/title only (`loadWidgets`, `saveWidgets`, `loadSiteTitle`, `saveSiteTitle`) while backend notes/docs require schema-wrapped migration and multi-key evented store (`data/schema.md:34-52`, `team/backend-complete.md:18-21`, `js/event-bus.js`).

- **Unconnected modules**: `js/config-loader.js`, `js/event-bus.js`, and `js/widget-registry.js` are not wired into actual `index.html` runtime flow, so intended architecture (`config.json` fetch + merge + event updates + widget registry loading) is not exercised.

- **Potential data contract drift**: `data/config.json` shape uses `bookmarks.default`, `widgets.defaultLayout`, and `search.engines`, but runtime widgets and store read their own local keys (`calvybots_bookmarks`, `calvybots_notes`, `calvybots_search_engine`) with no read-through from config.

## 9. Recommendations for fixes

### P0 (must do before ship)
1. Integrate backend `js/config-loader.js` into `js/app.js`: use `getConfig()` and subscribe to `config:updated` for widget layout and search/settings.
2. Resolve store ownership: either remove frontend-local store implementation or re-export/adapt API to backend contract (schema migration, key schema, store events).
3. Replace static widget imports with registry-driven loader or remove registry layer to keep architecture aligned with schema docs.

### P1 (important)
4. Add bookmark edit + validation logic (URL + duplicate policy).
5. Add safe storage error handling (`try/catch`) on every setItem path and implement explicit cancel/revert semantics for edit mode.
6. Remove placeholder/accidental `x` files or document their purpose.
7. Add keyboard-accessibility labels/focus styles and robust empty/offline fallback behavior.

### P2 (recommended)
8. Add config schema validation and unknown widget fallback in `widget-registry.js`.
9. Reconcile naming consistency (`store`, `search`, and `event-bus` modules) and run a consistency audit after merge.
