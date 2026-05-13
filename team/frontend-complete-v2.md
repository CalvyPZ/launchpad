# Frontend completion notes (v2)

## Changes made

- Fixed Alpine registration timing by switching to proper Alpine v3 initialization:
  - Updated `index.html` root element from `x-data="dashboard()" x-init="init()" x-cloak` to `x-data="dashboard" x-cloak`.
  - Added an `alpine:init` listener in `index.html` (before Alpine CDN load).
  - Updated `js/app.js` to register the dashboard component inside `Alpine.data("dashboard", ...)` on `alpine:init`.
- Updated visual tokens and removed the spotlight look:
  - Replaced Tailwind inline config in `index.html` with charcoal palette + single accent.
  - Rewrote `css/style.css` to flat charcoal surfaces, updated widget/button/input styling, and updated scrollbar treatment.
  - Removed the radial spotlight gradients from `body`.
  - Switched widget and control states to non-glossy styles and subtle motion.
- Added the System widget:
  - Created `js/widgets/sysinfo.js` with polling fetch logic for `/api/system`.
  - Widget shows loading skeleton, metrics, live indicator, and retry on failure.
  - Added `sysinfo` to widget registry in `js/app.js`.
  - Added `sysinfo` to default widget list in `js/store.js`.
- Fixed timer lifecycle issue:
  - Changed `const timer` to `let timer` in `js/widgets/clock.js` so `destroy()` can reset it.
- Updated `team/style-guide.md` to the new charcoal token system, component behavior, spacing, typography, interaction states, and motion rules.

## QA notes

- Confirmed all requested files were rewritten/updated:
  - `index.html`
  - `css/style.css`
  - `js/app.js`
  - `js/store.js`
  - `js/widgets/clock.js`
  - `js/widgets/sysinfo.js` (new)
  - `team/style-guide.md` (rewritten)
  - `team/frontend-complete-v2.md` (created)
- `clock.js` now uses a mutable `timer` reference in `destroy()`.
- New system widget handles:
  - initial loading state
  - periodic refresh every 10s
  - API error and retry path
  - graceful cleanup on widget removal
- Visual tokens are now centered on the requested:
  - `bg: #1c1c1c`
  - `surface: #242424`
  - `elevated: #2e2e2e`
  - `border: #3d3d3d`
  - `accent: #a78bfa`
