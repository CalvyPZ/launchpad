# Assignments — Tools tab + Debug page split

### Date
2026-05-13

### Track
Navbar and page-shell behavior for Tools/Debug separation

### Owner
Frontend Dev

### Status
Delegated

### Context
Current runtime exposes `home` + `tools` pages, where the right-side nav item currently represents Tools behavior plus shared footer visibility.  
Client now wants three visible tabs: **Home**, **Tools**, **Debug**, while keeping Debug on the right.  
The existing always-on footer should become Debug-only.

### Files touched
- `index.html`
- `js/app.js`
- `js/store.js` (if startup widget defaults require a tools-placeholder bootstrap path change)
- `team/style-guide.md` (only if this change introduces new visible component behavior beyond existing button/tabs patterns)
- `team/assignments-tools-debug-tab.md` (this assignment)
- `team/lead-status.md` (status update from Team Lead)

### Working constraints
- Keep static-first architecture and existing `x-data="launchpad"` Alpine boundary.
- Preserve current edit-mode and widget persistence patterns unless a minimal refactor is required to support routing.
- Do not change API, nginx, or service worker files in this cycle.

### Task 1 — Navigation + shell layout (`index.html`)
- Update nav labels to: **Home**, **Tools**, **Debug**.
- Keep right-side behavior for the Debug tab (same visual alignment/placement as the current right-side tab).
- Add/update page containers so `currentPage` supports `home`, `tools`, and `debug`.
- Ensure `#widget-grid` continues to render Home widgets.
- Ensure Debug page continues to render existing Tools widgets/controls previously on the old “tools” tab.

### Task 2 — Debug page + Tools defaulting (`js/app.js`, `js/store.js`)
- Rename existing tools-page route key internally from `tools` to `debug` for page rendering and controls.
- Keep all existing `tools` widget type support for debug surfaces (`status-tools`, `log-tools`, `placeholder`, and legacy/default behavior).
- Ensure the new dedicated `tools` tab has a placeholder widget by default when there is no saved `toolsWidgets` payload in storage.
- Keep Tools picker/options behavior constrained to the intended debug page flow, unless existing Home behavior requires no change.

### Task 3 — Footer visibility gate (`index.html`)
- Restrict footer rendering to Debug mode only using `x-show` (or equivalent Alpine/class gating).
- Footer must be hidden in `home` and `tools` page states in both normal and edit mode.

### Acceptance criteria
1. Navbar exposes exactly three visible tabs in order: Home, Tools, Debug, with Debug occupying right-side tab behavior.
2. New Tools tab opens and shows a placeholder widget by default when Tools state is empty/absent on first run.
3. Debug footer is visible only when `currentPage === 'debug'`.

### Definition of done
- The three acceptance criteria are verifiable in `index.html` and `js/app.js`, with static review confirming no unrelated route regressions.
- Existing widget persistence paths remain intact (`localStorage` key use and migration helpers) and continue to save/reload correctly.
- Team Lead marks the task as completed only after QA review is requested for interactive validation of navigation and footer transitions.
