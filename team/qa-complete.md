# QA Complete

## Verdict
**Needs fixes before production release**

## Top issues to address
1. Frontend does not use `js/config-loader.js`, so `data/config.json` is effectively disconnected from runtime and config-driven behavior is broken.
2. Dual `js/store.js` contracts exist: backend docs expect a schema-aware centralized store with migrations and events, but runtime currently ships a minimal frontend-only store.
3. Bookmark CRUD is incomplete (no update/edit action), and no validation/cancel semantics exists for edit mode.
4. Registry-driven architecture is present in backend modules (`js/widget-registry.js`) but not used by `js/app.js`, so lazy loading and unknown-type fallback logic are bypassed.
5. Several placeholder files in `js/` (`x` only) should be removed or documented to reduce confusion and potential regression risk.

## What looks good
- Visual styling and widget shell behavior are polished and consistent.
- Core widget render/edit functionality for Clock/Bookmarks/Notes/Search is stable in standalone mode.
- Nginx config covers fallback routing, MIME type mapping, gzip, and cache policy.
- Initial page load and local persistence for core state (`widgets`, title, notes, search engine, bookmarks) work in the current implementation.
