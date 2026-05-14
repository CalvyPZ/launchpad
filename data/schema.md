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

Canonical runtime keys now use the `launchpad_` namespace with fallback reads from legacy `calvybots_*` keys for migration compatibility.

- `launchpad_user_config` (legacy `calvybots_user_config`)
  - Shape: `{ schemaVersion: number, value: object }`
  - Value is user override object applied on top of `config.json` using dot-path updates.
  - Used by `js/config-loader.js` for startup merge and updates.
- `launchpad_widgets` (legacy `calvybots_widgets`)
  - Shape: `{ schemaVersion: number, value: object }`
  - Example value: `{ "layout": [...], "hidden": [...] }`
  - Used for widget layout/visibility in `js/store.js`.
- `calvybots_notes` / `calvybots_todo` (legacy, migrated into embedded widget state and removed once merged)
  - Shape: legacy single-blob documents read during migration only.
- `launchpad_bookmarks` (legacy `calvybots_bookmarks`)
  - Shape: JSON array `[{ id, title, url, icon? }]` persisted by the dormant bookmarks widget for legacy compatibility reads and writes.
- `launchpad_search_engine` (legacy `calvybots_search_engine`)
  - Shape: `"google" | "duckduckgo" | "bing"` persisted by the dormant search widget for legacy compatibility reads and writes.

Migration rationale is implemented in `js/store.js`, `js/config-loader.js`, `js/widgets/search.js`, and `js/widgets/bookmarks.js`, with `launchpad_*` as source-of-truth.

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

### `GET /api/widgets`

- Purpose: return persisted dashboard document from `../data/widgets.json` (relative to `api` service path), plus a **content revision** for conditional writes and first-open ack.
- Response: JSON object
  - `schemaVersion`: integer (currently `2`)
  - `updatedAt`: ISO-8601 timestamp string
  - `widgets`: array of home widget rows
  - `toolsWidgets`: array of Debug-tab tool widget rows (same row contract as `widgets`)
  - `toolsLandingWidgets`: array of Tools-tab landing rows (same row contract where row-shaped; `fortnight` rows carry `fortnightState`)
  - `revision`: opaque **hex string** (SHA-256 over a canonical encoding of `schemaVersion`, `updatedAt`, and the three widget arrays). Not stored in `widgets.json`; derived at read time. Unchanged until a successful mutating `PUT` changes stored content.
- Error response (500): `{"error":"Failed to read widgets","detail":"..."}` when file read/parsing fails.

### `POST /api/widgets/ack`

- Purpose: **first-open / bootstrap gate** (single-user LAN): client confirms it has received and applied the current full `GET /api/widgets` payload. Until this succeeds once per API process, `PUT` / `POST /api/widgets` return **428** with `code: "ACK_REQUIRED"`. The gate resets when the API process restarts.
- Request headers: `Content-Type: application/json` (required).
- Request body: JSON object `{ "revision": "<value from GET /api/widgets>" }`.
- Responses:
  - **200** `{ "ok": true, "acknowledged": true, "revision": "<current>" }` when `revision` matches the live document.
  - **400** invalid JSON or missing `revision` string (`code: "REVISION_REQUIRED"` when applicable).
  - **409** `code: "ACK_REVISION_MISMATCH"` when `revision` is not the current server revision; body may include `currentRevision` for client refresh.
  - **415** `code: "JSON_REQUIRED"` when `Content-Type` is not `application/json`.

### `PUT /api/widgets` and `POST /api/widgets`

- Purpose: replace the persisted dashboard document (same handler). `POST` exists for `navigator.sendBeacon` unload paths (JSON body only).
- Preconditions:
  - Successful **`POST /api/widgets/ack`** for this API process (see above).
  - Request **`Content-Type: application/json`** (otherwise **415** `JSON_REQUIRED`).
  - Body must include **`expectRevision`** (string), equal to the **`revision`** from the latest successful `GET /api/widgets` **before** this write, **or** send equivalent value in **`If-Match`** header. If missing: **400** `code: "EXPECT_REVISION_REQUIRED"`. If wrong: **409** `code: "STALE_REVISION"` and `currentRevision` ? server data is not overwritten.
- Request body: same persisted shape as stored document (`widgets` required array; `toolsWidgets` / `toolsLandingWidgets` optional arrays; `schemaVersion` / `updatedAt` optional ? server normalizes rows and preserves a plausible client `updatedAt` when valid ISO). **Do not** rely on persisting `revision`, `expectRevision`, or `skipped` ? they are stripped before save.
- Response **200** (success write):
  - Full stored document fields plus `revision` (new content hash) and `skipped: false`.
- Response **200** (no-op / dirty-write suppression):
  - Current stored document fields, same `revision` as before write, and **`skipped: true`** ? `widgets.json` is not rewritten when normalized widget content is semantically identical to what is already stored.
- Error **428** `code: "ACK_REQUIRED"`: no mutating write until ack completes.
- Payload validation:
  - request body must be a JSON object
  - `widgets` must be an array
  - each row must include:
    - `id` (string)
    - `type` (string)
    - `position` (integer)
- Error response (400): `{"error":"Invalid payload","detail":"..."}`
- Error response (413): `{"error":"Payload too large","detail":"Payload exceeded limit of ... bytes"}`
- Error response (500): `{"error":"Failed to persist widgets","detail":"..."}`

### Unknown API routes

- Any route not matching above under `/api/*` returns:
  - `404 Not Found`
  - body: `{"error":"Not found"}`
