## Assignments — Footer live sync debug strip

### Date
2026-05-13

### Track
Footer telemetry strip for server sync state (debug visibility)

### Owner
Frontend Dev

### Status
Delegated

### Context
Client wants the current footer ("Calvy Launchpad") replaced with a readable, always-visible sync debug strip that summarizes server sync state for layout changes and retrieval behavior. The strip should run in the same Alpine `launchpad` scope and be useful during debugging without changing event bus or widget contracts.

### Files touched
- `index.html`
- `js/app.js`
- `css/style.css`
- `team/style-guide.md` (if footer style/behavior is introduced, include token references and component behavior)
- `team/assignments-footer-debug-strip.md` (this assignment)
- `team/lead-status.md` (status update from Team Lead)

### Working constraints
- Keep static-first behavior and no build steps.
- Update only within static frontend files. Do not modify `js/event-bus.js`, `js/widget-registry.js`, `js/config-loader.js` for this track.
- Footer must remain inside the existing `x-data="launchpad"` scope.
- Do not alter synchronization semantics unless explicitly required.
- Keep existing `WIDGET_SYNC_DEBOUNCE_MS` / `WIDGET_SYNC_PUSH_MS` / `WIDGET_SYNC_POLL_MS` semantics as baseline.

### Task breakdown

1. **Shell rendering**
   - Replace/extend `index.html` footer text with an Alpine-driven strip showing:
     - Last sync timestamp (human readable)
     - Sync pending vs synced flag
     - Countdown to next outbound sync attempt
     - Last sync result state (`success`, `failed`, `skipped`, etc.)
     - Countdown to next retrieve/reconcile (or explicit "not applicable" if this track only supports bootstrap reconcile)
   - Ensure the strip is readable on small screens and visible in both Home and Tools contexts.

2. **State instrumentation in `js/app.js`**
   - Add explicit tracking fields for debug status such as:
     - last retrieve timestamp
     - last push timestamp
     - last push result state / reason
     - whether pending local edits exist (`_widgetsNeedSync` / debounce timer context)
     - next-deadline estimates for debounced sync and periodic push
     - next retrieve deadline according to current reconcile policy
   - Keep current interval and timer behavior:
     - Debounced outbound sync: `WIDGET_SYNC_DEBOUNCE_MS` (350ms)
     - Periodic outbound push loop: `WIDGET_SYNC_PUSH_MS` (3000ms)
     - Poll/retrieve timer variable remains 4000ms but note reconcile is bootstrap-only when `trigger === "init"` in current code.
   - Ensure `_widgetsSyncInFlight`, `_widgetsSyncTimer`, `_widgetsSyncPushTimer` changes continue to control outbound behavior.
   - Update the existing sync hooks (`reconcileServerWidgets`, `syncToServer`, `flushWidgetsBeforeExit`, online/offline handlers) to populate the new footer state values:
     - `reportWidgetSyncRetrieve` / push events should map to debug strip outcomes.
     - distinguish skipped attempts (offline, no timer queued, etc.) from failed attempts.

3. **Human-readable countdown logic**
   - Compute countdown strings for UI display from absolute deadlines.
   - If `_widgetsSyncTimer` is active, show time to debounced PUT.
   - If timer is not active but `_widgetsNeedSync` is true, show time to next periodic push tick.
   - If no pending changes, show "idle" for next sync.
   - For retrieve:
     - if current code path remains bootstrap-only, show explicit state (e.g., "none / bootstrap only").
     - if periodic reconcile is enabled, show countdown from next poll baseline.

4. **Readability / accessibility polish**
   - Add concise status labeling and color treatment using existing tokens (`text-2`, `text-3`, `accent`, danger/success states).
   - Keep line-height/contrast for one-line-at-bottom readability.
   - Include `aria-live` region or clear non-live labels to avoid noisy announcements.

### Acceptance bullets

1. Footer shows one line (or compact two-line wrap) containing:
   - Last synced/retrieved timestamp in human readable format.
   - A sync flag showing local dirty state (`synced`, `pending`, `uploading`).
   - Time remaining to outbound sync attempt (debounced first, then periodic push fallback).
   - Last sync result category with detail (`success`, `failed`, `skipped`).
   - Time remaining to next retrieve/reconcile or explicit `not-applicable` note.

2. Semantics mapping:
   - `last synced` updates on successful GET apply/reconcile and successful PUT responses.
   - `pending/local dirty` becomes true on `persistWidgetsDeferredSync` and is true while `_widgetsNeedSync`.
   - `skipped` appears when sync path is intentionally not executed (e.g., offline and dirty changes exist, or startup without initial server fetch due offline).
   - `failed` includes error message summary.

3. Timers:
   - Debounced outbound sync still runs after local edit with `WIDGET_SYNC_DEBOUNCE_MS`.
   - Periodic push timer still runs on visible/online state at `WIDGET_SYNC_PUSH_MS`.
   - Footer countdown reflects actual scheduled outbound attempt using timer deadlines.
   - Offline mode halts outbound timer behavior and strips states indicate "waiting".

4. Integration constraints:
   - No event bus or cross-module new dependency wiring.
   - No structural rewrite outside `index.html`, `js/app.js`, `css/style.css` (+ docs).
   - Footer stays inside Alpine root or nested explicit `x-data` scope.

### QA passback checklist
- Static review by Frontend for correctness of deadline math and timer edge cases:
  - immediate edit -> debounced countdown appears
  - after debounce window -> pending periodic tick countdown
  - online PUT success -> status transitions to synced
  - forced offline -> pending + skipped reason
  - repeated save during in-flight -> state remains coherent
- Interactive follow-up for layout:
  - readable on mobile widths
  - no clipping in landscape/portrait
  - no Alpine boundary violations with footer bindings

### Definition of done
- All acceptance bullets are verifiable in `index.html`, `js/app.js`, and `css/style.css`.
- `team/style-guide.md` receives sync-strip note if any new visual pattern or token usage is introduced.
- `team/lead-status.md` references this assignment and delegation status.
- Delivery includes no functional change to sync semantics unless documented in this scope.
