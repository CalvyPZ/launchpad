# Assignment: Widget sync revision transport + diagnostics masking

**Date:** 2026-05-14  
**Track:** Fix `PUT /api/widgets` revision transport mismatch and make sync diagnostics actionable.

## Context

Client report: repeated diagnostics lines read `Widget sync save failed {}` after
sync attempts, while API writes intermittently returned `400 EXPECT_REVISION_REQUIRED`.
Backend write handling in `api/server.js` requires one of:

- `expectRevision` in request body
- `If-Match` header
- (temporary compatibility alias) `x-calvybots-widgets-revision` header

Existing frontend write payload construction did not reliably provide backend-recognized
revision metadata in the JSON body for all transport paths.

---

## Frontend Dev

### Owner files
- `js/app.js`
- `js/site-diagnostics.js`
- `team/style-guide.md` (only if user-visible sync/error copy or patterns are changed)

### Tasks

1. In `syncToServer`, after `nextPayload` assembly, inject normalized ack revision into
   the outbound body (`expectRevision`) when available from client state.
2. For normal (non-keepalive) fetch PUT, also add `If-Match: "<revision>"` so the backend
   can validate writes on header or body.
3. Ensure keepalive/pagehide flow keeps the same revision payload in `serializedPayload`
   so beacon-based writes preserve the token when headers are unavailable.
4. Improve failed-PUT messaging path:
   - parse response body details (`detail`, `error`, `message`)
   - emit combined failure text through the existing failure hooks.
5. In `js/site-diagnostics.js`, replace generic `Error` serialization with safe,
   explicit extraction (`name`, `message`, `stack`, and optional `detail`) so logs do
   not collapse to `{}`.

### Acceptance

- Normal `PUT /api/widgets` succeeds after ACK when the client has a valid `_widgetsAckRevision`.
- keepalive fallback payload still contains a revision token.
- failing writes expose readable sync failure text in diagnostics (`lastWidgetPushFailure`,
  sync strip, console hook output).
- no visible UI behavior regression outside sync/error messaging.

---

## Backend Dev

### Owner file
- `api/server.js`

### Tasks

1. Keep `readExpectRevisionFromRequest` contract stable for body/header flow:
   - accept `parsed.expectRevision`
   - accept `If-Match`
2. Optionally accept `x-calvybots-widgets-revision` as compatibility alias during this transition.
3. Keep contract comments and `EXPECT_REVISION_REQUIRED` detail aligned with accepted fields.

### Acceptance

- write requests are rejected with `EXPECT_REVISION_REQUIRED` only when no token is present.
- stale revision semantics (`409 STALE_REVISION`) remain unchanged.

---

## QA

### Owner
- `qa-engineer`

### Test matrix

1. Fresh boot path:
   - confirm `GET /api/widgets` then ACK path before any PUT.
   - verify no 400 `EXPECT_REVISION_REQUIRED` while write-gating is open.
2. Revision propagation:
   - perform a normal sync and confirm token reaches backend and is accepted.
   - perform pagehide flush with keepalive path and verify payload includes revision token.
3. Error readability:
   - force a predictable 409/400 and confirm diagnostics show actionable text (not `{}`).

### Definition of done

- Assignment scope is fully implemented.
- QA verdict with severity-ranked findings and sign-off recommendation is provided.
- If environment blocks runtime confirmation, this is explicitly called out before closure.

## Delegation refresh (2026-05-14, executable slice)

### Frontend implementation packet

- **Owner:** `frontend-senior-dev`
- **Files:** `js/app.js`, `js/site-diagnostics.js`
- **Contract:** include `expectRevision` in every sync payload, with header kept as compatibility.
- **Required behavior:**
  - On startup/after ACK, revision basis is authoritative and reused for all queued syncs.
  - `syncToServer()` must keep `expectRevision` in JSON for normal PUT and keepalive/pagehide payload.
  - `Widget sync save failed ...` diagnostics must show readable details (not `{}`).
  - Preserve existing no-op/no-change behavior and dirty flags.

### Backend implementation packet

- **Owner:** `backend-senior-dev`
- **File:** `api/server.js`
- **Contract:** require `expectRevision` in body or `If-Match` header; compatibility alias accepted if implemented and documented.
- **Required behavior:**
  - `EXPECT_REVISION_REQUIRED` occurs only when no accepted revision source is present.
  - conflict/stale responses remain `409` with detail useful to sync diagnostics.
  - keep contract comments and error bodies aligned with frontend expectations.

### QA integration packet

- **Owner:** `qa-engineer`
- **Test host:** live validation host (prefer HTTPS primary host first, then LAN fallback)
- **Validation checklist:**
  1. Bootstrap flow: `GET /api/widgets` → apply → ACK success before outbound sync.
  2. POST-edit PUT: confirm backend accepts revision-aware `PUT` with `expectRevision`.
  3. Stale/missing revision: confirm user-visible diagnostics include actual status + detail.
  4. Unload/path: confirm keepalive/pagehide includes revision payload.
  5. Verify no repeated `Widget sync save failed {}` masking remains.
- **Exit criteria:** structured QA verdict with evidence lines and sign-off recommendation.
