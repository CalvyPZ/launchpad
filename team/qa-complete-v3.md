# CalvyBots Front-End Refresh — QA (v3)

## Verdict

Fail.

## Top 5 findings / risks

1. **High (accessibility blocker): Missing accessible names on key controls**
   - `js/widgets/search.js:30-43` renders the search `select`, text `input`, and button without associated `<label>` or `aria-label` references.
   - This can block accurate screen-reader announcements and breaks keyboard-first discoverability expectations.

2. **High: Global focus styling rule is malformed**
   - `css/style.css:356` uses `::focus-visible` instead of `:focus-visible`.
   - The current selector is invalid CSS and can prevent the intended visible focus affordance from rendering consistently.

3. **High: Custom scrollbar pseudo-elements use invalid selectors**
   - `css/style.css:366`, `css/style.css:370`, and `css/style.css:374` use `:::-webkit-scrollbar*` (three colons).
   - Invalid pseudo-element selectors can cause these styles to be ignored across WebKit/Blink engines.

4. **Medium: Duplicate widget title surfaces**
   - The card shell injects a title in `js/app.js:125-127`, while widget renderers add a second title block in `js/widgets/bookmarks.js:78`, `js/widgets/notes.js:22`, `js/widgets/clock.js:22`, `js/widgets/search.js:22`.
   - This creates redundant headers inside each card and can make the visual system feel less clean and less intentional.

5. **Medium: Remove action lacks an accessible name**
   - `js/app.js:136` creates the remove button with symbol-only text (`×`) and no `aria-label`.
   - Without an accessible label, assistive technology may not communicate the action clearly.

## What is now in good shape

- Card-oriented layout is in place with a consistent container tokenized by `.dash-widget` (`css/style.css:48`) and widget rendering in `#widget-grid` (`index.html:99-104`).
- Color palette remains single-accent and aligned to the declared tokens (`index.html` Tailwind config lines 20-29, `css/style.css:5`, `team/style-guide.md`).
- Hover and interaction timing are mostly within the style-guide motion budget (<= 200ms, subtle transitions).
- Spacing, borders, and radius are coherent for cards, pills, and inputs, and content hierarchy is maintained in grid mode across breakpoints.
