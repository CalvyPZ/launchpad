# Assignment — Debug: force retrieve from server

**Date:** 2026-05-13  
**Owner:** Frontend Dev (primary); Backend Dev verify-only if SW changes prove necessary; QA after implementation lands.

## Client direction

Add a **“Force retrieve from server”** control on the **Debug** tab that forcibly loads **network-fresh** same-origin shell assets (HTML, CSS, JS, PWA shell) and applies them in the browser, **bypassing stale Cache Storage / service-worker-served shell** where appropriate. Normal navigation and PWA behavior must not regress.

## Files (expected)

| Owner | Files |
|-------|--------|
| **Frontend** | `index.html` (Debug-scoped markup), `js/app.js` (handler + Alpine wiring), `css/style.css` only if new classes are needed, `team/style-guide.md` if a new debug/control pattern is introduced |
| **Backend** | None unless Frontend requests a `sw.js` `message` handler or cache-name coupling; then `sw.js` only |
| **QA** | Verdict in chat unless client requests `team/qa-*.md` updates; trace to `tests/test-plan.md` / `tests/usability-checklist.md` where applicable |

## Implementation notes (non-prescriptive)

- Prefer **clearing Cache Storage** for this origin (delete existing cache keys, including the active shell cache name used in `sw.js` — today `launchpad-v5`) then **`location.reload()`** so the next load hits the network under the existing **network-first** SW strategy.
- Alternative acceptable if equivalent: `fetch` shell URLs with `cache: 'no-store'` plus reload — must actually replace what the user sees (full document reload is the simplest guarantee).
- **Do not** cache `/api/` from SW (existing rule); this feature is **shell / same-origin app assets**, not API payload refresh.
- **localStorage** / widget data: do **not** wipe as part of this action unless explicitly requested later — client asked for shell refresh, not data reset.
- If unregistering the service worker is considered, document tradeoffs (extra registration flicker, offline until reinstall); **default expectation:** cache clear + reload without unregister unless needed to fix a stuck controller.

## Acceptance criteria (Frontend)

1. **Debug-only visibility:** The control appears only in **Debug** context (e.g. inside `#page-debug` or the existing debug-only footer `#widget-sync-strip` area with `x-show="currentPage === 'debug'"`). It is **not** shown on Home or Tools.
2. **Action:** One primary activation (button or accessible control) **forces** a **network-backed** refresh of the **same-origin** app shell so the user sees server-current HTML/JS/CSS after completion (verify via DevTools: document and shell scripts re-fetched, not only memory repaint).
3. **No routine regression:** Tab switching, edit mode, widget sync strip, and service worker **normal** first-load / online-first behavior remain intact when the button is **not** used.
4. **Accessibility:** Exposed **accessible name** (e.g. `aria-label` or visible text) describing force reload from server / bypass cache; focusable and keyboard-activatable; disabled or inert state during the brief clear+reload sequence if needed to prevent double-fire.
5. **Failure UX:** If `caches` API or SW APIs reject (unsupported context), show a **non-throwing** user-visible message on Debug (e.g. strip or inline) and suggest hard refresh — do not break Alpine boot.

## Definition of done

- All acceptance bullets met in code review + targeted interactive pass.
- `team/style-guide.md` updated if the new control introduces or reuses a documented pattern (tokens, focus, debug-only affordances).
- Commit includes every file touched for the deliverable (including `team/` per project policy).

## QA matrix (after Frontend lands)

1. **Happy path (online):** Open Debug → activate **Force retrieve** → page reloads → server-updated shell visible (e.g. bump a comment in `index.html` on server, confirm appears after action).
2. **SW / cache:** Before action, note Application → Cache Storage contents; after action, caches cleared or repopulated from network; SW still registers and controls page (no permanent SW loss unless product intentionally unregisters).
3. **Regression:** Home/Tools navigation, widget persistence (localStorage + optional `/api/widgets`), sync strip labels still sane.
4. **Offline / edge:** If offline, action should fail gracefully (message or no-op) without corrupting state — not crash Alpine.
5. **HTTPS:** Prefer `https://web.calvy.com.au` when available per `team/lead-status.md`; fallback LAN `http://192.168.1.245:8033`.

**Verdict:** Pass / Pass with notes / Blocked with severities and sign-off recommendation for Team Lead.
