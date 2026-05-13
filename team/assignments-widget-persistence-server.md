# Assignments — Server-persisted dashboard state

**Date:** 2026-05-13

## Context

- The dashboard currently uses `localStorage` only (`calvybots_widgets`), which is not reliable across devices/power cycles of the server host.
- Client requires widget position/layout, type, and widget content to persist centrally for the single-user LAN deployment.
- Existing frontend contract already stores full widget state per instance in `js/store.js` (`notesState`, `todoState`, layout dimensions, title, position).

## Backend Dev

### Scope

1. Add server-side persistence for widget state in a single document:
   - New file target: `data/widgets.json` (or equivalent under `data/`).
   - Include a durable payload format with schema version and last-updated marker.
2. Expose API routes in `api/server.js`:
   - `GET /api/widgets` returns persisted payload.
   - `PUT /api/widgets` (or `POST /api/widgets`) writes validated payload atomically.
3. Add input/output validation and error shapes for malformed payloads.
4. Confirm operational limits for payload growth and request size (Nginx body size if needed).
5. Keep `/api/` no-cache compatible and existing PWA/SW compatibility intact.

### Compose persistence compromise note (2026-05-13)

- Host `/mnt/data/web_app/data` is treated as a read-only seed source to satisfy shared read-only storage constraints.
- Runtime writes use a compose-backed named volume `web_app_api_data` mounted at `/data`.
- Bootstrap behavior in `docker-compose.yml`:
  - if `/data/widgets.json` does not exist and `/seed-data/widgets.json` exists, copy once into `/data/widgets.json`;
  - if `/data/widgets.json` already exists, no overwrite occurs.
- This preserves existing data across `docker compose restart api` and `docker compose down && up -d`.
- Recovery tradeoff: host `/mnt/data/web_app/data/widgets.json` is no longer the live write target; it remains the source snapshot only.
- Export/backup now targets the named Docker volume (or a one-time seeded copy back to host).

### Files

- `api/server.js`
- `data/widgets.json`
- `data/schema.md` (if schema contract is tracked there)
- `nginx-site.conf` (only if body size/caching policy must change)

### Acceptance bullets

- [ ] `GET /api/widgets` returns `200` with a valid JSON object and `Cache-Control: no-store`.
- [ ] `PUT /api/widgets` validates:
  - payload is JSON object,
  - `widgets` is an array,
  - each widget row includes required fields (`id`, `type`, `position`) and optional layout/state fields used by frontend.
- [ ] Invalid payloads return `400` with descriptive `error` and `detail` fields.
- [ ] Persist writes are atomic: write to temp file + fs rename; failed write does not corrupt `data/widgets.json`.
- [ ] `PUT` is resilient to concurrent writes in single-user mode (re-serialize one request at a time or queue updates).
- [ ] Response header for all API routes remains explicit `Cache-Control: no-store`.
- [ ] If request bodies are expected to exceed current reverse-proxy limits, confirm/update `client_max_body_size` with documented reason.
- [ ] No change to `/api/*` service-worker scope/exception (backend remains uncached by frontend SW).

### Definition of done

- Server can store/reload the full widget document for one user across API + nginx + browser restarts.
- Admin can manually edit `data/widgets.json` and dashboard recovers via GET.
- Backend errors are returned in a predictable shape and do not silently drop payload.

## Frontend Dev

### Scope

1. Add API sync path for widgets using existing `loadWidgets()` and `saveWidgets()` flow.
2. On app initialization:
   - fetch `/api/widgets` first,
   - merge or fallback with `localStorage` `calvybots_widgets` using documented policy.
3. On widget changes:
   - persist to localStorage immediately as today,
   - sync to `/api/widgets` with debounce or save-on-change batching.
4. Add partial-failure behavior:
   - if `/api/widgets` fails, keep editing and localStorage updates working,
   - track `sync` pending state,
   - retry automatically on reconnect / periodic reconnect attempt.
5. Add online reconciliation polling:
   - poll `GET /api/widgets` on a short interval while tab is visible (target 3–5s; default 4s),
   - when hidden, slow to lower cadence or pause and resume on return to visible.
6. Handle migration path:
   - keep existing legacy key migration (currently `calvybots_notes` / `calvybots_todo`) unchanged,
   - document fallback precedence in code comments.

### Files

- `js/app.js`
- `js/store.js`
- `js/widgets/notes.js` (as needed if sync status messaging is surfaced there)
- `js/widgets/todo.js` (as needed if sync status messaging is surfaced there)
- `team/style-guide.md` (only if UI-visible sync/error status is introduced)

### Merge and merge-policy default (document in code + assignment)

- Primary load policy: Prefer server payload when reachable; if both server and local payloads have no `updatedAt`, use server-first for clean single-user state.
- If local payload has later `updatedAt` than server and API is reachable, push local to `/api/widgets` and recover once successful.
- If local and server timestamps are equal/absent, prefer server on restart and keep local as source of truth for current session only.
- If `/api/widgets` fails, continue with localStorage and queue sync for next successful network event.
- Polling merge policy:
  - apply remote snapshot only when `server.updatedAt` (or comparable marker) is strictly newer than the last applied client snapshot marker.
  - do not apply while `hasPendingSync` or a local widget input/contenteditable is in active edit focus;
  - if a newer remote snapshot arrives during those guards, defer and reconcile once guard clears.

### Acceptance bullets

- [ ] On startup, dashboard renders with server payload when `/api/widgets` succeeds (position, type, names, content all visible).
- [ ] If server fetch fails (offline/network error), dashboard transparently falls back to localStorage without blocking save/load.
- [ ] Save path persists to localStorage and eventually syncs to server (with retry on visibility change / reconnect / manual refresh).
- [ ] Save-on-change is rate-limited (debounce or coalescing) to avoid excessive writes on rapid resize/text edits.
- [ ] Errors from sync are surfaced in a non-blocking way and do not lose edits.
- [ ] Existing merge behavior in `migrateLegacyIfNeeded()` continues to migrate legacy keys where present.
- [ ] Online reconciliation keeps long-lived open tabs aligned within ~3–5s while visible.
- [ ] In-flight local edits are never overwritten by stale or conflicting pulls; pull applies after local `hasPendingSync` / focused-editor windows clear.

### Definition of done

- Server-backed persistence is enabled end-to-end with fallback.
- One-user power-cycle/device transfer test passes for widget layout + content + title + positions.
- Offline mode remains functional and does not clear state.
- No schema regressions in widget rows currently in user runtime.

## QA handoff

### Frontend + Backend sign-off criteria

- Static + interactive verification pass for load/save, power-cycle, API unavailable fallback, and conflict resolution policy.
- Confirm `/api/widgets` not served from SW cache and not bypassing online behavior.
- Confirm no existing widget rendering regressions in:
  - dashboard load,
  - add/remove/reorder,
  - resize persistence,
  - notes/task edit flows.
- Multi-tab/device consistency case: change a note or to-do in one tab, confirm another open tab reflects the remote change within the acceptance window without replacing or corrupting the active local edit state.

