## Assignments — To-Do color picker positioning

**Date:** 2026-05-13

## Context

User reports the To-Do task color picker appears above or below the clicked colour bar instead of directly underneath it when opening in normal, scrolled, or nested-scroll states. Current implementation appears to rely on fixed-positioned panel math and may be affected by viewport transforms/scroll containers.

## Frontend Dev

Scope is contained to the color panel UI and positioning in `js/widgets/todo.js` and `css/style.css`.

### 1. `js/widgets/todo.js`

- [x] Refactor `positionColorPanel(taskId)` so the picker reliably opens directly below the clicked `[data-task-color-toggle]` element in all page and list scroll positions.
- [x] Rework panel anchor calculations to avoid drift with transformed/translated ancestors and window/layout changes (`scroll`, `resize`, page scrolling, Todo list scroll, and edit-mode/layout toggles).
- [x] Keep the open state lifecycle unchanged (show/hide timing, existing outside-click/focus close behavior).
- [x] Preserve existing keyboard/focus interactions and the close-on-exit path.
- [x] Ensure task color apply/remove behavior remains unchanged and no functional regressions to task mutate/delete flows are introduced.
- [x] If a fixed/absolute positioning model is changed, centralise reposition logic in one helper so it is reused on resize/scroll and before first paint of the open panel.

### 2. `css/style.css`

- [x] Audit `.todo-color-panel` positioning and any ancestors that affect stacking/overflow.
- [x] Keep motion and panel visibility behavior visually consistent with current release while stabilizing placement.
- [x] Update any visible behavior/pattern wording only if the user-visible pattern or token usage is changed.

### 3. `team/style-guide.md`

- [ ] Update only if the bugfix changes documented visible behaviour/patterns for the To-Do color panel. **(No style-guide change required; behavior tokens unchanged.)**

## Team Lead status

- Frontend implementation complete (as assigned).
- `qa-engineer` static review is `Pass with notes` with follow-up runtime verification requested.

## Acceptance criteria

- Opening a task color picker lands directly below the clicked color bar in static state and in-page scroll scenarios.
- Picker does not drift vertically when widget/list are scrolled, while the dashboard remains visible.
- Keyboard/screen-reader interactions remain intact, and outside-click/focus loss still closes the panel.
- Existing flows for setting/removing task colors and task row edit actions remain unchanged.
- No new console-level errors introduced in color-panel open/close paths.

## Definition of done

- `js/widgets/todo.js` and `css/style.css` changes are scoped to this positioning bug.
- All acceptance bullets above are verifiable in a QA pass.
- If style-guide updates were needed for the behavior change, `team/style-guide.md` is updated in the same commit set.
