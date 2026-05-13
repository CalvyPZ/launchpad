# Assignments — Pointer-Events Drag-and-Drop Replacement

**Date:** 2026-05-13  
**Track:** DnD — Pointer Events API replacement (touch + mouse)  
**Owner:** Frontend Dev  
**Status:** Delegated

---

## Context

Both drag layers currently use the HTML5 Drag-and-Drop API (`draggable`, `dragstart`, `dragover`, `drop`, `dragend`). HTML5 DnD does not fire on touch devices, so drag-and-drop is completely broken on mobile. This assignment replaces both layers with a pointer-events-based implementation that works on touch and mouse without any library.

---

## Layer 1 — Dashboard widget reorder

**Files touched:** `js/app.js`, `css/style.css`

### Scope

- Applies to `.dash-widget` shells in the CSS Grid, edit mode only.
- Handle element: `.widget-handle` (the grip icon in the widget header).
- Order is stored as array index in `calvybots_widgets` via `js/store.js` (no x/y coordinates).

### Tasks

1. **Remove** the four HTML5 DnD handlers from `app.js` (`onDragStart`, `onDragOver`, `onDrop`, `onDragEnd`, ~lines 280–312) and all `draggable` attributes added to widget shells in `renderWidgets` / the Alpine template.
2. **Implement** a `WidgetDragController` (or equivalent module-scope object) in `app.js` using Pointer Events:
   - `pointerdown` on `.widget-handle` — begin drag: record origin widget id and pointer position, call `element.setPointerCapture(event.pointerId)` on the handle element, build a DOM clone of the widget shell, attach it to `document.body` with `position: fixed; pointer-events: none; z-index: 9000`, apply the "raised" visual state (scale 1.04, box-shadow lift, opacity 0.92) via a CSS class `dnd-ghost-widget`.
   - `pointermove` — update the ghost `transform: translate(x, y)` using `clientX`/`clientY` delta from pointer origin; scan the CSS Grid children to find which widget the ghost centre overlaps using `getBoundingClientRect()`; add `.dnd-over` to that sibling and remove it from others; show a `.dnd-placeholder` line or highlight indicating insertion position.
   - `pointerup` — if a valid drop target is identified, reorder `this.widgets`, call `this.persistWidgets()` and `this.renderWidgets()`; remove ghost and clear state.
   - `pointercancel` / `lostpointercapture` — snap-back: animate the ghost back using `transition: transform 220ms ease-out` to the original element position, then remove ghost.
3. Only activate the controller in `editMode`. Guard `pointerdown` with `if (!this.editMode) return`.
4. Prevent text selection during drag: `user-select: none` on `body.dnd-active` (add/remove the class on drag start/end).

### Acceptance bullets (widget reorder)

- [ ] Pressing the `.widget-handle` grip on any widget in edit mode on a touch device initiates drag without page scroll.
- [ ] A clone of the dragged widget rises visually (scale + shadow) and follows the finger/cursor.
- [ ] Other widgets show a visible drop-position indicator (`.dnd-over` outline or placeholder bar) as the ghost moves over them.
- [ ] Releasing over a valid widget reorders it correctly and persists to `calvybots_widgets`.
- [ ] Releasing over empty space or outside the grid snaps the ghost back to the origin position with a smooth transition.
- [ ] No `draggable` attribute remains on widget shells in the final DOM.
- [ ] The controller is inert when `editMode` is `false`.
- [ ] Text selection is suppressed during drag and restored on release.

---

## Layer 2 — To-Do task reorder (within and across widgets)

**Files touched:** `js/widgets/todo.js`, `css/style.css`

### Scope

- Applies to `.todo-item` rows inside each todo widget's list (`.todo-list`).
- Handle element: `.todo-item-handle` (the `≡` grip).
- Cross-widget moves (dropping a task into a different todo widget's list) must work.
- Works in both display mode and edit mode.

### Tasks

1. **Remove** `onTaskDragStart`, `onTaskDragOver`, `onTaskDragLeave`, `onTaskDrop`, `onTaskDragEnd`, `onListDragOver`, `onListDragLeave`, `onListDrop`, and all associated `draggable` / `addEventListener` wiring in `todo.js` (lines ~368–444).
2. **Implement** a `TodoDragController` factory function (one per widget render call, or a singleton with per-widget registration) using Pointer Events:
   - `pointerdown` on `.todo-item-handle` — record `taskId`, `sourceWidgetId`; call `setPointerCapture(event.pointerId)` on the handle; build a DOM clone of the `.todo-item` row and append to `document.body` with `position: fixed; pointer-events: none; z-index: 9000; width` matching the source row width; apply `.dnd-ghost-task` class (scale 1.03, shadow lift, slight opacity 0.90).
   - `pointermove` — translate the ghost; scan **all** `.todo-list` elements in the document (not just the current widget) to find the one whose bounding rect contains the pointer; within the candidate list find the nearest `.todo-item` by midpoint comparison to determine insertion index; insert a `.dnd-task-placeholder` div at that position (remove it from any prior list first); add `.is-list-drop-target` to the candidate list and remove from all others.
   - `pointerup` — if a valid list and index are identified, call `moveTask()` (existing function) with `destinationWidgetId` and `destinationTaskId`; remove ghost and placeholder; clear all drop-state classes.
   - `pointercancel` / `lostpointercapture` — remove ghost and placeholder; clear all drop-state classes; no data mutation.
3. The `.dnd-task-placeholder` should visually match the height of a task row and use the `accent` cyan token (`#2dd4bf`) as a 2px top-border or highlighted fill to indicate insertion point.
4. Suppress scroll-during-drag on touch: call `event.preventDefault()` on `pointermove` when drag is active and the pointer is a touch input (`event.pointerType === "touch"`). Ensure `touch-action: none` is set on `.todo-item-handle` in CSS.

### Acceptance bullets (todo task reorder)

- [ ] Pressing the `≡` handle on any task on a touch device initiates drag without scrolling the page.
- [ ] A clone of the task row rises visually and follows the finger/cursor.
- [ ] A cyan insertion placeholder appears between tasks (in any todo widget) as the ghost moves over them.
- [ ] Moving the ghost over a different todo widget's list shows that list highlighted (`.is-list-drop-target`) and the placeholder appears inside it at the correct insertion position.
- [ ] Releasing over a valid list commits the move; data persists correctly for both same-widget and cross-widget moves.
- [ ] Releasing outside any list removes the ghost and placeholder without mutating data.
- [ ] No `draggable` attribute or HTML5 DnD listener remains in `todo.js`.
- [ ] `touch-action: none` is applied to `.todo-item-handle` in CSS.

---

## Shared CSS additions (css/style.css)

Add or update the following rules:

| Selector | Purpose |
|----------|---------|
| `.dnd-ghost-widget` | `transform-origin: center; box-shadow: 0 12px 40px rgba(0,0,0,0.55); opacity: 0.92; border: 1px solid #2dd4bf;` |
| `.dnd-ghost-task` | `box-shadow: 0 6px 24px rgba(0,0,0,0.45); opacity: 0.90; border: 1px solid #2dd4bf;` |
| `.dnd-task-placeholder` | `height: 40px; border-top: 2px solid #2dd4bf; background: rgba(45,212,191,0.07); border-radius: 4px; margin: 2px 0;` |
| `.dnd-over` (widget target) | `outline: 2px dashed #2dd4bf; outline-offset: 3px;` |
| `body.dnd-active` | `user-select: none;` |
| `.todo-item-handle` | add `touch-action: none;` |
| `.widget-handle` | add `touch-action: none;` |

Remove or leave the existing `.is-dragging`, `.is-drop-target`, `.is-list-drop-target` rules in place (they may be harmless since they will no longer be applied by the new code); or clean them out as part of this change.

---

## Style guide update

Frontend Dev must update `team/style-guide.md` to document:
- Pointer-events DnD pattern (raised ghost, insertion placeholder, snap-back).
- New CSS classes (`.dnd-ghost-widget`, `.dnd-ghost-task`, `.dnd-task-placeholder`, `.dnd-over`, `body.dnd-active`).
- `touch-action: none` requirement on drag handles.

---

## Definition of done

All acceptance bullets above are met from a static code review. The implementation:
- Uses only Pointer Events API (`pointerdown`, `pointermove`, `pointerup`, `pointercancel`).
- Uses `setPointerCapture` on the handle element.
- Uses `position: fixed; transform` (not `left`/`top`) for the ghost.
- Has no HTML5 DnD API calls remaining for either layer.
- Has no new CDN entries in `index.html`.
- Updates `team/style-guide.md` with the new drag patterns.
- Commits include all modified files: `js/app.js`, `js/widgets/todo.js`, `css/style.css`, `team/style-guide.md`, `team/assignments-dnd-pointer.md`, and `team/lead-status.md`.
