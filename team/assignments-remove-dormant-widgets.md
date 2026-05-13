# Assignment: Remove dormant widget types (bookmarks, search, sysinfo)

**Owner:** Team Lead issued 2026-05-13.  
**Client ask:** Fully remove unused legacy dormant home widget types — not only hidden from picker — with store/API normalisation, delete dead modules, update docs/rules, then QA.

## Shared removal set

Home widget `type` values to **strip from persisted layouts** and **never rehydrate**:

- `bookmarks`
- `search`
- `sysinfo`

(Align with existing `removeDeprecatedHomeWidgets` pattern for `clock` in `js/app.js`.)

---

## Frontend Dev

**Files (expected touch set):**

- `js/store.js` — extend `normalise` / `normaliseWidgetRows` path to **drop** rows whose `type` is in the removal set; re-index `position` after filter. Run after shape mapping so behaviour matches `removeDeprecatedHomeWidgets` intent. Consider exporting a small helper or constant shared with `app.js` to avoid drift.
- `js/app.js` — extend `removeDeprecatedHomeWidgets` to filter the same types (or call store export) for local Alpine state **and** remote sync merge paths.
- Delete: `js/widgets/bookmarks.js`, `js/widgets/search.js`, `js/widgets/sysinfo.js` — confirm no `import` or dynamic references (grep repo: `app.js`, `index.html`, tests, `sw.js`).
- `data/config.json` — remove sample layout rows / registry entries for removed types so defaults match product.
- `data/schema.md` — remove or rewrite sections that describe dormant widgets and their `localStorage` keys; note that those keys may remain as inert orphans unless you add optional one-time cleanup (see below).
- **Rules / skills (dormant narrative removal):** `.cursor/rules/architecture.mdc`, `.cursor/rules/widget-development.mdc`, `.cursor/agents/frontend-senior-dev.md`, `.cursor/skills/widget-development.md`, `.cursor/agents/senior-cleanup-engineer.md` (update “do not remove dormant files” guidance to reflect removal).
- `tests/test-plan.md` — remove or replace scenarios that assume bookmarks/search/sysinfo widgets as shippable modules; keep coverage for active types.
- `team/style-guide.md` — drop widget-type lists or examples that reference removed types (if any).
- `team/delegation-v4.md` — update the bullet that still says “decide whether to keep for backward compatibility” to state **removed** and point at this assignment.
- `team/brief.md` — append `## Update 2026-05-13` per project convention: dormant types removed; layouts normalised on load.

**Optional (low priority):** one-time removal of orphaned keys only read by deleted widgets (`launchpad_bookmarks`, `calvybots_bookmarks`, `launchpad_search_engine`, `calvybots_search_engine`) during `loadWidgets()` or migration — **only** if Team Lead confirms no future use; otherwise leave keys untouched.

**Out of scope (do not mass-delete):** historical `team/*complete*.md`, `tests/report.md`, `team/qa-complete*.md` verdict sections — per workflow, do **not** delete QA cycles; stale completion logs stay unless client invokes Senior Cleanup Engineer.

**Acceptance:**

- Persisted home layouts containing `bookmarks`/`search`/`sysinfo` rows load as **those rows omitted**, positions contiguous; notes/todo (and other supported types) unchanged.
- No import or runtime reference to deleted widget modules; grep clean across repo.
- Canonical docs/rules no longer describe those types as supported or “dormant.”
- `team/style-guide.md` updated if any visible or documented pattern changed.

---

## Backend Dev

**Files:**

- `api/server.js` — in widget row parsing / `parseWidgetRowsPayload` (or equivalent path used by GET/PUT `/api/widgets`), **omit** rows whose `type` is in the same removal set as Frontend; ensure persisted `data/widgets.json` rewrites normalize consistently when saving.

**Acceptance:**

- PUT payload with deprecated types stores **without** those rows (or normalises them out before persist).
- GET returns layouts consistent with Frontend expectations.

**Note:** `sw.js` precache list — verify still accurate after widget files deleted (no stale paths in `SHELL`).

---

## QA

**After** Frontend + Backend lands:

- Static grep: deleted files absent; no references.
- Behaviour: seed `calvybots_widgets` / document fixture with deprecated rows → confirm load strips them and active widgets intact.
- Service worker / offline shell: no 404 precache for removed URLs.
- Structured verdict: Pass / Pass with notes / Blocked — **chat first**; update `team/qa-status.md` / `team/qa-complete-v4.md` only if client asked for repo QA doc updates.

---

## Definition of done

- Migration/normalisation strips deprecated home types in store, app sync paths, and API.
- Dead modules removed; docs and rules aligned.
- QA Pass or Pass with notes; Team Lead updates `team/lead-status.md` closure.

## Commit recommendation

Single cohesive commit:

`feat(widgets): remove dormant bookmarks/search/sysinfo types and normalise layouts`

Include all touched paths (frontend, api, data samples, `.cursor/` rules, `team/` brief/delegation/style-guide/tests).
