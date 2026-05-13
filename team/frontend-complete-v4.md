## Frontend V4 Update Summary

Updated files:
- `index.html`
- `css/style.css`
- `js/app.js`
- `js/store.js`
- `js/widgets/clock.js`
- `js/widgets/notes.js`
- `js/widgets/search.js`
- `js/widgets/todo.js`
- `team/frontend-complete-v4.md`

### Summary
- Added in-page widget picker with `Add Widget` dropdown, `x-transition`, and `@click.outside` close behavior.
- Added PWA tags (`theme-color`, Apple web app tags, manifest, touch icon) and service worker registration.
- Updated widget system defaults and registrations to `clock`, `notes`, and `todo` only.
- Added To-Do widget implementation with localStorage persistence and interactive item toggling.
- Removed duplicate widget titles from clock, notes, and search widget renderers.
- Reworked dashboard depth/accent styling with layered shadows, cyan accent usage, and todo/picker styles.
- Fixed selector issues for focus and scrollbar pseudo-selectors.
- Added accessible remove control labeling and removed confirm/alert-based modal prompts from widget actions.
