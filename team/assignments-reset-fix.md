# Assignments — Production Reset Bug Fix

**Track:** P0 critical — dashboard resets to defaults every ~1 min  
**Date:** 2026-05-13  
**Assignment file owner:** Team Lead  
**Cycle:** Backend + Frontend in parallel → QA

---

## Context

Client reported that https://web.calvy.com.au resets to default widget layout roughly every minute. Root-cause analysis identified:

1. **Missing disk-write diagnostics** — `api/server.js` has no logging for write success/failure or the resolved WIDGETS_PATH, so we cannot confirm whether writes ever reach disk in production.
2. **`data/widgets.json` is git-tracked** — a `git reset --hard` or deployment script on the production server silently restores it to defaults, wiping all user data.
3. **Init timestamp bug (frontend)** — `persistWidgets({ sync: false })` during `init()` stamps default widgets with `new Date().toISOString()` when `_widgetsUpdatedAt` is null (fresh private tab). `_reconcilePayloadLocally` then sees local timestamp as newer than any real server payload → discards server data and keeps defaults.

---

## Task 1 — Backend Senior Dev

**Owner:** `backend-senior-dev`  
**Primary files:** `api/server.js`, `.gitignore`  
**No changes required to:** `docker-compose.yml` (`:rw` mount already in place), `nginx-site.conf`, `sw.js`

### Acceptance criteria

1. **Startup log:** Add `console.log('[api] WIDGETS_PATH resolved to:', WIDGETS_PATH)` immediately after the `WIDGETS_PATH` constant is declared (module-top-level, runs once on process start).

2. **Write-success log:** In `writeWidgetsAtomic`, after `await fsp.rename(tmpPath, WIDGETS_PATH)` succeeds and before the `finally` block, add:
   `console.log('[api] writeWidgetsAtomic OK, wrote', WIDGETS_PATH)`

3. **Write-failure log:** Wrap `writeWidgetsAtomic` body so that any thrown error is logged before re-throwing:
   `console.error('[api] writeWidgetsAtomic FAILED:', error)` — place this in the `catch` of the try/finally (add an explicit try/catch/finally if needed), ensuring the error is still re-thrown after logging.

4. **GET log:** In `handleGetWidgets`, after `const doc = await readWidgetsFromDisk()`, add:
   `console.log('[api] GET /api/widgets → updatedAt:', doc.updatedAt)`

5. **PUT log:** In `handlePutWidgets`, immediately before `await queueWidgetPersist(normalized.value)`, add:
   `console.log('[api] PUT /api/widgets → persisting, payload updatedAt:', normalized.value.updatedAt)`

6. **Git-ignore `data/widgets.json`:** Add `data/widgets.json` to `.gitignore`. Then run `git rm --cached data/widgets.json` so git stops tracking it (live data on disk is preserved; git history keeps the old snapshot; future `git reset --hard` or `git pull` will not overwrite it). Commit both the `.gitignore` change and the `git rm --cached` effect together.

   - The `ENOENT` path in `readWidgetsFromDisk` already returns `buildDefaultWidgetDocument()`, so a missing file on a fresh deployment seeds correctly from code — no template file needed.
   - Do NOT delete or rename `data/widgets.json` from the workspace; just stop git tracking it.

### Definition of done

- All five `console.log`/`console.error` calls are present and correct.
- `data/widgets.json` appears in `.gitignore`.
- `git ls-files data/widgets.json` returns empty (file is no longer tracked).
- Committed with a clear message referencing the P0 bug.

---

## Task 2 — Frontend Senior Dev

**Owner:** `frontend-senior-dev`  
**Primary files:** `js/app.js`, `js/store.js`  
**No changes required to:** `index.html`, `css/style.css`, `js/widgets/*.js`, `team/style-guide.md`

### Acceptance criteria

1. **Init local-timestamp log:** In `init()`, immediately after `this._widgetsUpdatedAt = localDocument.updatedAt` (line ~247), add:
   ```
   console.log('[launchpad] init: localDocument.updatedAt =', this._widgetsUpdatedAt);
   ```

2. **Reconcile decision log:** In `_reconcilePayloadLocally`, after the `remoteLooksNewer` expression is computed and before the guard check (line ~491), add:
   ```
   console.log('[launchpad] reconcile(' + trigger + '): remoteTs =', payload.updatedAt, 'localTs =', localTs, 'remoteLooksNewer =', remoteLooksNewer);
   ```

3. **PUT failure log:** In `syncToServer`, replace the existing generic catch log on the `!response.ok` throw path. The existing code throws `new Error(\`PUT ... failed: ${response.status}\`)` and then catches it with `console.error("Widget sync save failed", error)`. That generic log is fine to keep, but also add — directly after the `!response.ok` check, before throwing — a more specific log:
   ```
   console.error('[launchpad] PUT /api/widgets FAILED — status:', response.status);
   ```
   Also ensure `_widgetsNeedSync` is NOT cleared in the `!response.ok` path (confirm it remains `true` so the next push timer retries). Looking at the existing code: `_widgetsNeedSync = false` is only set after `response.ok` → this is already correct; add a confirming comment if helpful.

4. **Fix init timestamp bug (critical):**

   **Root cause:** When `_widgetsUpdatedAt` is null (fresh private tab with no localStorage data), `persistWidgets({ sync: false })` at line ~279 of `init()` calls:
   ```javascript
   saveWidgets(this.widgets, { updatedAt: this._widgetsUpdatedAt || new Date().toISOString() });
   ```
   `saveWidgets` in `store.js` also applies `|| new Date().toISOString()` as a fallback when `options.updatedAt` is null. The result is that default widgets get stamped with the current time, causing `_reconcilePayloadLocally` to see the local payload as newer than any real server data and discard it.

   **Fix in `js/app.js` — `persistWidgets` method (line ~462–468):**
   Change the `doSync === false` branch from:
   ```javascript
   saveWidgets(this.widgets, { updatedAt: this._widgetsUpdatedAt || new Date().toISOString() });
   ```
   to:
   ```javascript
   saveWidgets(this.widgets, { updatedAt: this._widgetsUpdatedAt });
   ```
   (Remove the `|| new Date().toISOString()` fallback — when there is no prior timestamp, we must not fabricate one.)

   **Fix in `js/store.js` — `saveWidgets` function (line ~451–462):**
   Change the `updatedAt` resolution from:
   ```javascript
   const updatedAt = parseUpdatedAt(options.updatedAt) || new Date().toISOString();
   ```
   to:
   ```javascript
   const updatedAt = 'updatedAt' in options
     ? (parseUpdatedAt(options.updatedAt) || null)
     : new Date().toISOString();
   ```
   This preserves `null` when `updatedAt` is explicitly passed as null/undefined (no-timestamp init write), while still generating `new Date()` when the caller passes no `updatedAt` key at all (i.e. `saveWidgets(w, {})` or `saveWidgets(w)`). Callers that already pass a real ISO string (e.g. `persistWidgetsDeferredSync`) are unaffected.

   **Fix in `js/app.js` — `persistToolsWidgets` method (line ~204–212):**
   The same `|| new Date().toISOString()` fallback exists at line ~208:
   ```javascript
   saveWidgets(this.widgets, { updatedAt: this._widgetsUpdatedAt || new Date().toISOString() });
   ```
   Change this to:
   ```javascript
   saveWidgets(this.widgets, { updatedAt: this._widgetsUpdatedAt });
   ```
   for the same reason — the tools-widgets sync-false path during init has the identical bug.

5. **`flushWidgetsBeforeExit` — keep existing behaviour:** The flush path at line ~445 already uses `this._widgetsUpdatedAt || new Date().toISOString()` before calling `saveWidgets`. This is correct for the exit path — a real exit always has either a real prior timestamp or genuinely needs one stamped. Do NOT change this line.

### Definition of done

- Five diagnostic log lines present and syntactically correct.
- `persistWidgets({ sync: false })` passes `{ updatedAt: this._widgetsUpdatedAt }` (no `||` fallback).
- `persistToolsWidgets({ sync: false })` passes `{ updatedAt: this._widgetsUpdatedAt }` (no `||` fallback).
- `saveWidgets` in `store.js` uses the `'updatedAt' in options` ternary so null is preserved when explicitly passed.
- `flushWidgetsBeforeExit` is unchanged.
- All changes committed with a clear message referencing the P0 bug.

---

## Task 3 — QA Engineer

**Owner:** `qa-engineer`  
**Run after:** Backend and Frontend tasks are both committed.

### Steps

1. Start Docker stack:
   ```bash
   sudo dockerd &>/dev/null & sleep 3
   sudo mkdir -p /mnt/data && sudo ln -sf /workspace /mnt/data/web_app
   cd /workspace && sudo docker compose up -d
   sudo docker compose ps
   curl -sf http://localhost:8033/ && echo "nginx OK"
   curl -sf http://localhost:8033/api/health && echo "api OK"
   ```

2. Confirm `data/widgets.json` is git-ignored:
   ```bash
   git ls-files data/widgets.json   # must return empty
   grep 'data/widgets.json' .gitignore   # must match
   ```

3. Check Docker logs for startup diagnostics:
   ```bash
   sudo docker compose logs --tail=30 api
   ```
   Expect to see `[api] WIDGETS_PATH resolved to: /data/widgets.json`.

4. Perform browser smoke test using `computerUse` subagent:
   - Open https://web.calvy.com.au in a **new private/incognito window**.
   - In the **Notes widget**, type a unique test string (e.g. "QA-RESET-TEST-{timestamp}").
   - In the **To-Do widget**, add at least 2 tasks.
   - Wait **at least 90 seconds** (observe the clock widget ticking).
   - Confirm the notes content and tasks are still present in the same window.
   - Open a **second new private window** to https://web.calvy.com.au.
   - Confirm the notes content and tasks appear (server persisted correctly).
   - Check browser console for `[launchpad]` logs — confirm the reconcile log shows correct decision.

5. Check Docker logs after the smoke test:
   ```bash
   sudo docker compose logs --tail=50 api
   ```
   Look for `[api] writeWidgetsAtomic OK` or `[api] writeWidgetsAtomic FAILED`. Report findings with log excerpts.

6. **Report:** Structured verdict — **Pass / Pass with notes / Blocked / Fail** — with:
   - Evidence: screenshots, log excerpts.
   - Findings: severity, file:line, expected vs actual.
   - Sign-off recommendation for Team Lead.

### Definition of done

- Containers start cleanly.
- `data/widgets.json` not tracked by git.
- WIDGETS_PATH startup log visible.
- Notes + To-Do content survive 90 seconds in the same window AND appear in a fresh private window.
- No `writeWidgetsAtomic FAILED` errors in logs.
- Structured verdict recorded in chat (Team Lead will update `team/lead-status.md`).
