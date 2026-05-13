# Assignments — Tools page Status + Log widgets (default diagnostics)

**Track owner:** Team Lead  
**Date:** 2026-05-13  
**Client goal:** Default **Tools** widgets for deployment/debugging: **Status** (traffic-light health) + **Log** (scrollable site log); both **start on full app load** (not only when visiting Tools) so probes and log capture run continuously.

---

## Shared architecture decisions

1. **Static-first:** No new CDN dependencies unless Team Lead explicitly approves an addition to `index.html`. Prefer vanilla `fetch`, `navigator.serviceWorker`, `performance`, existing Tailwind tokens.
2. **Widget factory contract:** New modules under `js/widgets/` export `render(container, widgetRow, dashboard)` returning `{ destroy() }`; **do not** render the widget title (shell handles it).
3. **Persistence:** Tools rows live in `calvybots_tools_widgets` (`TOOLS_WIDGETS_KEY` in `js/store.js`). Status/Log widgets may carry **no or minimal** instance state in the row; probe/log data is **runtime-only** unless product asks to persist log buffer (default: **no** — ring buffer in memory).
4. **Bootstrap coupling:** Implement a small **same-origin module** (e.g. `js/site-diagnostics.js`) imported once from `js/app.js` at startup that:
   - installs **console hook** (`console.warn`, `console.error`; optionally `console.log` behind a flag or only in dev — avoid noisy spam in production)
   - exposes **append-only log buffer** with subscribers for the Log widget
   - runs **probe suite** once after initial paint / SW settlement; optionally **re-runs on interval** (e.g. 60s) or `visibilitychange` for Status refresh
   - emits **log lines** when any probe yields **warning** or **critical** (client requirement: warnings reflected in Log widget).
5. **Default layout:** Replace `DEFAULT_TOOLS_WIDGETS` in `js/store.js` so new installs get **Status** + **Log** (stable ids, ordered positions). Add **`migrateToolsDefaultsIfNeeded()`** (or extend existing tools load path): if stored tools equal legacy single-placeholder default **only**, upgrade in-memory layout to Status + Log **without** destroying user-customised layouts.
6. **Registration:** Extend `toolsWidgetTypes`, `toolsWidgetFactories`, `toolsAddWidgetChoices`, `widgetLabels` in `js/app.js`. Keep **placeholder** registered for backward compatibility if old saves reference it.

---

## Frontend Dev

**Owner:** Frontend Dev  
**Primary files:** `js/app.js`, `js/store.js`, `js/widgets/` (new `status-tools.js` + `log-tools.js` or agreed names), `js/site-diagnostics.js` (new), `css/style.css` (layout/colours only if needed), `team/style-guide.md` (Tools diagnostics UX tokens).

### Tasks

1. **`js/site-diagnostics.js`**
   - Ring buffer (cap e.g. 500 lines) with `{ ts, level, message, detail? }`.
   - `subscribe(listener)` / `unsubscribe` for widgets.
   - `installConsoleHooks()` — capture warn/error (and optional log); prevent infinite recursion if diagnostics itself logs.
   - `runProbes()` → returns array of `{ id, label, status: 'ok'|'warn'|'crit', detail }`:
     - **Shell / document:** document visibility, basic timing optional.
     - **Service worker:** `navigator.serviceWorker` — registered? controlling? (warn if unsupported is OK; crit only if registration throws unexpectedly).
     - **API:** `GET /api/health` with timeout (e.g. 5s) — ok HTTP + JSON shape; **warn** if offline/`navigator.onLine` false; **crit** if online but non-2xx or JSON parse failure.
     - **Same-origin fetch sanity:** `GET /` or `/index.html` HEAD/GET lightweight check (warn/crit on failure).
     - **localStorage:** try read/write sentinel key under `calvybots_` namespace then remove — crit on exception.
     - **CDN reachability (optional warn):** HEAD or script probe for **one** critical CDN already in `index.html` (e.g. Alpine script URL) — failure = **warn** not crit (offline shell may still work).
   - On each probe result, push matching **log entry** for **warn** and **crit** (and optionally compact **ok** summary once per run to avoid noise — Team Lead prefers **warn/crit** mirrored to log per client).
   - Export `initSiteDiagnostics()` called from `js/app.js` **once** after Alpine/dashboard bootstrap safe point.

2. **Status widget**
   - Renders rows with **green / amber / red** (Tailwind: e.g. `text-emerald-400`, `text-amber-400`, `text-red-400` — align with **cyan/dark** style guide).
   - Shows overall pill or worst-of summary.
   - Subscribes to probe refresh (initial + interval/re-run).

3. **Log widget**
   - Terminal-like: **newest at bottom**, scrollable **up** for older lines (`overflow-y-auto`, stable scroll unless user pinned — optional).
   - Filters optional: All / Warn+Error — nice-to-have.

4. **Defaults & migration:** `DEFAULT_TOOLS_WIDGETS` → status + log; migration for legacy placeholder-only row.

5. **Docs:** Update `team/style-guide.md` § Tools / diagnostics patterns if new visible patterns.

### Acceptance

- Fresh profile / cleared tools storage shows **Status** + **Log** on Tools page.
- Visiting **Home first**, then Tools, shows widgets already populated from startup probes/log capture.
- Warning/critical probes produce **visible log lines** in Log widget.
- No duplicate widget titles inside cards.
- Destroy/re-render does not duplicate hooks or listeners.

### Definition of done

All acceptance bullets pass in interactive browser; `calvybots_` keys respected; server sync path unchanged for tools rows (Status/Log rows serialize like other tools widgets).

---

## Backend Dev

**Owner:** Backend Dev  
**Primary files:** `api/server.js` (verify-only), `nginx-site.conf` (only if required).

### Tasks

1. Confirm **`GET /api/health`** returns stable JSON suitable for client probe (status field or `{ ok: true }`); adjust **only if** current response breaks parsing or lacks HTTP 200 on healthy container.
2. Confirm **`location /api/`** proxy passes health unchanged; no accidental cache headers on `/api/health`.
3. No change to **service worker** `/api/` bypass rule.

### Acceptance

- Document in chat or one-line comment if unchanged: probe contract for Frontend.

### Definition of done

Frontend probe against `/api/health` succeeds against running Docker stack on LAN.

---

## QA

**Owner:** QA Engineer  
**References:** `tests/test-plan.md`, `tests/usability-checklist.md`, this file.

### Tasks

1. Cold load **Home** → navigate **Tools**: Status shows probe results; Log shows startup entries.
2. Simulate **warn**: e.g. stop API container → reload → health probe **warn/crit** + log entry; restore API → re-run probe shows recovery if interval refresh exists.
3. Confirm **console.warn** from manual snippet appears in Log widget (if hooked).
4. **Regression:** widget add/remove on Tools still persists; **no** `/api/` caching by SW (existing checklist).
5. Structured verdict: Pass / Pass with notes / Fail with severities.

### Definition of done

Structured QA verdict delivered to Team Lead with sign-off recommendation.

---

## Dependency order

1. Frontend implements diagnostics module + widgets + defaults (can land first).  
2. Backend verify-only in parallel.  
3. QA after Frontend merge or against branch.
