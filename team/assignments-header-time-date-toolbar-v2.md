## 2026-05-13 Header time/date and edit bar cleanup

## Client scope

The current header shell still exposes clock-widget behaviors that should be retired from global widgets while still showing a concise time/date readout in the header. Edit controls also need to move into a new edit bar beneath the tab bar, with the Edit button aligned left of Debug in the tab row.

## Frontend ownership

- **Owner:** Frontend
- **Priority:** P1 (UI shell and edit-mode behavior)
- **Files:**
  - `index.html`
  - `js/app.js`
  - `css/style.css` (time/date header styles, tab/edit bar alignment)
  - `team/style-guide.md` (if control styles/tokens are changed)

## Acceptance criteria

1. **Header time/date presentation**
   - Remove the Clock widget from active widget flow and picker options.
   - Add a read-only header display area with:
     - Time in large blue text
     - 24-hour format
     - No seconds
     - Date on the next line in smaller white text
   - Time/date updates continue to render live on page updates.

2. **Add-widget options scope**
   - `js/app.js` no longer offers `clock` in Add Widget choices.
   - Existing add flow continues to support only active visible types (`notes`, `todo`) unless additional product changes are explicitly approved.

3. **Toolbar and edit controls flow**
   - Remove existing header edit button from old header location if present.
   - Place the Edit button to the left of Debug in the tab nav area and style it as a sibling visual of the Debug tab.
   - Clicking Edit in nav reveals a new action bar directly underneath the existing tab navbar.
   - The new bar contains Edit-mode controls (at least Add Widget, done/done path, and widget picker controls as currently required by existing flows).
   - Existing edit-mode toggling and picker behaviors remain functional.

4. **Clock renderer alignment**
   - `js/app.js` formatter no longer renders clock with seconds and no longer uses 12h mode.
   - Replace any remaining clockTime/time-only `Intl.DateTimeFormat` defaults with 24h no-seconds variants where shown in header.

5. **Behavioral stability**
   - No regressions to:
     - add-widget dropdown open/close
     - edit mode state
     - navigation tab interaction
     - persistence and keyboard focusability

## Definition of done

- `index.html` shell markup matches scope and all acceptance checks above.
- `js/app.js` removes `clock` from active widget creation/picker logic and updates header-time formatting to 24-hour no-seconds output.
- `css/style.css` includes any needed styles for header time/date and edit bar; no active-purple regressions.
- `team/style-guide.md` updated if token or pattern changes are introduced.
- Lead records outcome in `team/lead-status.md` after delegation handoff.

## Team Lead sign-off (2026-05-13)

**QA result:** `Pass with notes` (`qa-engineer`).

**Findings:** legacy `.clock-time` styles were evaluated and are no longer present in the current shell styles.

**Follow-up status:** legacy `.clock-time` cleanup removed in this cycle; no pending follow-up on this stream.

## Cycle follow-up (2026-05-13 UTC+10)

**Update:** `clock` widget availability is now limited to legacy removal paths (`removeDeprecatedHomeWidgets`) and no active catalog/picker entries remain. Header readout and edit bar behavior implemented in `index.html`, `js/app.js`, and `css/style.css`; style guide aligned.
