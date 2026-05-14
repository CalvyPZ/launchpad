# Assignment: First-open sync ack gate + dirty-only push

**Date:** 2026-05-13  
**Priority:** P1 (prevents first-open clobber and reduces no-op server writes).  
**Client intent:** When a user first opens the site, the client must receive all widget-related data in one coherent transfer, apply it fully, acknowledge receipt, and only then be allowed to send widget updates back to the server. After ack, pushes must happen only after actual local data changes.

---

## Product / architecture resolution (Team Lead)

- **Single coherent transfer:** `GET /api/widgets` is the canonical full payload and must include every widget-related surface the app uses today: `widgets`, `toolsWidgets`, `toolsLandingWidgets`, shared `updatedAt`, and any server metadata needed for version/ack handling.
- **Ack gate:** A fresh client session must not write `PUT` / `POST /api/widgets` until it has applied the full server payload and sent an explicit acknowledgement. The ack can be a new endpoint, e.g. `POST /api/widgets/ack`, or a strict header/body field on a lightweight request. Backend Dev owns the final contract.
- **Dirty-only push:** After ack, the frontend should suppress pushes unless the serialized local payload has changed since the last acknowledged/applied/successfully-pushed payload. Backend should reject or no-op writes that carry the same version/hash as the current server document when feasible.
- **Conflict primitive:** Prefer a simple server `version` / `revision` / `etag` string and/or content hash returned on `GET`. Frontend stores that value for the session and includes it on write. Backend can reject stale writes with `409` or no-op writes with `204` / `200 { skipped: true }`; choose one stable API shape and document it in code.
- **Compatibility:** Existing localStorage remains the offline cache. If `/api/widgets` is unavailable on first open, the app may use local fallback but must keep outbound sync blocked until it can complete a server fetch/apply/ack cycle, unless the client explicitly approves offline-first writes.

---

## Backend Dev

**Files:** `api/server.js` (primary); `data/schema.md` if API shape is documented there; `nginx-site.conf` only if body/header limits need adjustment.

**Tasks:**

1. **Full payload contract:** Ensure `GET /api/widgets` returns the complete widget document (`widgets`, `toolsWidgets`, `toolsLandingWidgets`, `updatedAt`, `schemaVersion`) in one response.
2. **Version / hash:** Add or expose a stable server revision primitive for the current document. Acceptable options: strong `ETag`, monotonic `revision`, or content hash. Keep it deterministic across GET until the document changes.
3. **Ack endpoint / contract:** Implement a lightweight client ack after full payload receipt, e.g. `POST /api/widgets/ack` with `{ revision }`, or document why a header-based ack is safer. The ack should validate that the revision exists / matches current server state.
4. **Write gate:** Require subsequent `PUT /api/widgets` writes to include the acknowledged revision/hash for this session or request. Reject missing/stale acknowledgements with a clear `409` or `428` JSON error unless compatibility concerns require a transitional warning path.
5. **Dirty/no-op policy:** Detect no-op writes where the normalized incoming payload is semantically identical to the current document. Return a stable success/skip response without rewriting the file.
6. **Logging:** Log ack accept/reject, stale write rejects, and no-op write skips at similar verbosity to current widget write diagnostics.
7. **Security:** Keep strict JSON-only handling and `/api/` no-store responses. If adding CSRF-style custom headers for destructive writes, coordinate with Frontend and preserve `sendBeacon`/unload compatibility or explicitly retire beacon for gated writes.

**Acceptance:**

- `GET /api/widgets` delivers all widget-related arrays in one response.
- A write before ack is rejected or suppressed by contract; a write after valid ack succeeds when data changed.
- A no-op write after valid ack does not rewrite `widgets.json` and returns a recognizable skipped/no-op result.
- Stale revision write is rejected with a stable error shape and does not overwrite current server data.

**Definition of done:** API contract implemented or explicitly documented with code comments; Frontend has enough response/header fields to implement ack + dirty guards; no `/api/` SW caching introduced.

---

## Frontend Dev

**Files:** `js/app.js` (primary sync flow); `js/store.js` if serializer/helpers need canonical snapshots; `index.html` only if Debug strip messaging changes; `team/style-guide.md` if user-visible sync state/copy changes.

**Tasks:**

1. **Bootstrap fetch:** On app init, fetch `/api/widgets` once as the full server document and apply all widget surfaces together: Home, Debug tools widgets, and Tools landing widgets.
2. **Ack after apply:** Only after the full payload is applied and persisted to localStorage, send the ack using Backend's chosen contract. Store ack/revision state in memory for the session.
3. **Outbound block:** Prevent `syncToServer`, debounced PUT, interval PUT, pagehide flush, and beacon fallback from sending before ack succeeds. The Debug strip should surface a sane status such as "waiting for server snapshot" / "ack pending" if needed.
4. **Dirty detection:** Maintain a canonical serialized snapshot or hash of the last applied/successfully pushed payload. Set `_widgetsNeedSync` only when local widget data actually differs from that snapshot.
5. **Conditional push:** Include the acknowledged server revision/hash on writes. On `409` / `428` / stale response, keep local data, mark sync failed/pending, and avoid blind overwrite.
6. **Import interaction:** After successful Debug Import, treat the returned server document as the new applied snapshot, send/refresh ack as required, and reset dirty state so stale local timers do not push old data back.
7. **Offline path:** If first-open server fetch fails, allow local display from localStorage but keep server writes blocked until a server fetch/apply/ack succeeds. Do not fabricate a new server-fresh timestamp on fallback.

**Acceptance:**

- Fresh/private first open applies the full server document before any client write can occur.
- Network logs show no `PUT` / beacon write before the ack completes.
- Editing a widget after ack triggers one dirty push path; doing nothing does not produce repeated no-op writes.
- If the server rejects stale/missing ack, the UI keeps local edits and reports sync failure/pending instead of clobbering.
- Existing bootstrap-only remote ingest policy remains: remote updates are applied on reload/first-open, not mid-session polling.

**Definition of done:** Full first-open flow is safe against empty-localStorage clobber; no-op intervals are quiet; Debug strip status remains understandable.

---

## QA (after dev lands)

**Scope:** API contract + client bootstrap/sync flow.

**Checks:**

- **Fresh/private tab:** Clear localStorage/open private tab with server containing known Home + Debug + Tools landing data. Confirm full state appears and no client write occurs before ack.
- **Dirty-only:** Leave app idle for at least two push intervals after ack; confirm no repeated no-op writes or `widgets.json` mtime churn.
- **Actual edit:** Edit Notes/To-Do/Fortnight state; confirm exactly a dirty push path occurs and private/reload later sees the edit.
- **Stale write:** Simulate stale revision if possible; server rejects without overwrite and client reports pending/failure.
- **Import:** Import a valid one-file export; confirm server updates, app state aligns, dirty flag clears, and no stale local overwrite follows.
- **Regression:** `/api/` remains bypassed by `sw.js`; Force retrieve remains shell-only.

**Verdict:** Structured Pass / Pass with notes / Fail with severity, evidence, expected vs actual, and sign-off recommendation for Team Lead.

---

## Definition of done (track)

- First-open sync cannot overwrite server data with defaults or stale local cache.
- Server and client agree on an ack/version contract.
- Client sends widget data only after real local changes and only after the initial server payload is fully received and acknowledged.
