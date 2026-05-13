# Assignments — Header toolbar and clock cleanup

**Date:** 2026-05-13
**Status:** Complete

**Execution notes (2026-05-13):**
- Home header cleaned to logo-only.
- Clock and editable site title removed from header.
- Edit/Done and Add Widget actions moved to `section.home-toolbar` below header.
- Button classes updated (`.btn-soft`, `.btn-primary`, `.btn-ghost`) to remove purple active states.
- Files updated: `index.html`, `css/style.css`, `team/style-guide.md`.

## Scope

Align the Home page shell header to the current style direction by removing editable/clock content from the global header and consolidating edit controls into a dedicated toolbar below the header.

## Frontend Dev

### Files

- `index.html` (current header and edit toolbar structure)
- `css/style.css` (`.btn-primary`, `.btn-soft`, `.btn-ghost`, edit toolbar, control spacing, focus/hover states)
- `js/app.js` (only if `toggleEditMode`, `toggleAddWidgetPicker`, `addWidget`, or existing edit-mode handlers need minimal wiring updates for new control location/markup)
- `team/style-guide.md` (if button/control treatment changes are introduced)

### Acceptance

1. **Header cleanup**
   - Remove the clock widget display from the top site header.
   - Remove editable site title from the header.
   - Keep header visually clean and consistent with cyan/dark style tokens.

2. **Toolbar relocation**
   - Move the Edit/Done toggle into a toolbar block directly beneath the header.
   - Keep Done functionality wired to the existing `toggleEditMode()` flow with no behavior regression.
   - Keep any add-widget panel or list toggles reachable from the same toolbar area in edit mode.

3. **Button styling**
   - Restyle/reassign Done and Add Widget controls to match style-guide control patterns:
     - Cyan/dark token usage, no purple-violet active accents.
     - Consistent spacing, corners, and focus state with existing `.btn-*` tokens/patterns.
   - Ensure icon-only and label controls have clear accessible names.

4. **Behavioral safety**
   - No regressions in existing add-widget flows (`toggleAddWidgetPicker()`, `addWidget()`).
   - Existing edit-mode state and picker interactions remain functional.

5. **Docs**
   - Update `team/style-guide.md` if visible control tokens or toolbar patterns are changed.

### Definition of done

- `index.html`, `css/style.css`, and optional `js/app.js` changes complete and satisfy all acceptance bullets.
- `team/style-guide.md` reflects any visible style updates.
- Team Lead records outcome in `team/lead-status.md`.

---

## QA

### References

- `tests/test-plan.md`
- `tests/usability-checklist.md`

### QA pass criteria

- Visual hierarchy between header and toolbar remains clear on desktop and mobile.
- Edit mode controls are one-tap reachable and keyboard-focusable.
- Cyan/dark styling applied to action controls without purple active states.
- No header regressions in title rendering, edit-mode transitions, or widget creation.
