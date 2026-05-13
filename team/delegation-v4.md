# CalvyBots Delegation Brief v4

## 1) Project summary
- Client wants a visually richer dark-mode dashboard: stronger depth treatment, stronger surface separation, and a matching cyan accent system.
- Mobile experience must be improved, with native install behavior when added to desktop/mobile home: launch in standalone app-like mode.
- Widget management must happen on the main page: adding/editing should be done in-page, and widget creation must use a dropdown selector.
- Initial widget options should be limited to:
  - Clock
  - Sticky Notes
  - To-Do
- Current widget logic can remain lightweight proofs of concept; focus is UX, layout, and interaction flow.
- Update and lock style guide tokens/usage so future work stays consistent.

### Client amendment — PWA priority (2026-05-13)

- The product must register as a **Progressive Web App** with **basic offline** behavior (cached same-origin shell) while remaining **online-first** in normal use: connected users should get fresh same-origin assets via a **network-first** service worker; `/api/` must not be cached by the worker.
- Manager records full rationale and task split in `team/lead-status.md`; QA uses the PWA supplement in `team/qa-complete-v4.md`.

### Client amendment — Notes & To-Do depth (2026-05-13)

- **Multiple widgets:** Support **any number** of Sticky Notes and To-Do widgets simultaneously; each instance must have **isolated** persisted state (no cross-talk).
- **Persistence:** All instances and their configuration survive **reload and power cycle** (same durability expectation as existing dashboard storage).
- **Renamable:** User can set a **per-widget display name**; defaults should match type labels until customised.
- **To-Do reset schedules:** User can configure lists so tasks **reset on a schedule** — at minimum behaviours equivalent to **daily**, **weekly**, and **never** (non-repeating); reset should occur at **user-configured times** where applicable (document timezone as device local unless otherwise specified).
- **Notes Markdown:** Note content supports **Markdown** with safe rendering.
- **Resize + mobile:** Widgets support **resize** on desktop/tablet where appropriate; on **mobile**, layout remains usable (min sizes, touch-friendly controls, resize does not break scrolling or one-handed use).

Full manager rationale and dev split: `team/lead-status.md` section **Client direction — Notes & To-Do widgets**.

## 2) Frontend Dev tasks
- Update visual theme and depth:
  - Replace remaining purple accent usage with matching cyan variants in Tailwind config and `css/style.css`.
  - Introduce layered card depth in widgets/site sections (surface gradients, glow/border tint, subtle lifted states, stronger separation between shell, header, and cards).
  - Apply a consistent CSS variable/token-driven accent strategy in the style guide + implementation.
  - Audit and tune spacing/typography for mobile first readability.
- Widget system changes in `index.html` / `js/app.js`:
  - Replace `addWidgetPrompt()` with an in-page dropdown control visible in edit mode.
  - Keep widget create/edit actions on the dashboard page; remove any secondary widget editor flow not in main page.
  - Limit allowed types to `clock`, `notes` (renamed/labelled as Sticky Notes), and `todo`.
  - Hide/disable unsupported types (`bookmarks`, `search`, `sysinfo`) from the add flow; decide whether to keep for backward compatibility as dormant/default-hidden types.
  - Ensure duplicate labels are not rendered (widget header appears once via shell, not per-widget renderer).
  - Add a basic To-Do placeholder renderer and register in `js/widgets/todo.js` + `widgetFactories`.
- Data and migration in `js/store.js`:
  - Migrate defaults to the new supported widget set on first run.
  - Keep migration logic to avoid broken localStorage states when existing users have old widget types.
  - Preserve saved order/IDs so existing layouts are retained if compatible.
- Mobile and layout pass:
  - Confirm single-column behavior and control target size at small breakpoints.
  - Add safe area handling where needed (`env(safe-area-inset-*)`) for modern mobile browsers.
  - Ensure key actions remain one-tap accessible and visible when in edit mode.
- PWA + installability (frontend assets):
  - Add `manifest.webmanifest` and link in `index.html`.
  - Add app-capable meta tags for iOS.
  - Add `service-worker.js` with offline cache for shell assets and a fallback strategy.
  - Add `display: standalone` behavior expectation in manifest and confirm launch barless appearance when installed.
- Style guide updates:
  - Update `team/style-guide.md` to v4 with explicit token updates:
    - accent color + depth patterns
    - card/component surface hierarchy
    - widget shell rules
    - mobile and standalone behavior requirements

## 3) Backend Dev tasks
- Static hosting and installability readiness:
  - Expose `manifest.webmanifest` and app icons under public routes with correct MIME types and caching.
  - Expose `service-worker.js` and set proper service worker scope.
  - Add cache-control for static assets to improve install/runtime performance.
- API and data integration checks:
  - Ensure `/api/system` still responds (if retained) and does not block installability/PWA shell caching.
  - Add a lightweight endpoint or static stub for app metadata if manifest generation is server-assisted.
- Optional security/operability hardening:
  - Set security headers compatible with service worker and manifest usage (e.g., `X-Content-Type-Options`, `Referrer-Policy`).
  - Confirm HTTPS required/available for install in production, with fallback messaging for non-HTTPS environments.

## 4) QA tasks
- **Notes & To-Do depth (when implemented):** follow **Notes & To-Do widgets — QA acceptance (pending)** in `team/qa-complete-v4.md` (multi-instance isolation, rename, recurrence, markdown, resize, mobile UX, human-friendliness).
- Visual and UX validation:
  - Verify cyan accent is consistent and no purple remains in active UI states.
  - Verify card depth is visually improved (surface contrast, hover/elevation, widget separation).
  - Verify spacing/typography are readable and usable on mobile and desktop.
- Widget flow validation:
  - Add/edit widgets only from main dashboard page.
  - Dropdown widget adder exposes only Clock, Sticky Notes, To-Do.
  - New widgets render and save in layout with drag/reorder/edit behavior intact.
  - No duplicate widget titles inside a card shell.
  - Existing users with old widget data do not lose layout unexpectedly.
- PWA/native install validation:
  - Manifest appears installable in supported browsers.
  - Install adds app to home/desktop and opens in standalone mode (no browser UI).
  - Offline or poor network fallback works for shell and main dashboard pages.
- Regression check list:
  - Existing dashboard save/load via localStorage still works.
  - Existing title editing and clock header widget remains functional.
  - Accessibility pass for icon-only controls and control naming.

## 5) Success criteria
- Dashboard meets the new style direction with a deeper, layered dark theme and consistent cyan accent.
- Widget add/edit is fully inline on main page with dropdown selection and only three supported widget types.
- Native-install flow works: saved/installed app launches in standalone mode.
- Style guide v4 is updated and used as implementation source for tokens and patterns.
- QA pass completes with zero critical issues in installability, widget flow, migration, and mobile usability.
- **Notes & To-Do depth:** multiple instances with isolated persistence; renamable shells; todo schedules (daily / weekly / never) with user-configured reset times where specified; markdown notes with safe rendering; resizable widgets that remain usable on mobile; QA supplement in `team/qa-complete-v4.md` signed off or defects triaged by Team Lead.
