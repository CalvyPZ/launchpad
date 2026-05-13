# Assignments — Fortnight Calculator tools widget

**Date:** 2026-05-13

## Client direction

Build a persisted fortnight line calculator tool for the dashboard tools track.

### Decision

- **Placement:** add to the **tools widget track** (`toolsWidgets`) rather than `toolsLandingWidgets`.
- **Reason:** persisted sync path is already wired for `toolsWidgets` and currently includes add/remove/config flows in edit mode; this satisfies the requirement that configured values remain stored and not re-entered.
- **Scope implication:** keep `toolsLandingWidgets` behavior and defaults intact for Tools landing; the new widget will be available via Debug tools flow.

## Frontend Dev

### 1) Widget factory implementation

**Files touched**
- `js/widgets/fortnight-tools.js`

**Acceptance bullets**
- Add `render(container, widgetRow, dashboard)` that mounts calculator UI into `container` and returns `{ destroy() }`.
- Use per-instance state on the widget row, e.g. `widgetRow.fortnightState`, not shared global `localStorage` keys.
- Render inputs:
  - FN start date (`type="date"`).
  - line number at FN start (integer).
  - rotate from (integer).
  - rotate to (integer).
  - target date (`type="date"`).
- Persist and re-render when any configured value changes.
- Render result sentence with exact user format:
  - `On ${formattedTargetDate} you will be on line ${calculatedLine}`.
- Ensure date formatting is locale-safe and stable across reloads (YYYY-MM-DD source -> readable UI output).
- No external dependencies.

### 2) State defaults and migration

**Files touched**
- `js/store.js`
- `js/app.js`

**Acceptance bullets**
- `normaliseToolsRows`/tools defaults include a stable `fortnight` widget state default object when a widget row of type `fortnight` exists without `fortnightState`.
- `normaliseToolsRows` includes:
  - default `fortnightState` for new rows.
  - safe migration path for legacy or partially missing values.
- `addWidget` initialization sets a deterministic `fortnightState` for new `fortnight` rows.
- Ensure state is not stripped by persistence mapping.
- If tools widget types are rendered with titles, provide a stable widget label for this type.

### 3) App wiring + registration

**Files touched**
- `js/app.js`

**Acceptance bullets**
- Register `toolsWidgetFactories['fortnight']` mapping to `./widgets/fortnight-tools.js`.
- Add `fortnight` to `toolsAddWidgetChoices` so it is selectable where tools add flow exists.
- If config uses editable settings sections, ensure existing pattern is followed (`dashboard.persistToolsWidgets()` and `dashboard.persistWidgets()` usage as appropriate).
- Keep factory import and registration style aligned with existing tools widgets.

### 4) Styling and style-guide alignment

**Files touched**
- `css/style.css` (if new classes are required)
- `team/style-guide.md`

**Acceptance bullets**
- Add/adjust minimal scoped classes for the new tool form/result only if needed; avoid global style side effects.
- Keep all controls on existing focus and minimum hit target rhythm (no purple focus tokens).
- If any new widget pattern is introduced, document the visual contract in `team/style-guide.md`.

### 5) Edge-case behavior contract

**Files touched**
- `js/widgets/fortnight-tools.js`

**Acceptance bullets**
- Normalize `rotateFrom`/`rotateTo` when provided out of order (documented behavior; preferred stable fallback is to swap values before range math).
- For `targetDate` before FN start, return the start-line (no wrap before base interval begins).
- Sunday semantics: line increments on every **second** Sunday after FN start (first Sunday = offset 0, second Sunday = +1, etc.).
- If `startLine` is outside the normalized bounds, clamp to nearest bound before first render.
- Handle blank/invalid input values without throwing and with deterministic fallback defaults.

## Definition of done

- Fortnight widget persists via per-instance widget-row state and survives full reloads without re-entering config.
- Widget can be added from tools add flow and renders correctly in its page.
- Output sentence remains deterministic for the same state after reload.
- Edge-case behavior matches the contract above and is documented in code comments (or equivalent inline notes).
- `team/lead-status.md` updated by Team Lead with implementation ownership and cycle state.
- Optional visual/pattern updates are reflected in `team/style-guide.md`.

## QA handoff

- QA should run a focused review using the existing checklists and explicitly validate:
  - add-widget flow and persistence of all fields,
  - deterministic calculation for Sunday intervals and wrapped line values,
  - no style regressions in widget spacing/focus states,
  - stale state recovery after cold reload.
- QA file should include a Pass / Pass with notes / Blocked-Fail style verdict.
