# Assignment: Debug strip — export / import server widget document

**Date:** 2026-05-13  
**Priority:** P2 (debug / operator recovery; adjacent to existing **Force retrieve from server**).  
**Client intent:** Two buttons in the debug footer sync strip (`#widget-sync-strip`, next to force resync):

1. **Export data** — fetch **authoritative server snapshot** and offer a **single-file download** (JSON).
2. **Import data** — user picks **one JSON file**; on success, **upload to server** with **full overwrite** of persisted server document; then align client state so the UI matches what was written.

**Format:** One JSON file, round-trip compatible (export file must be acceptable as import).

---

## Product / architecture resolution (Team Lead)

- In this stack, **“server data”** means the **`/api/widgets`** persisted document (API sidecar → `widgets.json` on the API writable volume), **not** browser `localStorage` alone. `localStorage` remains the client cache; export is explicitly **server-only** so operators can snapshot what the API would serve on cold load.
- **Ambiguity flagged for client:** If the user has **unsynced local edits**, **Export** will **not** include them (by design here). If the product later needs “export everything I see,” that would be a separate **merged export** feature.
- **Known gap:** `api/server.js` currently normalizes PUT/GET around **`widgets`** + **`toolsWidgets`** only; the frontend already syncs **`toolsLandingWidgets`**. Backend must **preserve** that key through GET + PUT so a single exported file is a true round-trip for the full live document shape.
- This slice must stay compatible with the first-open sync assignment in **`team/assignments-first-open-sync-ack-dirty.md`**: after Import succeeds, the client should treat the imported server response as a freshly acknowledged full payload so the next automatic sync does not immediately overwrite it with stale local data.
- **Security posture:** current product baseline is unauthenticated single-user LAN. Import is destructive, so Frontend must require explicit user confirmation; Backend must reject non-JSON requests, oversized bodies, malformed rows, and writes that do not match the accepted server document contract. If the client later wants Internet/shared-user exposure, add auth/operator-token gating before enabling Import.

---

## Backend Dev

**Files:** `api/server.js` (primary); `data/schema.md` if response shape is documented there; `nginx-site.conf` **only** if import bodies need a higher limit than today (measure against `MAX_WIDGET_PAYLOAD_BYTES` + nginx `client_max_body_size`).

**Tasks:**

1. **Round-trip fidelity:** Extend widget document handling so **`toolsLandingWidgets`** (and any other top-level fields the frontend already PUTs today) are **validated where row-shaped** and **persisted**, not dropped. Prefer mirroring frontend normalization rules or a tight whitelist over blind pass-through of arbitrary JSON.
2. **Import semantics:** Existing **`PUT /api/widgets`** (and **`POST /api/widgets`** beacon alias) may remain the write path; no new route is **required** if PUT accepts the same object shape as GET returns. Optional: add **`POST /api/widgets/import`** only if it materially simplifies CORS/multipart (not expected for same-origin JSON).
3. **Overwrite:** Import path must **replace** the on-disk document with the normalized result (same atomic write as today); no merge with previous server file.
4. **Limits & errors:** Enforce existing **`MAX_WIDGET_PAYLOAD_BYTES`** (and 413 behaviour); clear JSON errors for invalid schema / bad rows.
5. **Security (LAN scope):** Auth remains out of scope per product; still reject non-JSON, absurd sizes, and malformed widget rows per existing patterns. Consider rejecting destructive writes that do not use `Content-Type: application/json`; if adding a custom header for CSRF hardening, coordinate with Frontend and keep unload/beacon writes compatible.
6. **First-open compatibility:** If Backend adds ack/session/version fields for the first-open protocol, export/import must preserve or regenerate them according to the API contract without corrupting widget rows.

**Acceptance:**

- `GET /api/widgets` after a PUT that included `toolsLandingWidgets` returns that array (normalized), not stripped.
- Export file from a live stack re-imported via PUT produces **byte-stable or semantically equivalent** document (same `widgets`, `toolsWidgets`, `toolsLandingWidgets`, `updatedAt` behaviour as normal saves).
- Oversized import returns **413** with stable error shape.
- Import does not create an immediate stale local overwrite after success; client state and ack/dirty flags line up with the server response.

**Definition of done:** Backend changes merged; `curl` or container exec proves GET/PUT preserves full document keys used by the dashboard.

---

## Frontend Dev

**Files:** `index.html` (`#widget-sync-strip-actions`), `js/app.js` (handlers, state flags, fetch PUT), `css/style.css` only if layout needs adjustment; **`team/style-guide.md`** if new debug control patterns copy/labels are documented.

**Tasks:**

1. **Export button:** `fetch("/api/widgets", { cache: "no-store" })` (or equivalent project helper), handle non-OK, build a **Blob** from response JSON (pretty-print optional), trigger download with a deterministic filename, e.g. `launchpad-widgets-<ISO-timestamp>.json`. Disable or no-op with clear inline error when **offline** or request fails.
2. **Import button:** Hidden `<input type="file" accept="application/json,.json">` (or visible file picker flow), read as text, `JSON.parse`, minimal structural validation (object with **`widgets` array** required to match server contract).
3. **Destructive confirm:** Before PUT, **confirm** dialog (or accessible modal pattern consistent with app) warning that server + local dashboard state will be overwritten.
4. **Revision contract:** Before `PUT`, ensure the current server revision token is present. Use current in-memory ACK token when available (`_widgetsAckRevision`), otherwise fetch `GET /api/widgets` first and reuse its `revision` after basic validation.
5. **Upload:** `PUT /api/widgets` with `Content-Type: application/json` body = parsed file normalized via `getWidgetPayloadForApi`, and set `expectRevision` to the authoritative revision from step 4. Keep current compatibility headers (`If-Match`/`X-Calvybots-Widgets-Revision`) if already in use, but `expectRevision` must be included in payload.
6. **Stale-write handling:** On `409` where `code: "STALE_REVISION"`, show explicit guidance to re-fetch/retry (do not silently retry with file revision or stale token).
7. **UX errors:** Surface parse errors, validation errors, and API error bodies in the sync strip (reuse `forceShellRetrieveError` pattern or sibling props) without silent failure.
8. **Offline:** Disable import/export when `navigator.onLine === false` or after failed ping — match existing sync strip behaviour where possible.

**Acceptance:**

- Buttons appear **only on Debug** next to **Force retrieve from server**; layout remains usable on narrow widths.
- Export always reflects **current GET** server document, not just in-memory state.
- Import uses live server revision, never file/import-body revision, and user sees imported layout/content after flow completes.
- `/api/` continues to be fetched directly (not SW-cached); no new CDN dependencies.
- Import runs without `EXPECT_REVISION_REQUIRED` in successful paths and shows explicit guidance on `STALE_REVISION` (re-fetch before retry).

**Definition of done:** Interactive pass on LAN stack: export → edit file trivially → import → reload/private tab confirms persistence.

---

## QA (after dev lands)

**Scope:** Debug strip only + API persistence.

**Checks:**

- Export download opens as valid JSON; re-import same file is idempotent (second import succeeds, no duplication drift).
- Import with **bad JSON** / **missing widgets** / **oversized** file: correct error messaging, server file not replaced on rejected import (where applicable).
- **Offline / airplane mode:** controls disabled or errors are sane; no partial server writes on failure mid-request.
- Regression: **Force retrieve from server** unchanged; SW still does not cache `/api/`.

**Verdict:** Structured Pass / Pass with notes / Fail per `qa-engineer` template; chat-only unless client requests `team/qa-*.md` updates.

---

## Definition of done (track)

- Client can snapshot server widget JSON to disk and restore it later with one import action.
- Full document keys used by production sync (including **Tools landing** rows) survive export/import.
- No silent data loss on validation failure.

**Next Team Lead step:** After QA verdict, sign off or queue follow-ups (e.g. merged export if client wants unsynced local included).
