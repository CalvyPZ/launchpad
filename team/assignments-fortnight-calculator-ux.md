# Assignment: Fortnight calculator widget — calculate-gated UX

**Date:** 2026-05-13  
**Priority:** P1 (Tools landing primary utility)

## Context

- **Baseline:** `js/widgets/fortnight-tools.js` calls `normalizeFortnightState` on every `input`/`change`, clamps range and line numbers, uses `min="1"` `max="99"` on number fields, and updates the cyan result sentence continuously.
- **Out of scope:** Changing the advancing-Sunday fortnight algorithm in `calculateLine` / `countFortnightAdvancingSundays`.
- **Storage note (client):** Widget storage resets were limited to Tools landing migration; there was **no** global wipe of home widgets — preserve that understanding in QA regression mindset.

## Team Lead — persistence decision

- **Persist `fortnightState` only after a successful Calculate** (normalized, validated values that produced the shown outcome).
- **Do not** persist clamped or “repaired” state on every keystroke; while the user is typing, keep **draft** values in the widget only (DOM + in-memory closure state), not merged into store as authoritative until Calculate succeeds.
- On reload, the user sees the **last successfully calculated** inputs and the **same outcome sentence** (recomputed from stored state is fine if numerically equivalent).
- `mergeFortnightState` in `js/store.js` remains the load/API normalizer for malformed persisted data; adjust **only** if the persisted shape or validation rules change (prefer minimal change: widget ownership of calculate vs load).

## Frontend Dev (`frontend-senior-dev`)

**Owner:** Frontend  
**Primary files:** `js/widgets/fortnight-tools.js`; `js/store.js` only if `mergeFortnightState` or serialization needs a small, documented tweak; `team/style-guide.md` if new error/primary-button patterns are introduced.

**Tasks:**

1. **Free entry:** Remove or relax HTML `min`/`max` on numeric fields so the browser does not block partial or out-of-range typing. Date inputs may stay `type="date"` (native picker); if empty/invalid intermediate dates are a problem, document behavior and still validate on Calculate only.
2. **Draft vs commit:** Stop calling normalization that mutates/clamps **on each `input`/`change`**. While typing, allow empty/partial numeric strings and do not rewrite sibling fields (e.g. no auto swap rotateFrom/rotateTo during entry).
3. **Calculate (primary):** Add an explicit **Calculate** control (primary affordance, accessible name). **Only** on click (and optionally Enter where appropriate without breaking multiline — N/A here):
   - Validate all fields; on failure, show a **clear, user-facing error message** in the result area (or dedicated alert region) and **do not** show the success sentence or any misleading line number.
   - On success, run existing calculation path and set text to: `On {dateLabel} you will be on line {line}` (same pattern as today after `formatResultDate`).
4. **Persistence:** After **successful** Calculate only: set `row.fortnightState` to the normalized validated snapshot and call the existing persist hooks (`persistToolsLandingWidgets` / `persistToolsWidgets` / `persistWidgets` as today). Remove or narrow the debounced persist-on-every-change path so drafts are not written to storage. Initial mount: hydrate inputs from persisted state and show recomputed success sentence **if** stored state is already valid (last successful calc); if product-wise you prefer “result hidden until Calculate again,” document in style-guide — **default preference:** show last successful outcome on load for continuity.
5. **Destroy:** `destroy()` should still be safe; avoid duplicate listeners.

**Acceptance:**

- User can type freely in numeric fields (e.g. empty, `1`, `12`, transient `123`) without the widget rewriting values mid-entry or blocking keystrokes via `min`/`max`.
- **Calculate** with invalid data shows an explicit error; **no** cyan success sentence implying a line result.
- **Calculate** with valid data shows `On … you will be on line N` consistent with pre-change logic.
- Refresh after success restores inputs and outcome; refresh mid-draft without Calculate does **not** surprise the user with clamped numbers they never submitted (drafts not persisted).
- No regression to Tools landing / Debug / Home persistence paths.

## QA (`qa-engineer`)

**Owner:** QA  
**Target:** Interactive pass on Tools (Fortnight widget); use `https://web.calvy.com.au` when available, else LAN per project norms.

**Matrix:**

1. **Free typing:** Numeric fields accept partial and edge values without immediate clamping or persist side effects; dates behave per implemented rules.
2. **Invalid Calculate:** Multiple invalid cases (empty numbers, non-numeric rubbish, line outside rotate range after validation rules, invalid target/start date if applicable) — message is readable and **no** misleading success line.
3. **Valid Calculate:** Known-good scenario matches expected line and sentence format.
4. **Persistence:** After valid Calculate + refresh, state and sentence match; typing without Calculate + refresh does not persist draft garbage (or documented otherwise).
5. **Regression:** Home widgets and other Tools widgets unaffected; no belief that this change implies global widget storage wipe (see context).

**Deliverable:** Structured verdict (Pass / Pass with notes / Blocked) with severity-tagged findings; update `team/qa-*.md` only if the client requests repo QA doc updates.

## Definition of done

- Frontend acceptance bullets met.
- QA verdict **Pass** or **Pass with notes** with no High-severity open issues.
- Team Lead updates `team/lead-status.md` execution status and can sign off the cycle.
