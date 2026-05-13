## 2026-05-13 Cleanup: calvybots → Launchpad (runtime + docs)

## Client scope

Run a cleanup engineer pass to normalize "calvybots" naming toward "Launchpad" where it does not break existing users.

Primary constraints:

- Keep a safe migration path for existing `localStorage`.
- Preserve backward compatibility for dormant widget types during cleanup.
- Keep PWA and server-sync behavior intact.
- Do not introduce build tooling or break static-first constraints.

## Frontend ownership

- **Owner:** Frontend
- **Files:** `js/app.js`, `js/store.js`, `js/site-diagnostics.js`, `js/config-loader.js`, `js/widgets/search.js`, `js/widgets/bookmarks.js`, `README.md`, `team/style-guide.md`, `data/schema.md`, `tests/usability-checklist.md`, `tests/test-plan.md`

### Scope

1. **Storage key migration strategy**
   - Introduce Launchpad-named localStorage keys (canonical new namespace) and explicit compatibility reads for legacy `calvybots_*`.
   - Add one-pass migration for existing values where present:
     - `calvybots_widgets` ↔ `launchpad_widgets`
     - `calvybots_tools_widgets` ↔ `launchpad_tools_widgets`
     - `calvybots_tools_landing_widgets` ↔ `launchpad_tools_landing_widgets`
     - `calvybots_title` ↔ `launchpad_title`
     - `calvybots_user_config` ↔ `launchpad_user_config`
     - legacy globals in notes/todo/search/bookmarks.
   - Migration policy:
     - If Launchpad key is absent, seed from legacy key(s) without data loss.
     - Persist writes to both namespaces during transition window.
     - Keep legacy keys as read fallback until migration has been exercised once and explicitly tagged.
   - Ensure fallback for quota/storage errors stays non-fatal and does not block dashboard boot.

2. **Unused script/function hygiene**
   - Confirm `search.js` + `bookmarks.js` remain intentionally retained for backward compatibility and are not exposed in Add Widget picker.
   - Remove any truly dead widget registration or export wiring that is not used by either active flows or backward compatibility recovery.
   - Document every intentionally retained dead-path in one place for future cleanup.

3. **Naming normalization**
   - Rename internal identifiers and comments from `calvybots` to Launchpad where not part of external contract.
   - Keep canonical persisted payload shape and schema version stable unless explicitly coordinated with Backend.

4. **Docs and tests**
   - Update `team/style-guide.md`, `data/schema.md`, `tests/test-plan.md`, and `tests/usability-checklist.md` to reflect canonical naming and migration behavior.
   - Keep references to legacy keys for recovery and migration checks.

## Backend ownership

- **Owner:** Backend
- **Files:** `docker-compose.yml`, `nginx-site.conf`, `sw.js`, `api/package.json`, `api/package-lock.json` (if package rename is in scope)

### Scope

1. **Runtime naming alignment**
   - Rename backend/container artifacts where safe (e.g. `calvybots-api` package metadata, Docker API data volume naming) only if it does not disturb persistence.
   - If renames occur, include migration/continuation instructions in comments and/or docs.

2. **Compatibility checks**
   - Keep `manifest.json`, `sw.js`, `/api/` proxying, and `Service-Worker-Allowed` behavior unchanged from functional perspective.
   - Ensure no `sw.js` / `manifest.json` / API caching regressions after renames.

## QA ownership

- **Owner:** QA
- **Files (review):** `team/style-guide.md`, `team/assignments-cleanup-calvybots-launchpad.md`, `tests/*`, and runtime validation.

### Scope

1. Confirm migration compatibility on load for:
   - `calvybots_*` only profile (fresh install from legacy payload),
   - mixed profile (legacy + launchpad present),
   - launchpad-only profile.
2. Verify no functional regression for active flows:
   - Home/Tools/Debug shells,
   - add/remove/rename/resizing,
   - widget sync path,
   - offline/online behavior.
3. Verify dead-path retention is explicit and documented (no surprise removal of legacy search/bookmarks recovery).

## Definition of done

- Launchpad naming updates are implemented in frontend code and docs with explicit compatibility path.
- LocalStorage migration is safe, tested, and documented.
- No blocking regressions in current widget flow, sync, and PWA behavior.
- QA returns a structured verdict with explicit sign-off recommendation.
