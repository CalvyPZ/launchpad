# Assignments — Widget server sync: interval flush + tab close (2026-05-13)

**Track:** Home + Tools widget content must reach the server reliably so a **fresh/private** session (empty `localStorage`) shows the same notes/to-do data via `GET /api/widgets`.

**Owners:** Frontend Dev (primary), Backend Dev (conditional), QA.

---

## Frontend Dev

**Files:** `js/app.js` (primary), `js/store.js` only if `getWidgetPayloadForApi` / `normaliseWidgetRows` gaps found; `js/widgets/notes.js`, `js/widgets/todo.js` only if widget-level hooks are cleaner than central flush; `team/style-guide.md` only if user-visible sync/error behavior changes.

**Tasks**

1. **Periodic server push (not only GET poll)**  
   While `document.visibilityState === "visible"` and `online`, run an interval (e.g. **2–5s**, align with client “every few seconds”) that calls **`syncToServer()`** when **`_widgetsNeedSync`** is true **or** when there are dirty widget rows (if you introduce a dedicated dirty flag, document it). Avoid stacking duplicate in-flight PUTs; reuse existing `_widgetsSyncInFlight` / abort pattern. Coexist with existing **`WIDGET_SYNC_POLL_MS`** GET reconciliation.

2. **`pagehide` / `beforeunload` flush**  
   Register **`pagehide`** (preferred; covers mobile bfcache) and **`beforeunload`** as needed:  
   - **First:** synchronous `localStorage` write — `saveWidgets` + `saveToolsWidgets` with current `this.widgets` / `this.toolsWidgets` and stable `updatedAt` (match how `persistWidgets` / deferred path sets `_widgetsUpdatedAt`).  
   - **Then:** if `online`, attempt **immediate** server write: prefer **`fetch(..., { keepalive: true })`** for PUT if practical, else **`navigator.sendBeacon`** with `Blob` + `type: application/json` (note: some stacks only allow POST for beacon—if PUT via beacon fails in tests, use `keepalive` fetch only). Clear `_widgetsNeedSync` only after successful response.  
   Remove listeners on Alpine teardown if the app supports re-init (avoid duplicate handlers).

3. **Shorter debounce or coalesce**  
   Reduce **`WIDGET_SYNC_DEBOUNCE_MS`** and/or align widget `persist()` debounce (notes ~350ms) so “type for <1s then close tab” still sets `_widgetsNeedSync` and survives **flush**; document chosen numbers in a short code comment.

4. **Verify nested state in API payload**  
   Confirm `normaliseWidgetRows` keeps **`notesState`** / **`todoState`** on PUT (spot-check `getWidgetPayloadForApi` output shape); fix only if a field is stripped.

**Acceptance**

- Edit notes/to-do in Tab A → open **private/incognito** Tab B → within one poll/GET cycle, **same content** appears (server file `data/widgets.json` contains markdown/tasks).  
- Rapid type + **immediate** tab close → reopen private tab → content present (flush or keepalive PUT succeeded).  
- **Offline:** unchanged — local saves still work; no new errors when `!online` on unload.  
- No duplicate PUT storms: interval + debounce + unload share one coherent “needs sync” gate.

**Definition of done:** All acceptance bullets pass in dev; ready for QA matrix.

---

## Backend Dev

**Files:** `api/server.js`, `nginx-site.conf` — **only if** QA/Frontend prove **413**, validation reject, or truncation of large nested JSON.

**Tasks (verification first)**

1. Confirm current **`client_max_body_size`** and Node body parsing accept a realistic large notes payload (e.g. 100KB+ markdown).  
2. If limits block, raise safely for `/api/` with a comment; ensure atomic write still works.

**Acceptance:** Large PUT with nested `notesState`/`todoState` returns **200**; GET round-trips identical data.

---

## QA

**References:** `tests/test-plan.md`, `tests/usability-checklist.md`; verdict in **chat** unless client requests `team/qa-*.md` updates.

**Test matrix**

| # | Scenario | Pass criteria |
|---|-----------|---------------|
| 1 | Desktop edit → new **private** window | GET-only session shows notes + todos |
| 2 | Rapid edit (<1s) + **immediate** tab close | Private reload shows latest text |
| 3 | Server file | `data/widgets.json` reflects content after edit + few seconds |
| 4 | Offline | Edits still local; reconnect behavior unchanged; unload does not throw |
| 5 | Regression | `sw.js` does not cache `/api/`; polling + edit guards no obvious clobber |

**Risks to log:** **`sendBeacon` only supports POST** — server accepts **`POST /api/widgets`** as alias for **`PUT`** so queued beacons can persist. Do not clear **`_widgetsNeedSync`** on beacon alone (no JS-visible response). **`keepalive`** fetch body size limits (~64KB); **`navigator.onLine` false positives** (existing note in lead-status).

**Verdict:** Structured Pass / Pass with notes / Fail with severities and sign-off recommendation for Team Lead.

---

## Definition of done (track)

Frontend merge implements interval PUT, unload flush, and tuned debounce; Backend only if limits required; QA completes matrix and returns verdict.
