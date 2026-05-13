# QA remediation — Notes & To-Do (v1)

**Date:** 2026-05-13  
**Source:** `team/qa-complete-v4.md` — **Verdict — Notes & To-Do (static review 2026-05-13)** (findings 1–6 and Human-friendliness gaps).  
**Owner:** Frontend Dev (implementation); QA (second-cycle verification).

---

## TL;DR

QA signed off **Pass with notes** on static review and asked for a small remediation pass: clearer **preview messaging** when Markdown libraries cannot load (offline vs still loading), **legacy `localStorage` migration** when the user creates their first Notes/To-Do widget after an initial load with no target, a **neutral default To-Do list** (no misleading seed task), optional **midnight-boundary coverage** for long focused sessions (with documented tradeoffs), **edit-mode copy** so resize/rename are discoverable, and **defensive handling** if `marked` ever returns a Promise. Human-friendliness follow-through aligns preview fallbacks and resize discoverability with the supplement’s UX expectations.

---

## Frontend Dev — ordered checklist

Complete in order unless a later item depends on an earlier merge (e.g. store API for notes preview).

### Finding 1 — Medium: distinguish offline/blocked vs loading (Markdown preview)

**Problem:** When `marked` / `DOMPurify` are unavailable (e.g. offline + uncached CDN), `js/widgets/notes.js` can show a generic “still loading” style message that misleads users.

**Actions:**

1. **`js/widgets/notes.js`** — When preview libraries are missing or preview cannot run, branch messaging:
   - If `navigator.onLine === false` (or, when the widget receives dashboard context, `dashboard.online === false` from Alpine in `js/app.js` / `index.html`), show copy that states **offline or network blocked** and that preview needs the libraries (suggest coming back online or self-hosted assets later if product allows).
   - If online but libraries not yet present, keep or refine a **genuine loading** message.
2. **`js/app.js`** — If notes preview currently has no access to app `online` state, pass a minimal flag or object into the notes widget factory / init (same pattern as other shell state) so `notes.js` can prefer `dashboard.online` over raw `navigator.onLine` when both exist (optional enhancement; `navigator.onLine` remains the baseline per QA).
3. **`index.html`** — Only if copy is centralized in markup; otherwise keep strings in `notes.js` for consistency.

**Reference files:** `js/widgets/notes.js`, `js/app.js`, `index.html` (optional).

---

### Finding 2 — Medium: legacy keys — run migration when user adds first `notes` / `todo` after load

**Problem:** `migrateLegacyIntoWidgets` in `js/store.js` leaves legacy `calvybots_notes` / `calvybots_todo` keys when no matching widget row existed at migration time; adding the first widget later may skip merging unless migration runs again.

**Actions:**

1. **`js/store.js`** — Export a small **idempotent** helper (e.g. `migrateLegacyIfNeeded(widgets)` or re-invoke existing `migrateLegacyIntoWidgets` with the **current** widget list after mutations) and ensure it runs:
   - On existing load path (unchanged), **and**
   - After **add** of a widget whose `type` is `notes` or `todo` (first instance or any add—helper should no-op when nothing to merge).
2. **`js/app.js`** — After `addWidget` / persistence path that appends a new `notes` or `todo` widget, call the helper before or after `saveWidgets` per your single source of truth (avoid double saves; one clear code path).
3. **Comments** — One line in `js/store.js` documenting that legacy keys may exist until first widget of that type exists, then merge once.

**Reference files:** `js/store.js`, `js/app.js`.

---

### Finding 3 — Low: default To-Do list empty or neutral (remove misleading seed task)

**Problem:** `defaultTodoState()` seeds a task like “Add your first task,” which reads as real work.

**Actions:**

1. **`js/widgets/todo.js`** or **`js/store.js`** (whichever owns `defaultTodoState`) — Remove the starter task; use an **empty** `items` array (or a single neutral placeholder only if product insists—prefer empty + good empty-state UI).
2. **`js/widgets/todo.js`** / **`css/style.css`** — Ensure empty-state copy remains helpful (already a strength per QA); no regression in layout for zero items.

**Reference files:** `js/widgets/todo.js`, `js/store.js`, `css/style.css` if empty-state tweaks.

---

### Finding 4 — Low: optional periodic check while tab visible (midnight boundary)

**Problem:** Reset evaluation runs from `loadWidgets()` / `evaluateAllTodoResets` and `visibilitychange`; if the tab stays visible past midnight without navigation, resets may not run until the next load/visibility event.

**Actions:**

1. **`js/app.js`** — Optionally add a **visible-tab** interval (e.g. **60s**) that calls the same reset evaluation used on load/visibility, **cleared** when `document.visibilityState !== 'visible'` and re-armed when visible again.
2. **Tradeoff (document in code comment or this file)** — Interval reduces surprise at midnight but adds a tiny wake-up cost and is still clock-skew / DST–sensitive; shorter intervals are smoother but noisier. Product default: **60s** is a reasonable balance; QA documents expectation in second cycle.
3. Do **not** force full dashboard remount; reuse existing evaluation function.

**Reference files:** `js/app.js`; `js/store.js` if evaluation lives there (call only).

---

### Finding 5 — Low: edit-mode hint for resize/rename discoverability

**Problem:** Resize is gated on edit mode; users who expect resize outside Edit have no in-UI hint (Human-friendliness gap).

**Actions:**

1. **`index.html`** — Add a **short** banner, helper line near the edit toggle, or footnote in the existing offline/edit strip pattern: e.g. “**Edit mode:** drag corners to resize widgets; click titles to rename.” Keep accessible (not hover-only); one sentence preferred.
2. **`css/style.css`** — Minimal styling if new banner needs spacing/contrast to match dashboard tokens.
3. Avoid duplicating long help; align tone with existing recurrence / schedule copy.

**Reference files:** `index.html`, `css/style.css` (as needed).

---

### Finding 6 — Low: guard `marked` if it returns a Promise (async API)

**Problem:** Preview assumes synchronous HTML from `marked.parse`; a future major could return a `Promise`.

**Actions:**

1. **`js/widgets/notes.js`** — After calling `marked.parse` (or equivalent), if result is a **thenable**, `await` in an async path or attach `.then()` and re-render preview on resolve; handle reject with plain-language error state (no throw to console as only UX).
2. Ensure **sanitize** step still runs on resolved HTML before `innerHTML` (order unchanged: parse → sanitize → assign).
3. No version pin change required unless lockfile/package policy demands it; this is defensive coding.

**Reference files:** `js/widgets/notes.js`.

---

## Definition of done (this remediation pass)

- All six finding areas above are addressed in code with **no new High** regressions; behaviour matches bullets in this doc.
- Legacy storage: adding the first Notes or To-Do widget after a session with only legacy keys **merges and removes** legacy keys when data exists (manual spot-check or QA second cycle).
- Preview: offline vs loading messages are **visibly distinct**; online + missing CDN still explained without claiming “loading” forever.
- Default To-Do: **no** misleading seed task; empty state remains clear.
- If interval is implemented: runs only while tab **visible**, documented tradeoff; no full remount.
- Edit mode: **one** clear hint for resize + rename discoverability.
- `marked` Promise path does not blank preview silently or execute unsanitized HTML.

---

## QA — second cycle re-verify

1. **Finding 1:** Airplane mode / offline after cached shell — open Notes preview; confirm messaging is **not** generic “loading” when permanently blocked; online refresh restores preview when CDN loads.
2. **Finding 2:** Seed `localStorage` with legacy-only keys, zero widgets; reload; **add** first Notes and first To-Do; confirm legacy content appears in new instances and legacy keys **cleared** after save.
3. **Finding 3:** New default To-Do widget shows **no** fake starter task; empty state still usable.
4. **Finding 4 (if shipped):** With tab focused past local midnight (or dev clock skew), confirm reset still evaluates without reload; confirm no runaway timers when tab hidden.
5. **Finding 5:** First-time user path: read edit-mode hint; enter edit mode; confirm resize/rename match hint.
6. **Finding 6:** If feasible, temporarily stub `marked.parse` to return a resolved Promise in dev tools or branch build; preview still sanitizes and displays (or document manual reasoning if stub impractical).
7. **Human-friendliness:** Re-run supplement bullets in `team/qa-complete-v4.md` (**Notes & To-Do widgets — QA acceptance**) for regression: multi-instance, rename, markdown, mobile/narrow, recurrence labels unchanged in spirit.

---

**Handoff:** Team Lead — track in `team/lead-status.md` under **QA remediation delegation (2026-05-13)**.
