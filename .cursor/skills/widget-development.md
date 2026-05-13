# Skill: Widget Development Workflow

Use this skill when creating new widgets, modifying existing widget behavior, or working on the widget system (store, registry, app shell).

## File locations

| Purpose | File |
|---------|------|
| Widget renderers | `js/widgets/{type}.js` |
| Widget orchestration | `js/app.js` (factory map, shell rendering, edit mode) |
| Persistence & migration | `js/store.js` (localStorage read/write, legacy migration) |
| Widget registry (unused) | `js/widget-registry.js` (not wired into app.js — do not connect without Team Lead approval) |
| Styles | `css/style.css` |
| Entry point | `index.html` (Alpine.js root, CDN script tags) |

## Active widget types

Only these appear in the Add Widget picker: `clock`, `notes`, `todo`.

Dormant types kept for backward compat only: `bookmarks`, `search`, `sysinfo`.

## Widget render contract

Every widget in `js/widgets/` must export:

```js
export function render(container, widgetRow, dashboard) {
  // Mount UI into container
  // Return destroy() cleanup function
  return function destroy() { /* clear intervals, remove listeners */ };
}
```

- `container` — DOM element to mount into
- `widgetRow` — `{ id, type, title, notesState?, todoState?, ... }` from the store
- `dashboard` — Alpine.js component ref (has `editMode`, `online`, etc.)
- Must NOT insert the widget title (shell handles it)
- Must NOT use a shared global localStorage key

## Adding a new widget type

1. Create `js/widgets/{type}.js` with the `render()` export
2. In `js/app.js`, import it and add to `widgetFactories` map
3. Add the type to the `widgetTypes` array (with label and icon) for the picker
4. If it has state, define the state shape and add it to the widget row model in `store.js`
5. Update `sw.js` precache list to include the new widget module
6. Test: enter edit mode → Add Widget → select new type → verify it renders

## Persistence model

All widget state lives in `localStorage` key `calvybots_widgets` as a JSON array of widget rows. Each row embeds its own state (e.g. `notesState`, `todoState`). Save via `persistWidgets()` in `store.js`.

## Testing changes

1. Start the dev server (Docker or nginx — see `dev-environment.md` skill)
2. Open `http://localhost:8033` in Chrome
3. Open DevTools Console to check for errors
4. Enter edit mode, add/modify widgets
5. Verify persistence: refresh the page, check localStorage in DevTools Application tab
6. Test mobile layout: DevTools responsive mode at 375px width
