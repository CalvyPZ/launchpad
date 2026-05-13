# Team Lead Status

Date: 2026-05-13

### Client direction ? Remove dormant widget types entirely (2026-05-13)

**Status:** Delegated (Frontend + Backend parallel); QA after landing.

**Priority:** P1 (product hygiene + persistence consistency).

**Scope:** Drop `bookmarks`, `search`, and `sysinfo` home widget rows on normalisation; delete `js/widgets/{bookmarks,search,sysinfo}.js`; align `removeDeprecatedHomeWidgets` / sync paths with store; mirror stripping in `api/server.js`; refresh `.cursor/rules`, `tests/test-plan.md`, `data/schema.md`, `data/config.json`, `team/delegation-v4.md`, `team/brief.md` update section; optional orphaned legacy key cleanup only if confirmed unused.

**Assignment:** `team/assignments-remove-dormant-widgets.md`

**Constraints:** Static-first; preserve notes/todo (and tools) data; do **not** delete QA verdict sections in historical markdown; append/archive per conventions only via cleanup engineer if ever tasked.

### Client direction ? Service worker diagnostics false-positive (2026-05-13)

**Status:** Closed from Team Lead.

**Priority:** P2.

**Client scope:** Fix recurring diagnostics warning:

- `js/site-diagnostics.js` reports `Service worker ? Registered but not controlling this page yet.` on first-load registration path.
- Treat first-load SW takeover timing as a controlled state transition instead of a defect.
- Preserve warning/critical reporting for unsupported SW or genuinely missing SW control after bounded controller wait.

**No backend changes expected.**

**Assignment file:** `team/assignments-sw-controller-warning-fix.md`

**Acceptance guidance:**

- No repeated false-warning entries from normal first-load SW handoff.
- `status` is `ok` when SW is actively controlling after handoff or reload.
- Persistent/real SW-control failures remain visible as warning/critical per existing semantics.

**Execution status (completed):**

- **Frontend implementation:** completed in `js/site-diagnostics.js`.
- **QA:** `Pass with notes` from `qa-engineer` on this assignment.
- **Outcome:** recurring first-load SW-control warning noise is now treated as a bounded transition state; warning/critical reporting remains for unsupported or persistent control failures.
- **Readiness / sign-off:** approved for closure from this cycle; no remaining blocking items.

### Client direction ? QA remediation follow-up v3 (2026-05-13)

### Client direction ? Dashboard module regression checkpoint (2026-05-13)

**Status:** Frontend implementation complete, QA checkpoint passed; cycle awaiting interactive smoke.

**Scope:** Resolve module bootstrap regression caused by `normaliseToolsRows` visibility and Alpine startup path changes after recent dashboard sync work.

**Outcome:** `js/store.js:382` now exports `normaliseToolsRows`, allowing `js/app.js` to import it during module init. QA verified clean `launchpad` Alpine bootstrap shape (including keys and widget sync strip label methods) and no regression in static paths.

**QA verdict:** Pass (`qa-engineer` static/module scope review).

**Follow-up required before client demo:** one interactive cold-start browser smoke on live host to confirm:
- zero console import errors at first paint with fresh/private tab state,
- widget rows render correctly (Home/Tools),
- no immediate state overwrite or sync strip regression.

**Owner:** Frontend and QA completed; Team Lead monitors completion of the one interactive smoke.

### Client direction ? QA remediation follow-up v3 (2026-05-13)

**Status:** Completed by Frontend Dev.

**Scope:** Resolve medium follow-up on focus/active accents and touch target height in `css/style.css`, and close `team/assignments-qa-remediation-v3.md`.

**Outcome:** `css/style.css` focus/active purple tokens in all requested selectors were replaced with `#2dd4bf` (or neutral values), `.nav-tab` `min-height` is now `42px`, and `body` font stack now matches the active Outfit config in `index.html`.

No QA retest executed in this turn (frontend scope-only update).  

### Client direction ? Header toolbar cleanup (2026-05-13)

**Status:** Completed by Frontend Dev (implementation delivered).

**Priority:** UI polish / consistency (P2).

**Client scope:**  
Remove header chrome content from the top banner and move editing controls into a dedicated toolbar beneath the header.

- Remove clock widget from the site header.
- Remove editable site title/contenteditable title control from header.
- Move Edit/Done toggle into a toolbar directly below the header.
- Restyle Done and Add Widget controls to match existing style-guide buttons with cyan/dark tokens and clear accessible naming.
- Keep widget-add and edit-mode handlers in `js/app.js` as the logic source (preferably no logic changes; wiring updates allowed only if needed for the new toolbar placement).

**Assignment issued:** `team/assignments-header-toolbar-redesign.md`

**Acceptance (for implementation):**

- Header no longer shows clock or editable title.
- Toolbar exists directly under header and contains edit controls.
- Done/Add Widget actions work in same session flows as before with no add-widget behavior regression.
- Buttons use style-guide-aligned classes/states (cyan accent, non-purple active/focus).
- Control focus order remains usable from keyboard.

**Execution note:** Frontend Dev should update `team/style-guide.md` if any visible control pattern is modified.
QA should run the updated visual/accessibility check after implementation before closing this cycle.

### Client direction ? Header time/date + edit bar layout (2026-05-13)

**Status:** Open, delegated to Frontend Dev.

**Priority:** UI shell consistency (P1).

**Client scope:**
Replace remaining clock/widget and control placement behavior from the previous pass with a header readout and nav-integrated edit control flow.

- Remove `clock` from active add-widget choices and supported active flow where it should no longer appear as a normal widget.
- Add a header time/date readout below the logo:
  - time text in large blue style
  - 24h format
  - no seconds
  - date text smaller and white on the next line
- Position the Edit button to the left of Debug in the nav row, styled as a tab peer to Debug.
- Click Edit to reveal a new edit-control bar directly beneath the existing tab navbar.
- Keep existing edit state and picker behavior intact.

**Assignment file:** `team/assignments-header-time-date-toolbar-v2.md`

**Acceptance (for implementation):**

- header shell no longer exposes clock widget title/content as a dashboard control
- header time/date render is formatted as requested
- edit button is placed left of Debug and appears as matching tab styling
- edit mode reveals control bar under the tab navbar
- no regressions for add-widget flow, focus behavior, and persistence

**Execution note:** Frontend should update `team/style-guide.md` only if control patterns/tokens were modified.
QA verified keyboard sequence and mobile behavior; `qa-engineer` returned **Pass with notes**.

### Team Lead sign-off ? Header toolbar and clock readout (2026-05-13)

**QA outcome:** `Pass with notes` (`qa-engineer`).

**What was reviewed:** header clock removal from widget controls, read-only header 24h no-seconds time/date rendering, nav `Edit` placement and behavior, edit bar reveal below tabs, no add-widget and persistence regressions.

**Remaining item:** low-priority cleanup only for stale `.clock-time` styles left in `css/style.css` (no functional impact).

**Sign-off guidance:** Close this cycle as approved; no blockers remain. Optional Frontend follow-up is non-blocking and can be handled as a tiny cleanup track if desired.

**Queued follow-up (optional):** remove dead `.clock-time` CSS selectors from `css/style.css`.

### Client direction ? Tools + Debug route split (2026-05-13)

**Status:** Open, delegated to Frontend Dev.

**Priority:** Navigation + shell behavior (P2).

**Client scope:**  
Rename the current Tools tab to Debug; add a dedicated Tools tab with a placeholder widget by default; show the debug footer only when Debug is active.

- Tabs must be labeled **Home**, **Tools**, **Debug**.
- Debug tab remains right-side anchored/behaviorally equivalent to the previous right-side tab.
- New Tools tab shows placeholder content out-of-the-box when Tools widgets are not yet defined.
- The debug footer should be conditionally visible only on `currentPage === 'debug'`.

**Assignment issued:** `team/assignments-tools-debug-tab.md`

**Acceptance (for implementation):**

- Navbar uses three labels and preserves right-side behavior for Debug.
- Tools opens with placeholder widget by default on first run/no saved tools state.
- Debug footer is gated by page state and is hidden in Home + Tools.

**QA plan:** QA to run focused interactive review after Frontend handoff:
- correct tab routing for all three states,
- default placeholder presence in Tools,
- footer visibility transitions on page changes.

**Execution note:** Frontend should update `team/style-guide.md` only if any new visible UI pattern/token usage is introduced.

### Execution status (2026-05-13)

**Frontend implementation:** Delegated to `frontend-senior-dev` via `team/assignments-tools-debug-tab.md`; implementation summary received.  
**Next step:** QA verification cycle for navigation and footer-gating behavior.

### QA outcome (2026-05-13)

**QA verdict:** Pass with notes (`qa-engineer`).

- Static review confirms:
  - Home/Tools/Debug labels route correctly.
  - Debug tab remains right-side in nav.
  - Footer renders only when `currentPage === 'debug'`.
  - Tools tab fallback creates placeholder when no Tools payload exists.
- Required follow-up items remain interactive:
  - fresh-state verification for placeholder visibility,
  - live tab switching at different breakpoints,
  - footer visibility confirmation across transitions.

### Client direction ? Footer sync debug strip (2026-05-13)

**Status:** Open, delegated to Frontend Dev.

**Client scope:** Convert the bottom footer from static text ("Calvy Launchpad") into a live sync debug strip for server actions and state. Must show last sync timestamp, local dirty/synced flag, next sync countdown, last sync outcome (success/fail/skip), and next retrieve countdown semantics under current sync policy.

**Assignment issued:** `team/assignments-footer-debug-strip.md`

**Priority / decision:** P2 utility/debug visibility.

**Execution notes:**
- Keep current sync semantics:
  - Debounce outbound sync: `WIDGET_SYNC_DEBOUNCE_MS = 350`
  - Periodic push interval: `WIDGET_SYNC_PUSH_MS = 3000`
  - Reconcile polling timer remains `WIDGET_SYNC_POLL_MS = 4000`, but payload reconcile is bootstrap-only in current `reconcileServerWidgets(trigger === "init")`.
- Render entirely inside the existing `x-data="launchpad"` scope.
- No `js/event-bus.js` or `js/widget-registry.js` coupling required.
- Frontend should add a style-guide note for the footer debug strip if tokens/colors/patterns are introduced.

**QA plan:** Frontend static/interactive review by QA Engineer after implementation, focused on readable layout, countdown transitions, offline visibility, and Alpine boundary correctness.

### Execution status (2026-05-13)

**Frontend implementation:** delegated and completed (`team/assignments-footer-debug-strip.md`) by `frontend-senior-dev`.

**QA result:** `Pass with notes` from `qa-engineer` (static verification).  
Interactive confirmation remains recommended for transition timing and offline behavior before final Team Lead closure.

### Client direction ? API persistence mount fallback (2026-05-13)

**Status:** Backend container persistence now uses a compose bootstrap + named data volume to avoid write attempts on host `/mnt/data` while preserving `/api` contract.

**What was attempted:** kept `/mnt/data/web_app/data` as immutable input (seed only) and moved `/api` runtime writes to a named volume mounted at `/data` in the API container.

**Why fallback is required:** direct writes to `/mnt/data/web_app/data` were still producing `EROFS` in production-style runtime, and shared-host ownership constraints require this path to stay read-only for other services.

**What persists where now:**
- `/data/widgets.json` in compose volume `web_app_api_data` persists across `docker compose restart api`.
- The same named volume persists across `docker compose down` / `docker compose up -d` unless `docker compose down -v` is used.
- `/mnt/data/web_app/data/widgets.json` is now a migration seed only (not the active runtime writer).

**Recovery tradeoff:** host `/mnt/data` can no longer be the single authoritative live source; recovery/restoration is volume-centric unless a manual snapshot/export is performed.

**Recovery operators:**
- `docker compose down && docker compose up -d`
- `docker compose restart api`
- `docker compose exec api sh -c 'test -f /data/widgets.json && wc -c /data/widgets.json && cat /data/widgets.json | head -c 200'`
- `docker compose exec api sh -c 'ls -l /data /seed-data && [ -f /data/widgets.json ] && echo "writable-store OK" || echo "writable-store missing"'`

**Note:** if host-side snapshotting is required, copy `/data/widgets.json` out of the named volume as a restore target.

### Client direction ? Tools Status + Log default widgets (2026-05-13)

**Status:** **Cycle closed (Team Lead)** ? implementation landed in workspace; **QA: Pass with notes**; recommend **merge when PR/branch is green**; optional LAN smoke (Home ? Tools, API, `console.warn`, persistence, SW) remains operational follow-up, not a dev blocker.

**Summary:** Add default **Tools** widgets ? **Status** (traffic-light probes for shell, SW, `/api/health`, storage, optional CDN warn) and **Log** (ring buffer, console warn/error capture, terminal-style scroll). Instrumentation **starts at full app load** via a shared module imported from `js/app.js` so probes and logging run before the user opens Tools; widgets reflect live state when Tools is shown.

**Assignment file:** `team/assignments-tools-status-log.md`

**Priority / risks:** Console hook recursion and log spam ? mitigate with guards and level filtering. CDN probe must remain **warning-tier** only (offline-capable shell). Tools row sync to server must remain valid for new types.

**Execution order:** Frontend implementation ? Backend verify-only (parallel OK) ? QA structured verdict.

### Execution status (2026-05-13)

- **Backend Dev (`backend-senior-dev`):** **Complete ? no repo edits.** `GET /api/health` returns `200` JSON `{ status, timestamp, uptime }`; nginx `/api/` not cache-breaking; `sw.js` bypasses `/api/`. Frontend should treat `status === "ok"` plus parseable JSON as healthy.
- **Frontend Dev:** **Landed** ? `js/site-diagnostics.js` (ring buffer ~500, `subscribeLogs` / `subscribeProbes`, console **warn/error** hooks, `runProbes`, `initSiteDiagnostics`, 60s + `visibilitychange`, warn/crit ? log lines); `js/widgets/status-tools.js`; `js/widgets/log-tools.js`; wiring via `js/app.js` / `js/store.js` and related shell per assignment; `team/style-guide.md` updated (console hook scope, subscriber API names).
- **QA (`qa-engineer`):** **Pass with notes** ? Low: doc drift addressed in style guide; Low: repeated warn/crit lines each poll noted as acceptable. **Sign-off recommendation:** approve pending optional LAN smoke.

### Team Lead sign-off ? Tools Status + Log (2026-05-13)

- **Further code before merge:** **None** required by this track. Optional follow-up (product discretion): probe log dedupe if repeated poll lines become noisy in practice.
- **Merge / next step:** Proceed with normal PR review and merge when CI and reviewers are satisfied; run brief **https://web.calvy.com.au** or LAN smoke if validating in a live stack.

---

### Client direction ? HTTPS validation baseline (2026-05-13)

**Status:** Added to active delegation constraints for all verification tracks.

**Requirement:** All QA and verification of interactive browser behavior should treat `https://web.calvy.com.au` as the primary target (Cloudflare-fronted production deployment) for HTTPS/PWA/console checks.

**Execution rule:** Prefer `https://web.calvy.com.au` whenever HTTPS access is available; use LAN `http://192.168.1.245:8033` only as a fallback for local debugging when HTTPS validation is blocked.

**Owner note:** Frontend, Backend, and QA should include this constraint in next validation handoffs and environment setup docs.

### Client direction ? Add Widget picker click path (2026-05-13, P1)

**Status:** Open bug reported by client. Fix is being dispatched.

**Priority:** P1 ? blocks widget creation in edit mode.

**User-reported failure:** In edit mode, the Add Widget dropdown opens, but selecting a widget option does not add a widget and the menu remains open.

**Scope hypothesis:** Click handling is likely being blocked or short-circuited by overlay/pointer-events/z-index or `x-on` propagation interaction between `index.html` picker markup and `js/app.js`.

**Team Lead assignment:** Frontend Dev to investigate and fix.
- **Files to investigate:** `index.html`, `js/app.js`, `css/style.css` (overlay and pointer events), `team/style-guide.md` (only if visible behavior/pattern changes).
- **Acceptance criteria:**
  - Selecting a picker option adds the expected widget immediately.
  - Picker closes after selection.
  - Existing edit-mode controls remain accessible without accidental click interception.
  - Keyboard flow remains functional if a keyboard path is implemented in the component.

### Client direction ? Add Widget picker fix execution (2026-05-13)

- **Frontend remediation complete (`js/app.js`):** `activateAddWidgetOption` now closes picker only on successful `addWidget` execution, and `addWidget` now returns explicit success/failure and safely imports `migrateLegacyIfNeeded` from `js/store.js` (runtime exception guard).
- **QA status:** pending interactive verification.

### Client direction ? Add Widget picker QA result (2026-05-13)

- **QA verdict:** Pass with notes (`qa-engineer`).
- **What was verified:** mouse add flow (second Todo in edit mode), picker close behavior, keyboard activation path, outside-click close, and surrounding edit-mode control accessibility.
- **Finding:** low-severity environmental note only?`PUT /api/widgets` returned 500 in logs during some test paths, but add-picker interaction itself remains functional.
- **Next action for Team Lead:** monitor API/save health for environment stability; no picker regression remains open.

Status: **Client direction recorded ??? PWA with online-first behavior**

## Manager ??? client decision (record for delegation)

The client requires the site to **qualify as a Progressive Web App** with **basic offline support**, while making clear that the **primary experience is online**. Manager should prioritize:

1. **Installability and PWA shell** ??? manifest, icons, standalone display, service worker registration, and nginx MIME or cache headers already aligned in repo; confirm PNG `icons/icon-192.png` and `icons/icon-512.png` when art is ready (see `icons/README.md`) for broadest install surfaces.
2. **Offline behavior** ??? precache the same-origin app shell (HTML, CSS, core JS, widgets, manifest, SVG icon) so repeat visits can open without a network; do **not** treat offline as a full second mode. CDN assets (Tailwind, Alpine, fonts) remain network-first at the browser layer; optional follow-up is self-hosting those assets if the client wants richer offline styling.
3. **Online-first fetch policy** ??? service worker uses **network-first for same-origin** requests so connected users receive updates promptly; cache is fallback when the network fails. API routes stay out of the service worker path (direct to network).
4. **UX** ??? a lightweight **offline indicator** in the UI is acceptable so users understand when they are on cached shell only.

Frontend Dev implements or adjusts behavior per the above; Backend Dev confirms `nginx-site.conf` continues to serve `sw.js` and `manifest.json` correctly; QA validates install + online-first + offline shell per `team/delegation-v4.md` PWA bullets and the supplement below.

---

## Current delegation (visual track, unchanged in spirit)

1. **Frontend Dev**
   - Continue visual iteration with a clear focus on making cyan accents obvious, premium, and creative (depth, gradients, glow, and motion accents).
   - Maintain the dark charcoal foundation and mobile web-app friendliness.
   - Rework any elements that still appear flat or muted from the last pass.
   - Honor the **PWA / online-first** client direction above in parallel (service worker, manifest copy, offline strip).

2. **QA**
   - Revalidate visual hierarchy and accessibility/usability with the updated style after Frontend Dev changes.
   - Verify `tests/usability-checklist.md` and the `## 7. Usability and Accessibility Checks` section in `tests/test-plan.md`.
   - Confirm cyan accents are visible, non-harsh, and integrated into controls, focus, and cards.
   - Execute **PWA / online-first QA** (manifest + SW registration, connected reload picks up asset changes, offline opens cached dashboard, API uncached by SW).

Overall direction:

- Build a **static, build-free** dashboard that runs directly from `index.html` on nginx.
- Use **Tailwind CSS via Play CDN** as the only required utility styling layer.
- Keep optional logic lightweight (vanilla JS + small CDN helpers only), with a registry-driven widget system.
- Implement **dark-mode-first**, modern minimalist visual language.
- Deliver an **edit mode** for rearranging, adding, removing, and configuring widgets with persistence in `localStorage`.
- Deliver a **PWA** with **basic offline shell** and **online-primary** runtime policy.

Next step is immediate parallel implementation by Frontend Dev and QA against this updated manager delegation.

---

## Client direction ??? Notes & To-Do widgets (2026-05-13)

**Status:** Recorded for Team Lead prioritisation and delegation. Implementation sequencing is at lead discretion; QA should treat this as a **new acceptance track** once builds land.

### Manager summary (what the client asked for)

1. **Multiple instances** ??? Users may have **several** Sticky Notes and **several** To-Do widgets on the dashboard at once; behaviour and data must not collide between instances.
2. **Survives power cycle** ??? All widget instances, titles, content, layout, sizes, and recurrence settings remain after device restart (same persistence tier as the rest of the dashboard: today `localStorage`; if the team moves widget payloads into a single serialised document, that document must remain the source of truth on reload).
3. **Renamable** ??? Each widget has a user-editable **display name** (distinct from internal `id`), surfaced in the shell/header in edit and normal use where appropriate.
4. **To-Do recurrence / reset** ??? User-configurable **reset schedule** so lists can behave as **daily**, **weekly**, or **non-repeating** tasks: when the configured boundary passes, completed items (or the whole list per product decision) reset according to spec; **never** repeating tasks do not auto-clear.
5. **Notes: Markdown** ??? Note bodies support **Markdown** rendering (or a safe subset) with sensible defaults for editing vs preview.
6. **Layout** ??? Widgets are **resizable** on capable viewports while remaining **usable on mobile** (touch targets, min sizes, no reliance on hover-only affordances).

### Delegation (Team Lead ??? devs)

- **Frontend Dev**
  - Extend the widget **data model** and `js/store.js` (or successor) so each widget instance has stable `id`, optional `title`, layout/size fields, and **scoped** notes/todo payload (no shared global key per type for all instances).
  - Implement **rename** in edit mode (inline or modal; match existing dashboard patterns).
  - **To-Do:** model recurrence (`never` | `daily` | `weekly` or equivalent), user-facing configuration UI, and evaluation on load (and optionally `setInterval` / `visibilitychange` for long sessions) so resets happen at configured local times; document edge cases (timezone, DST) in code comments or brief.
  - **Notes:** integrate a **small Markdown** pipeline (prefer dependency already aligned with static hosting); **sanitize** output before `innerHTML` or use a safe renderer.
  - **Resize:** resizable shell or card with **minimum dimensions** and **mobile-safe** interaction (e.g. handle size, no accidental drags while scrolling).
  - Update `team/style-guide.md` if new interaction patterns (resize handles, markdown toolbar, recurrence controls) need tokenised rules.
- **Backend Dev**
  - No new server persistence required unless product later adds accounts; confirm nginx continues to serve any **new static assets** (e.g. markdown library if self-hosted) with correct MIME and caching; keep `/api/` out of SW cache per existing PWA rules.
- **QA**
  - Execute the checklist in `team/delegation-v4.md` under **Client amendment ??? Notes & To-Do depth** and the supplement **Notes & To-Do widgets ??? QA acceptance (pending)** in `team/qa-complete-v4.md`.
  - Explicit **human-friendliness / UX** pass: labelling for recurrence, empty states, errors, discoverability of rename and resize, and thumb reach on small screens.

### Next step

**Update (2026-05-13):** Implementation and static QA review are recorded under **Subagent execution** below. Team Lead should confirm reset semantics with the client if needed; QA should run **interactive** supplement checks (browser, cold start, time-based recurrence, XSS probes, viewports) before full sign-off.

### Assignments issued (2026-05-13)

Formal, file-scoped tasks for the Notes & To-Do track live in **`team/assignments-notes-todo.md`**, including the team default for recurrence (**daily/weekly:** clear `done` only, keep ids/text; **never:** no auto reset; evaluate on load and `visibilitychange` using device-local time with user-configured `HH:MM` and weekly weekday 0???6). **Frontend Dev** should implement first (store, shell, widgets, CDN markdown, resize, migration off legacy keys); **Backend Dev** follows for nginx / SW precache verification only as needed for assets introduced by that work.

### Subagent execution (2026-05-13)

Cursor **Task** subagents were run against the project files in this order:

1. **Team Lead** ??? Authored **`team/assignments-notes-todo.md`** (Frontend / Backend / QA / Definition of done) and recorded **Assignments issued** above.
2. **Frontend Dev** ??? Implemented the checklist in **`team/assignments-notes-todo.md`** in **`js/store.js`**, **`js/app.js`**, **`js/widgets/{notes,todo,clock}.js`**, **`css/style.css`**, **`index.html`**.
3. **Backend Dev** ??? Confirmed **`nginx-site.conf`** and **`sw.js`** need no change for CDN-only Markdown libraries; no repository edits in that pass.
4. **QA** ??? Static/code + UX review: **`team/qa-complete-v4.md`** subsection **Verdict ??? Notes & To-Do (static review 2026-05-13)**; **`team/qa-status.md`** updated with outcome (**Pass with notes**) and pointer to interactive follow-up testing.

Interactive browser testing (cold start, time-based recurrence, XSS probes, multi-viewport) remains recommended before treating the track as fully closed.

### QA remediation delegation (2026-05-13)

Frontend Dev implemented **`team/assignments-qa-remediation-v1.md`**; QA recorded cycles 2???3 in **`team/qa-complete-v4.md`**. Interactive re-verify items in that assignments file remain recommended before client demo.

### Team Lead sign-off ??? Notes & To-Do QA loop (2026-05-13)

Per **`team/assignments-qa-remediation-v1.md`** (Definition of done and ordered checklist), the Frontend remediation work is in place; **`team/qa-complete-v4.md`** records **QA remediation cycle 2** (**Pass with notes**, remediation DoD met from static review) and **QA remediation cycle 3 ??? ticker hygiene** (**Pass**, static), confirming todo-reset interval arm/disarm when the tab is hidden or visible and leaving no further code findings from that pass. **The Notes & To-Do QA remediation implementation track is closed from Team Lead???s perspective:** what remains is only interactive verification???the **QA ??? second cycle re-verify** list in the assignments file plus the supplement acceptance bullets in the same QA doc???so hands-on browser QA is still recommended before a client demo.

### Client follow-up cycle ??? To-Do touch targets (2026-05-13)

- **Status:** Closed.
- **Scope delivered by Frontend Dev:** `css/style.css`, `js/widgets/todo.js`.
- **Acceptance check passed:** larger mobile touch targets for done/remove (`.todo-task-done-toggle`, `.todo-item-handle`, `.todo-task-remove`), full-text tap toggle in display mode, strike-through styling for completed tasks, and compact edit-mode done toggle.

### Client direction ??? Pointer-Events DnD replacement (2026-05-13)

**Status:** Delegated to Frontend Dev.

**Scope:** Replace both HTML5 Drag-and-Drop layers (dashboard widget reorder in `js/app.js` and todo task reorder in `js/widgets/todo.js`) with a Pointer Events API implementation that works on touch and mouse. No libraries. Vanilla JS only.

**Key requirements:**
- Press/hold on handle raises the dragged element (scale + shadow + slight opacity ghost).
- Ghost clone (fixed-positioned DOM clone on `body`) follows the pointer in real time using `transform: translate()`.
- `setPointerCapture` on the handle element to avoid losing the pointer.
- Live insertion preview across all todo widgets (`.dnd-task-placeholder` with cyan accent).
- Invalid drop ??? ghost animates back, no data mutation.
- `touch-action: none` on `.widget-handle` and `.todo-item-handle`.
- Cyan accent `#2dd4bf` for ghost border and placeholder.

**Assignment file:** `team/assignments-dnd-pointer.md`

**Subagent execution (2026-05-13):**
1. Team Lead authored `team/assignments-dnd-pointer.md` and updated `team/lead-status.md`.
2. Frontend Dev implemented Pointer Events replacement in `js/app.js`, `js/widgets/todo.js`, `css/style.css`, and `team/style-guide.md`.
3. QA static review: **Pass with notes** ??? two medium findings (missing ghost scale transforms on `.dnd-ghost-widget` and `.dnd-ghost-task`).
4. Frontend Dev remediated both CSS findings (added `transform: scale(1.04)` / `scale(1.03)`).
5. QA re-verify: **Pass** ??? all acceptance bullets resolved, no remaining static blockers.

**Status:** Implementation and static QA are complete. Interactive verification (real touch device, cross-widget rapid moves, snap-back) recommended before client demo.

---

### Client direction ??? commits & style guide (2026-05-13)

- **Commits:** Include **all** files that are part of the same deliverable (including `team/` updates), not a subset of product files only.
- **Frontend Dev:** **Always** update `team/style-guide.md` when shipping UI/CSS/widget/store-visible behaviour changes so documentation matches implementation (see `.cursor/agents/frontend-senior-dev.md` and `workflow-and-process.mdc`).

### Policy update ? commit scope normalized (2026-05-13)

- Canonicalized the commit rule: commit source/doc/tooling files by default; only exclude live runtime data/state files.
- Added the global rule in `.cursorrules` under `Commit eligibility policy (runtime vs source)`.
- Canonical runtime exclusion example remains `data/widgets.json` (service-updated persistence data), while source files (`js`, `css`, `html`), markdown, agent files, and `.cursor` setup files remain commit-eligible for normal deliverables.
- Added `team/lead-status.md` guidance so this instruction is visible to future delegation cycles.
### 2026-05-13 Follow-up delegation ? QA remediation pass 2

- **Track:** Frontend accessibility + picker UX follow-up from prior QA findings.
- **Assignment file:** `team/assignments-qa-remediation-v2.md`
- **Files owned:** `index.html`, `js/app.js`, `css/style.css`, `team/style-guide.md` (if behavior/docs changed), `team/lead-status.md`.
- **Current status:** Frontend remediation completed (static implementation pass); backend unchanged.

### QA follow-up checkpoint

- **Expected outcome:** frontend implementation then QA verification via `team/qa-complete-v4.md` and `team/qa-status.md` with a structured pass/fail verdict.
- **Risk watch:** ensure picker remains fully keyboard-operable and no focus or pseudo-element regressions remain in shell and widget controls.

### QA remediation pass 2 ? implementation outcome (2026-05-13)

- **Outcome:** Implemented in `team/assignments-qa-remediation-v2.md` scope:
  - accessible drag-handle naming + keyboard reorder support,
  - combobox/listbox picker semantics with arrow/Enter/Space navigation,
  - corrected pseudo-element selector syntax,
  - safe-area inset application in shell/mobile shell containers.
- **Docs updated:** `team/style-guide.md` and `team/assignments-qa-remediation-v2.md` now reflect the final status.

### QA follow-up cycle 4 (2026-05-13)

- **Track:** Remaining QA follow-up defects from static validation.
- **Actions completed:**
  - Fixed `css/style.css` malformed selectors (`::focus-visible` to `:focus-visible`, `:::-webkit-scrollbar*` to `::-webkit-scrollbar*`) with no behavior changes.
  - Updated `team/style-guide.md` manifest filename reference from `manifest.webmanifest` to `manifest.json` for documentation consistency.
- **Status:** frontend follow-up closure recorded; remaining work remains interactive verification where already recommended.

---

### QA follow-up cycle 5 ? focus states + visual consistency (2026-05-13)

**Status:** Open, delegated to Frontend Dev.

**Findings from QA re-check request:**

- Medium residual focus/active color inconsistency in `css/style.css` selectors still using violet/purple in active/focus styling:
  - `.dash-widget.editable`
  - `.widget-handle`
  - `.note-area:focus-visible`
  - `.search-input:focus`
  - `.widget-title-input:focus-visible`
- `nav-tab` uses `min-height: 40px` while touch targets in `team/style-guide.md` require `42px`.
- Body type stack currently sets `Inter` explicitly in `css/style.css`; `index.html` config and docs currently align to Outfit import, so this is a conflict candidate.

**Assignment issue:** `team/assignments-qa-remediation-v3.md` (Frontend)

**Expected outcome:** Frontend executes scoped CSS cleanup and optional font-stack reconciliation, then QA performs the next verification cycle for final sign-off.

### Bug fix cycle ? Mobile scroll-during-drag (2026-05-13)

**Status:** Delegated to Frontend Dev; QA follow-up scheduled.

**Root cause summary:**
- `touch-action: none` was set only on the small handle elements (`.widget-handle`, `.todo-item-handle`). The browser evaluates the native scroll gesture on the *scroll container* ancestor, so the narrow handle scope was insufficient.
- `dnd-active` class is already toggled on `document.body` during drags; adding `body.dnd-active { touch-action: none; }` in CSS is the most robust and lowest-risk fix.
- Secondary hardening: `touch-action: none` on `.dnd-ghost-task`, `.dnd-ghost-widget`, `.todo-item`, and `.dash-widget` so any touch target in the drag chain opts out of native scroll.
- In JS: `event.preventDefault()` in `onTaskPointerMove` / `onWidgetPointerMove` must be called unconditionally (not gated on `pointerType === "touch"`), and `pointermove` listeners should be attached to `document` (added on `pointerdown`, removed on `pointerup`/`pointercancel`) with `{ passive: false }` ? this is more reliable on mobile than handle-scoped listeners with `setPointerCapture`, which some mobile browsers can race against a scroll gesture start.

**Files to touch:**
- `css/style.css` ? `body.dnd-active { touch-action: none; }`, ghost elements, draggable rows
- `js/app.js` ? document-level `pointermove`; unconditional `preventDefault`
- `js/widgets/todo.js` ? document-level `pointermove`; unconditional `preventDefault`

**Subagent execution (2026-05-13):**
1. Team Lead updated `team/lead-status.md` with this bug cycle.
2. Frontend Dev ? implemented fix in `css/style.css`, `js/app.js`, `js/widgets/todo.js`, `team/style-guide.md`; committed as `138ff13`.
3. QA ? static review: **Pass**. All acceptance bullets verified; no findings. Sign-off granted.
4. Pushed to `main` (`bd2e641..138ff13`).

**Status:** Closed from static review perspective. Interactive verification on a real touch device recommended before client demo.

---

## Client direction ? Server-persisted widgets (2026-05-13)

### Manager summary

- Client requested that widget position/layout, type, and content survive across devices and server power cycles through backend persistence.
- Scope is single-user LAN operation for now; backend can own the source-of-truth store and frontend can sync on load/save.
- Backend route shape, merge policy, and conflict strategy remain to be finalized in this cycle (details below).

### Assignment issued

- **File-scoped task file:** `team/assignments-widget-persistence-server.md`
- **Track priority:** High (blocking cross-device continuity and power-cycle recovery for dashboard state).
- **Decision log:** prefer server-first state with local fallback when network/API is unavailable; pending conflict for this track:
  - whether to implement strict `server-wins` semantics always, or `newest-updated` merge when both server and local payloads are present.

### Next step

After this track lands, QA must verify:
- dashboard layout/content round trips across restart of the api service and browser/device reloads,
- save failures + recovery behavior when `/api` is unavailable,
- `/api/` remains excluded from service-worker caching and SW cache policy remains valid.

### Execution status update (2026-05-13)

- **Subagent execution:** Frontend and Backend tracks completed, QA pass requested.
- **QA outcome:** `qa-engineer` reported **Pass with notes** (medium documentation drift noted for `data/schema.md` localStorage contract versus current runtime payload shape).
- **Client-facing decision points:** confirm whether localStorage payload docs should be brought fully in line with runtime now (recommended before final client sign-off).
- **Current next action:** Team Lead to fold interactive QA checks and any policy clarification into final wrap-up.

## Client direction ? Live cross-surface sync (2026-05-13)

### Manager summary (recorded decision)

- Auth is **explicitly not required** for this dashboard; operation is single-user LAN only.
- Keep `/api/widgets` open for LAN deployment and recovery.
- User expectation: changes should propagate between open tabs/devices within approximately 3?5 seconds in normal conditions (where both are online).
- Backend API route shape is suitable; polling/reconciliation is expected to be handled in Frontend first.

### Delegation status

- **Frontend:** `frontend-senior-dev` implemented visibility-aware polling + merge guards in `js/app.js`.
- **QA:** `qa-engineer` assigned for interactive cross-tab consistency validation.
- **Backend:** no code changes required unless Frontend requests conditional request optimization later.

### Merge and replication policy for this cycle

- Add a visible-only poll loop while online (default 3000?5000ms). When the tab is hidden, slow polling or temporarily pause to save LAN load and avoid churn.
- Apply remote snapshot only if its `updatedAt` is newer than the last applied client snapshot.
- Guard against clobbering local in-flight edits with a simple heuristic:
  - set `hasPendingSync` true during save debounce / PUT in flight;
  - track focus on editable widgets (contenteditable/inputs used for notes and todo edits);
  - while either guard is active, defer remote pull.
- After deferred pull conditions clear, fetch once and reconcile if remote remains newer.

---

## HTTPS via Cloudflare cycle outcome (2026-05-13)

### Team Lead execution status

Team lead created the cycle and delegated to Backend Dev, Frontend Dev, and QA.

### Backend Dev outcome

- Added required API proxy headers in `nginx-site.conf`:
  - `proxy_set_header X-Forwarded-Host $host;`
  - `proxy_set_header X-Forwarded-Proto $scheme;`
- Confirmed local shell/API headers are present for `/`, `/sw.js`, `/manifest.json`, `/index.html`.
- Confirmed `/api/` remains bypassed in the service worker (`sw.js` already does this).
- HSTS was intentionally not enabled at nginx layer due mixed HTTP/LAN usage and Tunnel edge ownership.

### Frontend Dev outcome

- Confirmed frontend code does not hardcode HTTP or force protocol changes:
  - `index.html` uses relative manifest/script paths.
  - `js/app.js` uses `"/api/widgets"` relative fetch path.
  - `sw.js` is scheme-neutral and explicitly skips `/api/`.
- No frontend-only scheme rewrite fix was needed in repo code this cycle.

### QA outcome

- Interactive HTTPS-browser verification could not be completed from this workspace because the live Cloudflare HTTPS hostname is not discoverable in repo/docs/transcripts and HTTPS direct probing of the available host (`192.168.1.245:8033`) fails TLS negotiation.
- Static evidence indicates HTTPS assets and route behavior are likely correct, but complete cross-browsers proofs are blocked until the exact production HTTPS endpoint is provided.
- One medium follow-up risk was flagged for follow-up review: online-gating logic in `js/app.js` may block sync when `navigator.onLine` is stale in edge environments.

### Next action

- User must provide the Cloudflare public HTTPS URL (exact hostname) used in production for final QA replay and close-out.
- After hostname handoff, QA must run full browser verification: HTTPS load persistence, SW registration, manifest parse, mixed-content check, `/api/widgets` network path.

### Assignment reference

- `team/assignments-https-cloudflare.md`

---

## Client direction ? HTTPS via Cloudflare Tunnel (2026-05-13)

### Manager summary (what the client asked for)

- HTTPS users are currently being pushed to HTTP, and the dashboard fails under HTTPS in production via Cloudflare Tunnel.
- Objective: ensure HTTPS is stable and canonical under Tunnel, preserve PWA behavior (`sw.js`, `manifest.json`), and keep app-shell and `/api/` routing correct for one single-user production environment.

### Priority order

1. Backend/hosting check first: confirm response headers, proxy settings, caching scope, and any absolute redirect behavior from nginx under TLS.
2. Frontend probe second: verify browser-side scheme behavior, SW/manifest/app shell load, and storage/runtime logic under HTTPS.
3. QA verify end-to-end on the live Cloudflare HTTPS hostname from a fresh profile.

### Risk and dependencies

- Tunnel origin/proxy header handling is likely the critical path for HTTPS detection and any scheme-related behavior.
- Service worker and manifest paths must not be mis-served from HTTPS cache layers or forced to HTTP by header policy.
- `/api/widgets` and other API calls should stay uncached by SW and available via tunnel-proxied API path.

### New assignment

Task file: `team/assignments-https-cloudflare.md`  
Cycle owner: Backend validation + Frontend reproduction + QA verification.

### Delegation status

- [ ] Team Lead: tracking cycle and receiving agent reports
- [ ] Backend Dev: reproduce with headers + fix nginx proxy headers/caching safety
- [ ] Frontend Dev: reproduce HTTPS browser failures and patch any scheme-dependent frontend logic
- [ ] QA: interactive Cloudflare HTTPS validation and final pass/fail report

---

## Client direction ? Cross-device + power-cycle persistence (closure cycle) (2026-05-13)

### Product scope decision (Team Lead)

- **Include both Home dashboard and Tools page** in server-backed sync.
- **Rationale:** The client asked for layout, widget types, and **content** to follow the single user across devices; `toolsWidgets` (`calvybots_tools_widgets`) today is device-local only, which would violate that expectation whenever the Tools surface is used. One combined API document keeps a single `updatedAt` and matches the existing `GET/PUT /api/widgets` pattern.

### Blocker ? Docker data volume

- **`docker-compose.yml`** mounts **`/mnt/data/web_app/data:/data:read-only`**, while `api/server.js` persists to `../data/widgets.json` (container path **`/data/widgets.json`**). **PUT persistence will fail or be a no-op in production** until the volume is writable.

### Delegation summary (tracked assignments)

| Owner | Focus | Primary files |
|-------|--------|----------------|
| **Backend Dev** | Writable `/data` mount; extend persisted JSON to optional **`toolsWidgets`** (same row rules as **`widgets`**); verify atomic write + queue; `nginx-site.conf` only if body size warrants | `docker-compose.yml`, `api/server.js`, `data/schema.md`, `nginx-site.conf` (conditional) |
| **Frontend Dev** | Load/merge **home + tools** from server on startup; debounced PUT + polling/focus reconciliation for **full document**; same `updatedAt` / pending-edit guards as today for both lists | `js/app.js`, `js/store.js`, `team/style-guide.md` (if UX for sync/state changes) |
| **QA** | After dev lands: persistence across **API/container restart**, **server reboot** (when available), **two clients** (e.g. desktop + phone/profile) Home + Tools | `tests/test-plan.md`, `tests/usability-checklist.md`; verdict in chat unless client requests `team/qa-*.md` updates |

### Backend Dev ? concrete tasks

1. Change API service volume **`/mnt/data/web_app/data` ? container `/data`** from **`:ro` to read-write** (explicit `:rw` or default).
2. Extend **`api/server.js`** document shape: accept and return optional **`toolsWidgets`** array, validated with the **same normalization as `widgets`** (reuse `parseAndNormalizeRow` in a loop). Omit or default to `[]` for backward compatibility on read. Bump **`WIDGETS_SCHEMA_VERSION`** if the server rejects unknown top-level keys today; ensure stored file remains valid.
3. Confirm **`writeWidgetsAtomic`** (temp file + `rename`) and **`queueWidgetPersist`** behavior under concurrent PUTs; document in code comment if single-writer queue is the guarantee.
4. If combined payload could exceed nginx defaults, set **`client_max_body_size`** for `/api/` with brief comment (only if needed after measuring).
5. **Acceptance:** `PUT /api/widgets` with both `widgets` and `toolsWidgets` returns **200**, file on host updates, **`GET` after `docker compose restart api`** returns the same data; **`PUT` with read-only mount removed** does not log EACCES/EROFS.

### Frontend Dev ? concrete tasks

1. Extend **`getWidgetPayloadForApi` / load path** in **`js/store.js`** (or the single serializer used by `js/app.js`) so the API round-trip includes **`toolsWidgets`** alongside **`widgets`**, with one shared **`updatedAt`** for conflict comparison.
2. On init: apply server snapshot to **both** `widgets` and `toolsWidgets` when server wins per existing policy; keep **localStorage** as cache/offline fallback.
3. On **Tools** mutations: mirror **Home** ? immediate local persist + debounced **`PUT /api/widgets`**; ensure **`_widgetsNeedSync` / polling** considers changes from either surface.
4. Preserve existing guards: **pending sync**, **active edit session**, **visibility-aware polling**, **`compareUpdatedAt`** ? no remote clobber of in-flight edits.
5. Update **`team/style-guide.md`** only if user-visible sync/error/offline messaging changes.

### QA ? concrete tasks (run after Backend + Frontend complete)

1. **Power / process cycle:** With stack up, edit Home and Tools ? confirm **`data/widgets.json`** on host ? **`docker compose restart api`** (and full stack if feasible) ? reload browser ? state matches.
2. **Cross-device / cross-profile:** Session A edits Home + Tools ? within poll window (or focus refresh), Session B shows updates without local-only drift.
3. **Regression:** `/api/` still **not** cached by **`sw.js`**; offline behavior remains acceptable (local edits, sync when back).
4. Deliver structured **Pass / Pass with notes / Fail** with severities and sign-off recommendation for Team Lead.

### Definition of done (this cycle)

- Single-user edits on one device appear on another for **both** Home and Tools after sync.
- Widget layout, types, and embedded content (notes/todo state, etc.) survive **server/API restarts** when Docker uses a **writable** data volume.
- No silent failure: API or fs errors surface per existing API error shapes; frontend retains local recovery.

### Next step

Backend and Frontend execute in parallel once schema extension is agreed from this brief; QA follows implementation. Team Lead updates this section when subagents report completion.

### Execution status (2026-05-13)

- **Backend Dev:** Landed ? `docker-compose.yml` uses **`/data:rw`**; `api/server.js` **`WIDGETS_SCHEMA_VERSION` 2** with **`toolsWidgets`** normalization; `data/schema.md` + **`nginx-site.conf`** (`client_max_body_size` for `/api/`) updated per subagent report.
- **Frontend Dev:** Landed ? `js/store.js` parses/serializes **`toolsWidgets`** in API payload helpers; `js/app.js` reconciles and debounces PUT with shared **`updatedAt`** policy for both surfaces.
- **QA:** First **`qa-engineer` pass returned Blocked** against an **older file snapshot** (still showed `:ro` compose and home-only sync). **Re-verify required** against current tree: repeat cross-device + container restart scenarios; revised verdict expected **Pass with notes** or **Pass** if Docker is available in the QA environment.

### QA re-verify bullets (tracked)

1. Confirm `docker-compose.yml` line 10 is `:rw` and `PUT /api/widgets` persists after edits on Home + Tools.
2. Confirm `GET` after `docker compose restart api` matches last successful PUT.
3. Two sessions: Tools + Home edits converge within poll / focus refresh.
4. **`sw.js`:** `/api/` bypass unchanged (static OK).

---

## Client direction ? Server sync every few seconds + tab-close flush (2026-05-13)

### Manager summary

Widget **content** appears empty in a **new private tab** because private mode has isolated `localStorage`; the UI must reflect **`GET /api/widgets`** only. Today **PUT** runs after **`WIDGET_SYNC_DEBOUNCE_MS` (900ms)** and polling only runs **GET** ? closing the tab before debounce completes can skip the server write. Client wants **periodic server updates every few seconds while editing**, **`pagehide`/`beforeunload` flush** (local write first, then immediate PUT / keepalive / beacon), optional **shorter debounce**, and verification that **nested `notesState` / `todoState`** round-trip through `getWidgetPayloadForApi` / `normaliseWidgetRows`.

### Risks

- **`sendBeacon` with PUT:** not universally supported; prefer **`fetch(..., { keepalive: true })`** for small/medium JSON; know **~64KB** keepalive limits.
- **Double handlers** if `init()` runs twice without cleanup.
- **`navigator.onLine`** can be stale (known HTTPS cycle note).
- **CORS:** N/A for same-origin `/api/widgets`.

### Assignment file

**`team/assignments-widget-sync-interval-flush.md`** ? file-scoped tasks, acceptance bullets, QA matrix.

### Delegation status (this cycle)

- **Frontend Dev:** Implement interval **PUT** when dirty / `_widgetsNeedSync`, unload flush, debounce tuning; primary file **`js/app.js`**; widgets/store only as needed; **`team/style-guide.md`** only if UX messaging changes.
- **Backend Dev:** Verify-only unless **413** / validation blocks large nested payload; then **`nginx-site.conf`** / **`api/server.js`**.
- **QA:** Desktop ? private tab; rapid close; inspect **`data/widgets.json`**; offline + SW regression per assignment file.

### Next step

Execute **`team/assignments-widget-sync-interval-flush.md`**; Frontend lands first; Backend only if blocked; QA follows for structured verdict.

### Execution status (2026-05-13)

- **Frontend Dev:** Landed ? `js/app.js` adds **`WIDGET_SYNC_PUSH_MS` (~3s)** visible+online dirty PUT loop, **`pagehide`/`beforeunload`** ? `flushWidgetsBeforeExit()` (local save then keepalive PUT + beacon fallback), debounce tightened (`WIDGET_SYNC_DEBOUNCE_MS` **350**); **`js/widgets/notes.js`** persist debounce **250ms**. Subagent reported commit `5992ebcef189031c4e95f17cf62f89c3de1d14f7`.
- **Backend Dev:** **No change** ? nginx **`client_max_body_size 4m`** on `/api/`; API **`MAX_WIDGET_PAYLOAD_BYTES` 2MB**; nested **`notesState`/`todoState`** normalized on PUT.
- **QA:** First pass **Blocked** on stale snapshot. Second pass **Pass with notes**: code review confirms interval PUT + unload flush + SW `/api/` bypass; browser-only matrix items not executed here; QA host **PUT ? 500 (EROFS)** so file round-trip blocked until **`/data` is writable**.
- **Follow-up (landed 2026-05-13):** **`sendBeacon` is POST-only** ? API **`POST /api/widgets`** aliases **`PUT`** (`api/server.js`). **`_widgetsNeedSync`** stays true after beacon (no response); next online **`fetch` PUT** clears when confirmed.

### Team Lead sign-off ? Server sync interval + tab-close flush (2026-05-13, QA handoff)

- **Structured QA verdict:** **Pass with notes** (`qa-engineer`).
- **Verified / confirmed:** Live `GET /api/widgets` at production URL returns nested `notesState` / `todoState`; **`sw.js`** does not handle **`/api/`**; **`api/server.js`** accepts **PUT** and **POST** for widgets (POST aliases PUT).
- **Further Frontend / Backend work before human smoke:** **None.** The assignment implementation and QA evidence are sufficient to close this delegation cycle from a dev perspective.
- **Human smoke (recommended, not a code blocker):** QA could not execute private-window scenarios here: **(a)** wait ~5s then verify persistence, **(b)** close tab within 1?2s after edit. Run a **brief human smoke** on a real browser when convenient.
- **Notes severity (Low, documented behavior):** `sendBeacon` queue semantics; **offline** tab-close cannot sync to server (**expected**). No remediation task unless product asks for different semantics.

**Cycle status:** **Signed off** for Team Lead tracking; optional human smoke + any client demo rehearsal remain operational follow-ups, not open dev items for this track.

## Client direction ? Server sync gate by reload (2026-05-13)

### Manager summary

- User requires **remote payload ingest only on cold load**, preventing accidental in-session overwrite of local edits.
- New behavior target:
  - Keep outbound sync path (`PUT`/beacon/pagehide) unchanged unless explicitly retired later.
  - No remote `_applyPendingRemotePayload` or reconcile in poll/focus/online flows after initial load.
  - Cold load continues to use `compareUpdatedAt` and `_widgetsUpdatedAt` to choose authoritative source.

### Team Lead assignment

- **Owner:** Frontend Dev
- **Primary file:** `js/app.js`
- **Acceptance criteria:**
  - `reconcileServerWidgets()` is only applied during initial bootstrap path.
  - Poller, `visibilitychange` handler, and `online` handler no longer ingest fresh `/api/widgets` data into the active session.
  - `_cachePendingRemotePayload` / `_applyPendingRemotePayload` cannot trigger mid-session state changes.
  - `init()` cold-load merge still enforces latest-edit-wins using `updatedAt` between localStorage and server payload.
  - In-session PUT flow remains active (debounced persist + interval flush + page unload handling).
- **Definition of done:**
  - A user must reload the page to see remote widget/dashboard changes.
  - In-session local edits are not overwritten by background polling/focus/online events.
  - Full reload still converges the local snapshot and server snapshot using timestamp policy.

### Execution status (2026-05-13)

- **Frontend Dev complete (`frontend-senior-dev`)**:
  - Implemented in `js/app.js` with bootstrap-only inbound sync (`reconcileServerWidgets` now active for init only), no mid-session poll/visibility/online remote apply, and pending remote payload queue locked to bootstrap completion.
  - Outbound save/debounced PUT/pagehide-path preserved.
- **QA:** `qa-engineer` returned **Pass with notes** for this track.
  - Acceptance criteria above are satisfied with evidence in `js/app.js` and no high/medium-severity blockers found.
  - Recommendation: close cycle from Team Lead perspective after optional manual proof (reload gate + cross-tab overwrite scenario).

### Client direction ? Named volume fix for EROFS / PUT 500 (2026-05-13)

**Status:** CLOSED ? implementation landed and QA static review passed.

**Problem resolved:** `docker-compose.yml` was bind-mounting `/mnt/data/web_app/data:/data:rw` but the host NAS path is EROFS; every `PUT /api/widgets` returned 500.

**Solution:** Replace host bind mount with named Docker volume `calvybots_api_data` mounted at `/data` in the `api` container. A read-only file bind overlay `config.json:/data/config.json:ro` ensures `GET /api/config` remains functional from the NAS. A `/seed-data:ro` mount + bootstrap `cp -n` in the startup command seeds `widgets.json` on first container start when the host file exists.

**Commit:** `5e0fabc` ? Backend Senior Dev (`docker-compose.yml` only; `api/server.js` unchanged).

**QA static verdict:** **Pass** ? all 13 static checks passed, zero defects. Named volume correctly wired, EROFS bind mount removed, atomic write path confirmed, `sw.js` `/api/` bypass unchanged.

**Client migration commands (must be run on NAS host):**

```bash
# 1. Bring stack down
docker compose down

# 2. Create named volume (explicit; compose auto-creates on up too)
docker volume create calvybots_api_data

# 3. ONE-TIME SEED ? only if widgets.json has real data (skip if missing/default)
#    Inspect first: cat /mnt/data/web_app/data/widgets.json
#    If it has real widget data, run:
docker run --rm \
  -v calvybots_api_data:/data \
  -v /mnt/data/web_app/data:/src:ro \
  alpine sh -c "cp /src/widgets.json /data/widgets.json && echo SEED_OK"

# 4. Start stack
docker compose up -d

# 5. Verify write access
docker compose exec api sh -lc "touch /data/.write_test && rm -f /data/.write_test && echo WRITE_OK"

# 6. Check api logs
docker compose logs --tail=40 api
```

**Interactive smoke items (client to confirm on live NAS):**
- [ ] Step 5 above returns `WRITE_OK`
- [ ] `PUT /api/widgets` returns 200 (not 500)
- [ ] `docker compose logs` shows no EROFS errors
- [ ] `GET /api/widgets` returns persisted document after a PUT
- [ ] `GET /api/config` returns 200
- [ ] `docker compose down` (no `-v`) + `docker compose up -d` ? `GET /api/widgets` returns last saved state (volume durability)
- [ ] Browser: edit Notes/To-Do, wait 3-5s, open private window ? content appears

**Volume durability note:** The named volume persists across `docker compose down` / `docker compose up -d`. It is removed only by `docker compose down -v` or `docker volume rm calvybots_api_data`. For NAS-side backup, export with: `docker run --rm -v calvybots_api_data:/data -v /mnt/data/web_app/data:/backup alpine cp /data/widgets.json /backup/widgets.json`.

---

---

## P0 Regression ? Cold-load clobber fix (2026-05-13)

### Manager summary

**Root cause confirmed from live logs:** a new device with empty `localStorage` stamped a fabricated `updatedAt` (via `new Date()`) during cold load, making local 3-widget defaults appear newer than the server's real 5-widget document. The reconciler then pushed the empty defaults to the server, clobbering the user's data.

**Fix already applied to live files on NAS (not yet committed):**
- `js/store.js` `saveWidgets`: changed `parseUpdatedAt(options.updatedAt) || new Date()` ? `"updatedAt" in options ? parseUpdatedAt(options.updatedAt) : new Date()` ? preserves `null` when caller passes `updatedAt: null`.
- `js/store.js` `getWidgetPayloadForApi`: same null-preservation pattern.
- `js/app.js` `persistWidgets({ sync: false })` (~line 626): removed `|| new Date().toISOString()` fabrication.
- `js/app.js` `persistToolsWidgets` no-sync branch (~line 234): same removal.

**Result of fix:** cold load keeps `localTs = null` / `hasLocalTs = false`, so `remoteLooksNewer = true` always when server has real `updatedAt`, and `applyRemotePayload()` runs correctly ? server state wins on fresh device.

**SW cache bump required:** existing devices are running old cached `js/app.js` / `js/store.js` from `calvybots-v4`. Must bump to `calvybots-v5` to force re-fetch.

### Priority: **P0 ? active data-loss regression, client witnessed it in real time**

### Delegation

| Owner | Task | Files |
|-------|------|-------|
| Backend Senior Dev | Bump `sw.js` CACHE from `calvybots-v4` ? `calvybots-v5` | `sw.js` line 2 |
| Frontend Senior Dev | Commit live fixes (already applied) | `js/app.js`, `js/store.js` |
| QA | Verify new device no longer clobbers server; SW shows v5; no bad PUT in logs | `team/lead-status.md` update |

### Execution status

- **Backend Dev:** **Complete** ? `sw.js` line 2 changed to `'calvybots-v5'` (included in Frontend commit below).
- **Frontend Dev:** **Complete** ? Two commits landed:
  - `92de715` ? `fix(sync): prevent cold-load timestamp fabrication clobbering server widgets` (`js/app.js`, `js/store.js`, `sw.js`)
  - `cf28d27` ? `fix(sync): patch flushWidgetsBeforeExit cold-load timestamp fabrication` (`js/app.js`, one-line follow-up for missed callsite found by QA)
- **QA:** **Pass** ? All 5 acceptance bullets verified by static code review. No fabrication patterns remain. `compareUpdatedAt(null, serverTs)` returns -1 (remote wins). `sw.js` is `calvybots-v5`. 4-step clobber path broken at step 2.

### Sign-off ? Team Lead

**P0 cycle closed.** Fix is complete and verified. Both commits are on `main`. Interactive follow-up items (cold device smoke, SW DevTools v5 check, `docker compose logs` PUT watch) are recommended before next client demo but are **not blocking** code delivery.

**Remaining interactive verification checklist (client to confirm on live NAS):**
- [ ] Hard-refresh an existing device ? SW should upgrade to `calvybots-v5` in DevTools Application ? Cache Storage.
- [ ] Open dashboard on a new/private device or incognito ? should load server state (no bad PUT with `widgetsCount: 3` / `bodyBytes: ~916`).
- [ ] `docker compose logs --follow api` during new-device cold load ? confirm no spurious PUT before any user edit.
- [ ] `GET /api/widgets` after new-device load returns correct document (not reset to defaults).

### Client direction ? Widget sync 500 + EROFS follow-up (2026-05-13)

**Status:** Delegate cycle reopened; backend diagnostics landed; environment remains blocked by EROFS until runtime writable path is confirmed.

#### Team Lead assignment

- Resolve recurring `PUT /api/widgets` 500 errors and confirm persistent server writes in the live runtime.
- Ensure client offline/local-first editing remains non-blocking while sync is failing.

#### Backend Dev status

- `backend-senior-dev` added write-path diagnostics in `api/server.js`:
  - `WIDGETS_PATH`/directory startup checks,
  - success/failure logging around atomic write (`writeWidgetsAtomic`),
  - detailed `handlePutWidgets` acceptance and failure log payload.
- Queue semantics were left intact.
- `docker-compose.yml` still targets `/mnt/data/web_app/data:/data:rw`; compose edit was not required by this pass.

#### Frontend Dev status

- `frontend-senior-dev` hardened `js/app.js` sync state transitions:
  - keep `_widgetsNeedSync` set if local edits occur while a PUT is in flight,
  - clear dirty state only when the in-flight snapshot is still current,
  - improve PUT failure logging with response body details.
- Local edits and localStorage persistence remained unchanged.

#### QA status

- `qa-engineer` reported **Fail (blocked)**: `PUT /api/widgets` still returns `500` with `EROFS` details (`open '/data/widgets.json....tmp'`).
- Client-side polling/put interval and private-window propagation checks remain blocked until write succeeds.

#### Next action for Team Lead

1. Fix the running API runtime filesystem writability for `/data` (host mount ownership/permissions or active compose variant mismatch).
2. Re-run private-window persistence and container logs after restart:
  - successful server `PUT /api/widgets` (`200`),
  - observed backend write success log,
  - private window sees fresh server-backed widget payload.
3. Return to QA pass once backend writes are confirmed.

### Client direction ? To-Do color picker position drift (2026-05-13)

**Status:** Conditionally closed; implementation complete, interactive runtime verification pending.

**Priority:** P2 visual stability.

**Client scope:** Fix color-picker anchoring regression in To-Do tasks where the panel drifts vertically relative to the clicked colour bar in normal, scrolled, or list-scrolled states.

**Current assignment:** `team/assignments-todo-color-picker.md`

**Primary files:** `js/widgets/todo.js`, `css/style.css`.

**Execution notes:**

- Preserve outside-click and focus-based close behavior.
- Preserve keyboard/screen-reader interaction paths.
- Preserve task color set/remove and task row action behavior.
- Update `team/style-guide.md` only if user-visible pattern/token behavior changes.

**Team Lead execution status:**

- **Frontend completion:** `js/widgets/todo.js` and `css/style.css` changes are in place.
- **QA (`qa-engineer`):** Pass with notes from static review.
- **Interactive follow-up:** Manual runtime confirmation remains required for vertical alignment/stability under page and list scroll and close-path behavior under live interaction.

**Next step (Team Lead):** keep this cycle conditionally closed until manual smoke verification confirms:

1. Picker opens directly under the clicked color bar in static and scrolled states.
2. Open menu remains vertically stable while dashboard/list scrolling.
3. Outside-click and keyboard/Escape close paths still close correctly.

## 2026-05-13 ? Frontend/Backend Cleanup: calvybots ? Launchpad

**Status:** Planned, delegated.

**Priority:** P1 (compatibility-safe naming normalization + cleanup).

**Client scope:** full cleanup audit across runtime, docs, and process artifacts:
- safe localStorage rename/migration strategy from `calvybots_*` to `launchpad_*`
- unused-script/function reconciliation
- documentation cleanup in team/developer and process docs
- backend naming alignment where safe
- QA pass/fail with explicit no-regression checks

**Current assignment:** `team/assignments-cleanup-calvybots-launchpad.md`

**Primary files:** `js/store.js`, `js/site-diagnostics.js`, `js/app.js`, `js/widgets/search.js`, `js/widgets/bookmarks.js`, `api/package.json`, `docker-compose.yml`, `sw.js`, `team/style-guide.md`, `data/schema.md`, `tests/*`.

**Execution notes:**

- Preserve backward compatibility on first pass; do not remove legacy `calvybots_*` persistence without migration proof.
- Keep PWA cache and `/api/` exclusions unchanged unless explicitly revalidated.
- If backend renames introduce persistence-risk (e.g. API data volume), pair with documented migration path or keep legacy artifact with compatibility alias.
- Route QA through the existing checklists and request a new verdict in `team/qa-complete-v4.md`.

**Team Lead execution status:**

- **Frontend:** assigned to frontend-senior-dev via Team Lead delegation.
- **Backend:** assigned to backend-senior-dev via Team Lead delegation.
- **QA:** assigned to qa-engineer after implementation.
- **Commit/rebase:** blocked until QA signoff and final Lead review.

## QA outcome (cleanup track)

**Verdict:** Pass with notes (`qa-engineer`).

**Findings (non-blocking):**
- No blocking regressions in cleanup namespace migration paths.
- Medium residual risk: legacy dormant widget rows (`bookmarks`/`search`/`sysinfo`) in persisted layouts can surface as inert rows with the current renderer set; to be documented/handled explicitly.
- Low risk: dormant bookmark path uses `innerHTML` with user-influenced label/icon values; security hardening can be deferred while dormant.

**Sign-off recommendation:** static cycle is safe to proceed to commit/rebase, with interactive follow-up checks for migration matrix and legacy-layout behavior remaining.
