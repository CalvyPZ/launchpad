# Backend Layer Implementation Complete

## Files created

- `data/config.json`
- `js/config-loader.js`
- `js/store.js`
- `js/widget-registry.js`
- `js/event-bus.js`
- `nginx.conf`
- `data/schema.md`
- `team/backend-complete.md`

## Architectural decisions

- Chose JSON + localStorage as the "backend": immutable `data/config.json` for defaults and localStorage-backed user state for overrides/runtime data.
- `js/config-loader.js` performs a one-time startup fetch from `data/config.json`, merges user overrides from `calvybots_user_config`, and exposes a small API for read/patch.
- `js/store.js` centralizes persistence with schema-wrapped records per key, enabling migration through `schemaVersion` checks and fallback defaults.
- Event flow is explicit and lightweight:
  - `config:updated` on `document` for full config merges.
  - `store:changed` on dedicated `EventTarget` from `js/event-bus.js` for key-level persistence changes.
- `js/widget-registry.js` keeps type-to-path mapping and lazy loads modules via `import()`, then caches module objects to avoid repeated network/module loads.
- `nginx.conf` is provided as deployment documentation with SPA fallback, module MIME correctness, gzip, and cache policies.

## Frontend notes

- Import modules as ES modules and keep all widget scripts with `.js` extensions.
- Use `await getConfig()` before first render to fetch and merge startup config.
- To update config at runtime, call `await updateConfig('site.title', 'My Dashboard')` (or any supported dot path), then redraw dependent UI when `config:updated` fires.
- Use `store.get/set/remove/reset` for all localStorage-backed state management. `set()` fires `store:changed` with `{ key, value }`.
- Register widgets via `register(type, './path-to-widget.js')` and obtain a widget with `await get(type)`.
- For app-wide event communication, use `on`, `off`, and `emit` from `js/event-bus.js`.

## QA notes

- Validate startup boot: `config-loader` should still produce a usable config if `data/config.json` fails to load.
- Validate dot-path updates: unsupported paths should not crash; they should create missing nested objects where appropriate.
- Validate migration: pre-existing localStorage values with old `schemaVersion` should reset cleanly to defaults.
- Validate registry behavior: calling `get(type)` repeatedly does not re-import modules due to cache.
- Validate storage reset: `reset()` removes all keys under `calvybots_` and writes default schema records for managed keys.
