# CalvyBots Data and Runtime Schema

## 1) data/config.json

`config.json` is the base, read-only application configuration loaded by `js/config-loader.js` on startup.

Top-level keys:

- `site`: site-wide metadata and visual defaults.
  - `title`: string
  - `description`: string
  - `theme`: string (`dark` or `light`)
  - `accentColor`: CSS color string (`#RRGGBB` preferred)
- `widgets`: widget bootstrap config.
  - `defaultLayout`: list of widget layout definitions.
    - `id`: unique widget instance identifier
    - `type`: registered widget type id
    - `col`: numeric grid column start
    - `row`: numeric grid row start
    - `colSpan`: grid width
    - `rowSpan`: grid height
  - `registry`: array of enabled widget type names for this site config
- `bookmarks.default`: default bookmark objects.
  - `id`: bookmark key
  - `label`: display text
  - `url`: fully qualified URL string
  - `icon`: optional display icon
- `search`: search defaults.
  - `defaultEngine`: key from `engines`
  - `engines`: map of engine name to search URL prefix

## 2) localStorage keys

All runtime state is persisted under the `calvybots_` namespace.

- `calvybots_user_config`
  - Shape: `{ schemaVersion: number, value: object }`
  - Value is user override object applied on top of `config.json` using dot-path updates.
  - Used by `js/config-loader.js` for startup merge and updates.
- `calvybots_widgets`
  - Shape: `{ schemaVersion: number, value: object }`
  - Example value: `{ "layout": [...], "hidden": [...] }`
  - Used for widget layout/visibility in `js/store.js`.
- `calvybots_notes`
  - Shape: `{ schemaVersion: number, value: string }`
  - Free-form note content for notes widget.
- `calvybots_bookmarks`
  - Shape: `{ schemaVersion: number, value: Array<{ id, label, url, icon? }> }`
  - User-managed bookmarks overriding or extending defaults.

The `schemaVersion` is managed in `js/store.js` as part of migration logic. Any mismatch resets that key to default.

## 3) Custom events

- `config:updated`
  - Emitted on `document` via `document.dispatchEvent(...)`
  - Detail shape: `{ config: mergedConfig }`
  - Emitted once after initial load and whenever `updateConfig(...)` writes user overrides.

- `store:changed`
  - Emitted on `EventTarget` exported by `js/event-bus.js`
  - Detail shape: `{ key, value }`
  - Dispatched for each successful `set(...)` in `js/store.js`.

## 4) Widget interface contract

Widgets are lazy loaded through `js/widget-registry.js` and expected to be ES modules.

A widget module should export:

- `mount(container, context)` **or** `init(container, context)` for first render.
- `destroy()` for cleanup (recommended).
- Optional: `metadata` object with `title`, `description`, `defaultConfig`.

`context` is free to contain:

- `store`: access to `js/store.js` state helpers (or a subset)
- `config`: merged config object from `js/config-loader.js`
- `eventBus`: `on/emit/off` from `js/event-bus.js`
- Any additional shared utilities required by that widget.

The frontend loader should treat additional exports as optional.

## 5) File responsibilities

- `js/config-loader.js`: fetches base config, applies user overrides, exports:
  - `getConfig()`
  - `updateConfig(path, value)`
- `js/store.js`: central store with schema migration and persistence for widget state/notes/bookmarks/overrides.
- `js/widget-registry.js`: maps widget type -> module path and lazily imports modules.
- `js/event-bus.js`: lightweight pub-sub API.

## 6) Backend API endpoints

The API is mounted at `/api/*` and served via nginx reverse proxy.

### `GET /api/health`

- Purpose: service liveness check.
- Response: JSON object
  - `status`: `"ok"`
  - `timestamp`: ISO-8601 UTC timestamp
  - `uptime`: process uptime in seconds

### `GET /api/system`

- Purpose: runtime diagnostics for container/Node process.
- Response: JSON object
  - `timestamp`: ISO-8601 UTC timestamp
  - `uptime`: process uptime in seconds (integer)
  - `node`: Node.js runtime version
  - `memory`: memory metrics in MB
    - `heapUsed`
    - `heapTotal`
    - `rss`

### `GET /api/config`

- Purpose: return server-side config from `../data/config.json` (relative to `api` service path).
- Response: parsed JSON from `/app/../data/config.json`.
- Error response (500): `{"error":"Failed to read config","detail":"..."}` when file read/parsing fails.

### Unknown API routes

- Any route not matching above under `/api/*` returns:
  - `404 Not Found`
  - body: `{"error":"Not found"}`
