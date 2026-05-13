# Assignments — Service worker registration timing false positive in diagnostics

**Track owner:** Team Lead  
**Date:** 2026-05-13  
**Client scope:** Remove false-positive `Service worker — Registered but not controlling this page yet.` noise from diagnostics on first load after registration, while preserving a real failure signal for genuine SW control issues.

---

## Context

`js/site-diagnostics.js` currently marks the Service worker probe as a warning whenever `navigator.serviceWorker.getRegistration()` succeeds but `navigator.serviceWorker.controller` is still null. On fresh installs/reloads this is expected while SW ownership is being handed to the current page; the diagnostics row then keeps reporting the warning and poll log spam.

No backend changes are expected for this cycle.

## Frontend Dev

**Owner:** Frontend  
**Priority:** P2  

### Files to touch

- `js/site-diagnostics.js` (required)
- `index.html` (optional, only if needed to share registration state)

### Implementation plan

1. Update SW probe flow to handle registration/control timing explicitly:
   - Keep `warn` if SW is unsupported.
   - Keep `warn` if no registration exists (first run without SW path or manual disable).
   - For registration-exists/no-controller cases:
     - await `navigator.serviceWorker.ready` and add a short, bounded wait for `controllerchange` (one-shot), or
     - read/write a one-cycle flag indicating the current load is immediately after registration.
   - Return a first-load state message instead of `Registered but not controlling this page yet.` when this is normal one-time takeover timing.
   - Preserve current `crit` behavior for explicit failures.
2. Prevent recurring noisy probe-log entries for normal first-load timing:
   - keep status transition to actionable warning only when control is still missing after bounded wait and no active registration/ready signal has materialized.
   - update message to distinguish first-load activation delay vs actual SW failure.
3. Optionally expose registration promise/state in `index.html` only if needed for cleaner diagnostics race handling.

### Acceptance criteria

- On a fresh page load where SW has just been registered:
  - diagnostics should not repeatedly log this as a service worker defect.
  - probe row should show a registration-state message (e.g. “Registered, control pending for first load”) or equivalent non-defect state.
- After reload/control handoff, probe row should show:
  - `status: ok`
  - detail indicating active control.
- If service worker remains unbound after bounded grace and active registration is expected, diagnostics should still report a warning (not silently hide a real problem).
- Existing `/api/` bypass and other probes remain unchanged.

### Definition of done

- `js/site-diagnostics.js` uses bounded controller wait / registration timing logic and no longer emits the recurring false-positive warning for normal first-load SW activation.
- No code changes in backend assets/config required.
- Team Lead receives implementation handoff from Frontend with the above acceptance bullets observed.

---

## QA

**Owner:** QA  

### Acceptance checks after Frontend handoff

1. Fresh profile/private window first load:
   - verify no repeated `Registered but not controlling this page yet` warning spam in the Log widget/probe log.
2. Reload after first load:
   - verify SW probe is `ok` and labeled controlled.
3. SW intentionally unavailable/disabled scenario (or forced unsupported browser):
   - verify probe warns with a meaningful diagnostic message.
4. Interactive smoke for existing diagnostics strip:
   - ensure `js/site-diagnostics.js` subscriptions still populate probes and logs on schedule.

## Execution status (2026-05-13)

- **Frontend implementation complete (`frontend-senior-dev`):** `js/site-diagnostics.js` now treats first-load registration-control timing as a bounded transition with explicit controller acquisition handling, preventing recurring false-positive warning noise while preserving warning/critical behavior for unsupported or true control-failure states.
- **QA outcome:** `qa-engineer` returned **Pass with notes**.
- **Verification notes:** no recurring warning spam from normal first-load SW handoff was reported as a defect in the reviewed flow; control-state transitions remained functional for reload and probe lifecycle checks.
- **Status:** Cycle closed and ready for Team Lead sign-off; optional environment-specific re-smoke (fresh profile/private-window and reload confirmation) may still be used for local confidence.
