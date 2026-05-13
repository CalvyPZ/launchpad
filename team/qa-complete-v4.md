# CalvyBots Front-End Refresh v4 — QA Review

## Verdict

Fail.

## Top 5 findings / risks

1. **High – Add Widget action is disconnected and broken**
   - `index.html:84-90` still calls `addWidgetPrompt()`, but `js/app.js` no longer defines this method.
   - `js/app.js:197-211` defines `addWidget(type)` and `addWidgetOpen`, but `index.html` does not expose the new picker UI.
   - Impact: clicking “+ Add Widget” can throw at runtime when edit mode is active.

2. **High – v4 picker flow not implemented in markup**
   - `js/app.js` includes `addWidgetOpen` (`js/app.js:57`) but no `@click.outside` handler and no dropdown controls are in `index.html`.
   - Frontend summary claims an in-page picker with `@click.outside`, but actual DOM/API does not implement this contract.
   - Impact: edit-mode widget creation UX is incomplete/regressed.

3. **High – PWA bootstrap missing in HTML shell**
   - No `<link rel="manifest" ...>` and no SW registration script are present in `index.html`.
   - Backend-added `manifest.json` and `sw.js` are therefore not discoverable or activated from the delivered page.
   - Affected files: `N:\web_app\index.html`.

4. **Medium – Two v3 CSS fixes remain unresolved**
   - `css/style.css:366` uses `::focus-visible` instead of `:focus-visible`.
   - `css/style.css:376-390` uses `:::-webkit-scrollbar*` instead of `::-webkit-scrollbar*`.
   - Impact: focus and scrollbar customizations may not render reliably.

5. **Medium – Unused search widget file**
   - `js/widgets/search.js` remains present and fully featured but is omitted from `widgetTypes` and `widgetFactories` in `js/app.js`.
   - Impact: dead feature drift and potential user confusion versus delivered changelog.

## What is now in good shape

- `js/widgets/clock.js` and `js/widgets/notes.js` no longer include duplicate in-content title blocks, so shell titles are the single source of truth.
- `js/app.js:123` adds an explicit `aria-label` to the widget remove button.
- `manifest.json` is syntactically valid JSON and references `icons/icon.svg` (`manifest.json:1-19`); `icons/icon.svg` exists and is parseable XML.
- `js/widgets/todo.js` exports `render(container)` and `js/app.js` uses it via `widgetFactories` (`js/app.js:9-16`, `js/app.js:142-143`).

---

## Supplement: Client PWA / online-first (2026-05-13)

### Verdict (PWA scope only)

**Pass.**

### Evidence reviewed

- **Manifest and install surface**: `index.html` includes `link rel="manifest"`, theme and Apple web-app meta tags, and `display: standalone` is set in `manifest.json` with `icons/icon.svg`.
- **Service worker**: `index.html` registers `/sw.js`. Worker precaches the same-origin shell (`index.html`, CSS, `js/app.js`, `js/store.js`, widget modules, `manifest.json`, `icons/icon.svg`), uses **network-first** for same-origin `GET` so online sessions prefer the network, skips `/api/` entirely, and does not intercept cross-origin CDN requests (online-primary; CDN may be unavailable offline).
- **Offline UX**: `index.html` exposes an `aria-live` status strip when `online` is false; `js/app.js` tracks `navigator.onLine` and listens for `online` / `offline` events.
- **Hosting**: `nginx-site.conf` serves `sw.js` with `no-store` and `manifest.json` with `application/manifest+json`.

### Residual (manager-tracked)

- Add `icons/icon-192.png` and `icons/icon-512.png` when assets exist for the broadest install prompts (see `icons/README.md`).

### Note on earlier v4 findings above

Sections 1–3 of the original review describe an older revision. The current `index.html` implements the in-page widget picker and PWA bootstrap; those specific defects are **not** reproduced in the current tree. The historical **Fail** verdict above remains on file for the original v4 snapshot; full visual regression against cyan refresh should still be run when that track lands.

---

## Supplement: Notes & To-Do widgets — QA acceptance (pending)

**Scope:** Client requirements dated 2026-05-13 (see `team/lead-status.md` and `team/delegation-v4.md` amendment). Run this section when Frontend Dev delivers the feature set.

### Functional

- Add **two or more** Sticky Notes and **two or more** To-Do widgets; confirm each has **independent** content and settings.
- **Power cycle / cold start simulation:** clear memory if needed, reopen app; confirm all instances, titles, todo items, note text, recurrence options, and sizes (if persisted) restore correctly.
- **Rename:** change display names; reload; names persist and appear consistently in the widget shell (no duplicate titles inside widget body).

### To-Do recurrence

- Configure at least one list as **daily**, one as **weekly**, one as **never**; verify behaviour matches spec after simulated or real time advance (document test method in `tests/report.md` or QA notes).
- Edge cases: device sleep, tab backgrounded, clock change (call out any limitations).

### Notes — Markdown

- Exercise common Markdown (headings, lists, links, emphasis); confirm **rendering matches intent**.
- **Security:** attempt benign script-style payloads; expect **no script execution** (sanitisation or safe renderer).

### Layout — resize and mobile

- On a **desktop-class** viewport: resize widgets; confirm **minimum size** still allows reading and interaction; no clipped irrecoverable controls.
- On a **narrow / mobile** viewport: confirm **usable without hover**, scroll behaviour is natural, and resize (if offered) does not fight vertical scroll.
- **Human-friendliness / UX:** labels explain recurrence; empty states are helpful; errors are plain language; rename and resize are **discoverable** in edit mode (or documented in UI copy).

### Verdict

Leave blank until QA executes against a candidate build; Team Lead updates priority if scope is split across releases.

### Verdict — Notes & To-Do (static review 2026-05-13)

**Pass with notes.** Static review of `js/store.js`, `js/app.js`, `js/widgets/notes.js`, `js/widgets/todo.js`, `js/widgets/clock.js`, `index.html` (widget picker + CDN scripts), and `css/style.css` (notes/todo/resize) against `team/assignments-notes-todo.md` and this supplement shows the implementation is largely aligned with the Definition of done. No **High** severity defects were identified from code alone; interactive checks in the supplement (multi-instance cold start, recurrence over real/simulated time, XSS probes, device resize) remain recommended before treating the feature as fully signed off.

**Findings**

1. **Medium — Offline / CDN dependency for Markdown preview** — Notes use `window.marked` and `window.DOMPurify` from cdnjs (`index.html`); `sw.js` precaches same-origin shell only, so an offline session may never load those libraries. `notes.js` then shows a generic “Preview libraries are still loading” message, which can mislead when the failure is permanent (offline + uncached CDN), not transient loading.

2. **Medium — Legacy keys when no migration target** — `migrateLegacyIntoWidgets` in `js/store.js` correctly merges legacy `calvybots_notes` / `calvybots_todo` into the first matching widget and removes keys when a target exists; if no `notes` / `todo` row exists at migration time, legacy keys are intentionally left (documented). Matches the assignment’s escape hatch but is worth one manual QA case so storage is not mistaken for a bug.

3. **Low — Default To-Do seed content** — `defaultTodoState()` includes a starter task (“Add your first task”). It is easy to confuse with real work and adds friction for users who want a truly empty list.

4. **Low — Reset evaluation surface** — Periodic reset runs from `loadWidgets()` / `evaluateAllTodoResets` and from `visibilitychange` in `js/app.js`, consistent with the written assignment (not a continuous timer while the tab stays visible). If product ever expects crossing midnight while the tab remains focused without navigation, that would need an explicit enhancement.

5. **Low — Resize only in edit mode** — CSS `resize` on `.widget-content` and `ResizeObserver` persistence in `js/app.js` are gated on `editMode`. Discoverability matches the supplement’s edit-mode emphasis; users who expect resize while not in “Edit” should be told via copy or help.

6. **Low — `marked` API drift** — Preview path assumes synchronous HTML from `marked.parse` / `marked`; the dependency is pinned, but a future major that returns a Promise could degrade preview until code is adjusted.

**Human-friendliness**

- **Strengths:** To-do schedule copy explains that auto-reset clears done state only and uses local time; recurrence options use plain language (“Never (manual only)”, “Every day at a set time”, etc.); notes offer Split / Source only / Preview only with `aria-pressed`; shell rename uses a clear placeholder from `widgetLabels`; mobile splits notes panes to a single column; sub-640px disables widget-body resize to reduce scroll fights, with a CSS comment explaining why.
- **Gaps:** The notes preview fallback when libraries are absent should distinguish “offline / blocked” from “loading”; resize is discoverable only after entering edit mode, with no in-UI hint beyond the pattern used elsewhere on the dashboard.

### Verdict — QA remediation cycle 2 (2026-05-13)

**Pass with notes.**

**Remediation DoD** (`team/assignments-qa-remediation-v1.md`): **Met** from static/code review of the post-remediation tree. `defaultTodoState()` uses an empty `tasks` array; `migrateLegacyIfNeeded` is exported, documented, invoked on `loadWidgets()` / error paths, and after `addWidget` when appending a new row; `addWidget` merges before a single `persistWidgets` / `renderWidgets` pass. Notes preview branches offline vs online-missing-library copy via `librariesMissingMessage` / `isDashboardOnline(dashboard)`; `marked` thenables are handled with post-resolve `DOMPurify.sanitize` and sequence invalidation in `destroy`. Edit-mode hint is in `index.html` (`.edit-mode-hint`) with matching styles in `css/style.css`; To-Do empty state uses `.todo-empty`. A **60s** `setInterval` in `js/app.js` re-runs `evaluateAllTodoResets` only when `document.visibilityState === 'visible'`, with an in-code tradeoff comment (no full dashboard remount).

**Findings**

1. **Low — Todo reset ticker while tab hidden** — The interval is not cleared when the document is hidden; it still fires every 60s and returns early. This matches the documented latency tradeoff and avoids runaway *evaluation* work, but differs from the remediation checklist’s “clear and re-arm” wording for minimal background churn.

**Update (same day, post–cycle 2):** Resolved in code — `js/app.js` now uses `_armTodoResetTicker` / `_disarmTodoResetTicker` from `visibilitychange` (arm when visible, clear interval when hidden). Cycle 2 finding 1 is **closed**.

**Second-cycle scope note:** Manual cases in the remediation “QA — second cycle re-verify” list (legacy-only `localStorage`, airplane-mode preview, midnight while focused, optional `marked.parse` Promise stub) were not executed in this static pass; they remain recommended before treating operational risk as fully retired.

### Verdict — QA remediation cycle 3 — ticker hygiene (2026-05-13)

**Pass** (static). Confirms the todo-reset interval is cleared while the document is hidden and re-armed when visible, matching the remediation checklist intent. No further code findings from this pass.

### Verdict — QA remediation cycle 4 — widget reorder, picker semantics, CSS pseudo/area checks (2026-05-13)

**Pass with notes.**

**Scope verified:** `team/assignments-qa-remediation-v2.md` against `js/app.js`, `index.html`, `css/style.css`, `team/style-guide.md`, and `team/lead-status.md`.

**Findings**

1. **Medium — malformed pseudo-element selectors**
   - `css/style.css:387` uses `::focus-visible` (invalid pseudo-element form).
   - `css/style.css:397`, `css/style.css:401`, `css/style.css:405`, `css/style.css:410` use `:::-webkit-scrollbar*` (invalid syntax).
   - **Expected:** global focus styling and scrollbar tracks to follow CSS pseudo-element syntax (`:focus-visible`, `::-webkit-scrollbar*`).
   - **Actual:** style rules are not applied by user agents, which removes a guaranteed focus indicator path for keyboard users and leaves custom scrollbar defaults in place.
   - **Owner:** Frontend Dev.

2. **Low — docs token wording drift**
   - `team/style-guide.md:90` still references `manifest.webmanifest`.
   - **Expected:** visible docs for implementation to reference current manifest source path (`manifest.json` in `index.html` and PWA wiring).
   - **Actual:** style guide text is stale from prior wording and is now out of sync with the concrete shell markup.
   - **Owner:** Frontend Dev (doc alignment).

**What passed**

- `js/app.js`: drag handle has explicit `aria-label` (`js/app.js:260`) and keyboard reorder keys (`js/app.js:498` and `js/app.js:540`).
- `index.html`: Add Widget button uses combobox controls and picker uses listbox/option roles with keyboard event handlers on open/close and activation (`index.html:124-175`, `index.html:180-183`, `index.html:141-156`, `index.html:159-173`).
- `css/style.css`: safe-area inset usage is present in shell/mobile containers and non-safe-area fallback values are included (`css/style.css:24-27`, `30-42`, `34-42`, `40-42`).
- `team/style-guide.md` and `team/lead-status.md` contain follow-up scope and result notes that match this remediated path (`team/style-guide.md:73-90`, `team/lead-status.md:140-160`).

**Interactive follow-ups (required before formal sign-off)**

- Confirm keyboard focus visibility in-browser on handle and option controls after loading in Firefox and Safari.
- Validate add-widget combobox open/close/navigation under real keyboard only flow on tabbed navigation.
- Verify custom safe-area padding under iOS standalone launch and that visible keyboard focus states are reachable in narrow layouts.

**Track closure status:** The front-end remediation track is **conditionally closed** from static review; functional sign-off remains **pending** until interactive follow-ups above are completed.

### Verdict — QA re-check (2026-05-13)

**Pass.**

**Scope verified:** remaining `team/assignments-qa-remediation-v2.md` items after the latest frontend follow-up:

- `css/style.css` pseudo-element normalization
- `team/style-guide.md` manifest filename wording alignment
- picker semantics and drag-handle accessibility continuity checks

**Findings**

1. **No new static findings / no regressions introduced by follow-up in the above scope.**

**Validated evidence**

- `css/style.css:456` uses valid `:focus-visible`; `css/style.css:466-481` use valid `::-webkit-scrollbar*` selectors, so malformed selector regressions are resolved.
- `team/style-guide.md:90` now references `manifest.json` and matches current `index.html` PWA wiring.
- `index.html:124-175` keeps the add-widget combobox/listbox contract introduced for cycle 4.
- `js/app.js:268-276` keeps icon-only drag handle controls with `aria-label`; `js/app.js:512-552` keeps keyboard reorder controls unchanged.

**Interactive follow-up reminder (unchanged)**

- Confirm keyboard-visible focus and add-widget flow behavior on real browsers (`Firefox` and `Safari`) and `iOS` standalone keyboard/safe-area paths before final launch sign-off.

**Close recommendation**

- Remediation cycle re-check is complete for static verification and is ready for Team Lead sign-off, with only the previously defined interactive follow-ups remaining.
