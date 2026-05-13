# CalvyBots — Test Plan

## 1. Scope

### 1.1 Purpose
Validate the CalvyBots dashboard as a static web app delivered by nginx with no build pipeline or server-side runtime, focusing on front-end behavior, local storage persistence, widget module behavior, and static delivery guarantees.

### 1.2 In Scope
- Frontend page and widget behavior in modern browsers.
- Static configuration files and client-side scripts.
- Edit-mode state handling, persistence, and synchronization.
- Browser-side event flows and widget lifecycle.
- Local nginx-style static delivery checks.

### 1.3 Out of Scope
- Server-side authentication, APIs, and DB integration (not applicable).
- Automated accessibility certification tooling (manual WCAG checks only where needed).
- Performance tuning or load testing beyond static delivery smoke checks.

## 2. Test Environment

- Devices/Browsers
  - Windows 10/11, macOS, and Android/iOS touch devices.
  - Chrome (latest and previous), Firefox (latest), Safari (latest), Edge (latest).
- Test Files
  - `index.html`
  - `js/config-loader.js`
  - `js/store.js`
  - `js/widget-registry.js`
  - `js/event-bus.js`
  - `data/config.json`
  - widget modules in ES module format for clock, bookmarks, notes, search.
- Static server
  - nginx serving repo root as document root.
  - `index.html` available at `/` and `/index.html`.
  - Content-Type checks for html/js/css/json/assets.
- Test data conditions
  - Clean browser profile (cache and storage cleared).
  - Pre-seeded localStorage with valid/invalid payloads to validate recovery.
  - Offline and poor-network behavior checks where static assets may fail to load.
- Tools
  - Browser DevTools (Network tab, console, Application storage).
  - Manual keyboard/mouse checks for edit interactions.

## 3. Frontend Tests

### 3.1 Page Load & Structure

#### FE-001 Initial load renders base layout
- **Description**: Confirm that `index.html` loads and mounts the main dashboard shell.
- **Steps**
  1. Serve project with nginx and open `/`.
  2. Wait for DOM ready.
  3. Verify major regions are present (root container, header/nav, widget area, edit toggle, status placeholders).
- **Expected result**: Main page loads without layout-breaking errors and all key containers are visible.
- **Pass criteria**: No uncaught blocking errors in console; essential containers exist and are visible.

#### FE-002 External CDN libraries load successfully
- **Description**: Ensure Tailwind CDN stylesheet and Alpine.js script load on first view.
- **Steps**
  1. Open devtools network panel before first load.
  2. Reload page.
  3. Confirm 200 responses for Tailwind and Alpine resources.
- **Expected result**: Both scripts/styles load and initialize successfully.
- **Pass criteria**: Page shows expected styling and Alpine-driven bindings behave.

#### FE-003 HTML contains valid module script declarations
- **Description**: Verify `index.html` references widget modules and startup script with valid module type.
- **Steps**
  1. Inspect rendered DOM and source view.
  2. Check script tags for expected file paths and `type="module"` where required.
- **Expected result**: Module scripts are present and parseable.
- **Pass criteria**: Console shows no import/parse errors related to script loading.

#### FE-004 Config fetch occurs early and once
- **Description**: Validate bootstrap sequence triggers config retrieval once per page load.
- **Steps**
  1. Open devtools Network filtered by `config.json`.
  2. Reload page and monitor requests.
- **Expected result**: Single request for `data/config.json` per load.
- **Pass criteria**: Exactly one successful fetch call and no repeated duplicate requests without navigation.

#### FE-005 Fallback handling for missing network
- **Description**: Ensure graceful behavior if static assets are temporarily unavailable.
- **Steps**
  1. Simulate network throttling/offline.
  2. Reload page.
  3. Observe error display and recovery behavior when connectivity returns.
- **Expected result**: App does not hard-crash; shows fallback or error state.
- **Pass criteria**: No infinite spinners; app recovers once network resumes.

#### FE-006 Meta and viewport checks
- **Description**: Verify viewport and page metadata are set for responsive behavior.
- **Steps**
  1. Inspect head for viewport meta, title, and theme-related tags.
  2. Resize viewport to narrow widths.
- **Expected result**: Layout adapts without overflow in default zoom.
- **Pass criteria**: No severe layout shift and no critical accessibility metadata missing from baseline.

#### FE-007 Accessibility landmarks exist
- **Description**: Confirm semantic structure includes meaningful landmarks and labels.
- **Steps**
  1. Review DOM for heading order and landmark structure.
  2. Verify form controls in edit mode have accessible labels/placeholders.
- **Expected result**: Basic semantic structure exists and interactive controls are discoverable.
- **Pass criteria**: Manual scan shows no obvious missing labels for core controls.

#### FE-008 No unintended console noise
- **Description**: Confirm page is not polluted with warnings/errors on first load.
- **Steps**
  1. Open console at load.
  2. Reload after cache clear.
- **Expected result**: Only harmless non-blocking logs; no deprecation or runtime errors.
- **Pass criteria**: No errors marked as uncaught/JS exceptions.

### 3.2 Widget Rendering (clock, bookmarks, notes, search)

#### FE-009 Clock renders and updates
- **Description**: Verify clock widget is visible and updates in near-real time.
- **Steps**
  1. Open dashboard after load.
  2. Wait 2 minutes and observe clock output.
- **Expected result**: Time updates correctly and does not freeze.
- **Pass criteria**: Visible clock value changes over time and does not show invalid format.

#### FE-010 Clock respects locale/format settings
- **Description**: Validate displayed time format follows configuration/default expectations.
- **Steps**
  1. Inspect config/default settings for time format preference.
  2. Reload and verify displayed output format.
- **Expected result**: Format matches configuration or documented default.
- **Pass criteria**: No mixed/incorrect locale formatting for numerals and separators.

#### FE-011 Clock widget has fallback when module fails
- **Description**: Validate UI remains stable if clock module load fails.
- **Steps**
  1. Temporarily block only clock module request.
  2. Reload dashboard.
- **Expected result**: Other widgets remain functional; failed widget shows fallback/error state.
- **Pass criteria**: No full-page failure and user is informed of missing widget.

#### FE-012 Bookmarks widget renders from config/store
- **Description**: Ensure bookmarks list shows initial config entries with valid links and labels.
- **Steps**
  1. Load dashboard with default config containing at least two bookmarks.
  2. Inspect rendered bookmark cards/items.
- **Expected result**: Each bookmark is visible and links are clickable.
- **Pass criteria**: Number of rendered items matches configured data and no broken URL attributes.

#### FE-013 Bookmarks open target links correctly
- **Description**: Validate interaction for each bookmark item.
- **Steps**
  1. Click an item in a standard desktop browser.
  2. Confirm navigation behavior.
- **Expected result**: Clicking each link opens expected destination.
- **Pass criteria**: No items with empty/malformed href and no duplicate navigation side effects.

#### FE-014 Notes widget default content display
- **Description**: Confirm notes widget renders placeholder or pre-populated content.
- **Steps**
  1. Load page in standard mode.
  2. Inspect notes textarea/text area-like widget body.
- **Expected result**: Widget displays readable notes content.
- **Pass criteria**: Note text wraps and remains editable when in edit mode.

#### FE-015 Notes input editing interaction
- **Description**: Validate input area responds to typing and updates internal state.
- **Steps**
  1. Enter edit mode.
  2. Type text into notes area.
  3. Exit edit mode.
- **Expected result**: Text remains in notes control and visible on return.
- **Pass criteria**: Input event updates store/state with no truncation.

#### FE-016 Search widget renders input and accepts query
- **Description**: Validate search widget UI and query input behavior.
- **Steps**
  1. Locate search bar.
  2. Enter a sample query and trigger submit/search.
- **Expected result**: Search action is triggered using expected route/URL and query is preserved.
- **Pass criteria**: Query is reflected correctly in resulting URL/path or provider integration.

#### FE-017 Search widget handles empty and short input
- **Description**: Confirm robust handling of empty and whitespace-only queries.
- **Steps**
  1. Click search with empty input.
  2. Try whitespace-only input.
- **Expected result**: No crash; either no-op with validation message or clean ignore.
- **Pass criteria**: No malformed URL generated.

#### FE-018 Widget grid reorder and visibility integrity
- **Description**: Ensure widget order/visibility logic reflects enabled/disabled state.
- **Steps**
  1. Inspect all four widget modules on page.
  2. Toggle widget active states (if feature exists).
  3. Reload page.
- **Expected result**: Visible widgets match configuration state.
- **Pass criteria**: Removed widgets do not render; enabled widgets render consistently.

### 3.3 Edit Mode

#### FE-019 Enter and exit edit mode
- **Description**: Validate that edit mode can be toggled consistently.
- **Steps**
  1. Click edit toggle control.
  2. Observe changed UI affordances.
  3. Exit edit mode.
- **Expected result**: Edit mode UI appears only while active, and exits cleanly.
- **Pass criteria**: Toggle state flips reliably and visually indicates current state.

#### FE-020 Bookmark add interaction in edit mode
- **Description**: Validate adding a bookmark through edit controls.
- **Steps**
  1. Enable edit mode.
  2. Add bookmark title + URL.
  3. Save/confirm action.
- **Expected result**: New bookmark appears instantly.
- **Pass criteria**: New bookmark rendered with expected values and persists after reload.

#### FE-021 Bookmark edit interaction in edit mode
- **Description**: Validate editing existing bookmark entries.
- **Steps**
  1. Enter edit mode.
  2. Select existing bookmark, change label/link.
  3. Save changes.
- **Expected result**: UI updates instantly with new values.
- **Pass criteria**: Updated item data is reflected in store and widget render.

#### FE-022 Bookmark delete interaction in edit mode
- **Description**: Validate deleting bookmark from list.
- **Steps**
  1. In edit mode, remove one bookmark.
  2. Confirm and save.
  3. Reload page.
- **Expected result**: Bookmark no longer appears.
- **Pass criteria**: Deletion persists and no orphan controls remain.

#### FE-023 Notes edit and save cycle
- **Description**: Validate manual editing of notes while in edit mode.
- **Steps**
  1. Enter edit mode and modify notes text.
  2. Exit mode.
  3. Reopen edit mode.
- **Expected result**: Latest content remains.
- **Pass criteria**: Notes content remains unchanged across mode toggles.

#### FE-024 Search engine preference change in edit mode
- **Description**: Validate editing search provider setting (if configurable).
- **Steps**
  1. In edit mode, update search provider setting.
  2. Save and exit mode.
  3. Trigger search.
- **Expected result**: Search uses chosen provider.
- **Pass criteria**: URL format changes to expected provider endpoint/template.

#### FE-025 Cancel edit without saving
- **Description**: Confirm unsaved changes can be discarded.
- **Steps**
  1. Enter edit mode and modify values.
  2. Choose cancel/revert path.
  3. Refresh page.
- **Expected result**: Unsaved edits are not persisted.
- **Pass criteria**: Only previously saved values remain after cancellation.

### 3.4 LocalStorage Persistence

#### FE-026 Config persists on widget updates
- **Description**: Confirm updates made in edit mode persist in localStorage.
- **Steps**
  1. Edit a bookmark and save.
  2. Inspect localStorage keys/values.
  3. Reload page.
- **Expected result**: Modified state appears in localStorage and reload uses it.
- **Pass criteria**: Saved value matches previous edit.

#### FE-027 Notes persist with special characters
- **Description**: Validate notes persistence with unicode, punctuation, and line breaks.
- **Steps**
  1. Enter text with emojis, symbols, and newline formatting.
  2. Save and reload.
- **Expected result**: Content preserved exactly (or in expected normalized form).
- **Pass criteria**: No character corruption or truncation.

#### FE-028 localStorage corruption recovery
- **Description**: Validate recovery when stored JSON is invalid.
- **Steps**
  1. Manually inject invalid JSON under app storage key(s).
  2. Reload dashboard.
- **Expected result**: App handles invalid payload gracefully and falls back to safe defaults.
- **Pass criteria**: No unhandled exception; app renders with fallback or prompt.

#### FE-029 Storage quota handling
- **Description**: Validate app behavior when localStorage quota is exceeded.
- **Steps**
  1. Simulate quota error (browser devtools utility or reduced storage testing).
  2. Perform a save action.
- **Expected result**: App notifies user and avoids crash.
- **Pass criteria**: Save failure is handled with non-destructive fallback.

#### FE-030 Storage key version migration
- **Description**: Validate backward-compatible reading when storage format changes.
- **Steps**
  1. Seed storage using previous schema shape.
  2. Load app and save state.
- **Expected result**: Old data migrates or merges correctly.
- **Pass criteria**: No data loss for supported fields and widgets render with sane defaults for missing fields.

### 3.5 Responsive Layout

#### FE-031 Mobile layout under 375px
- **Description**: Validate layout does not overflow and remains usable on narrow viewports.
- **Steps**
  1. Resize viewport to 375x812.
  2. Test bookmark cards, edit controls, and search field.
- **Expected result**: Content wraps and remains tappable.
- **Pass criteria**: No horizontal overflow and controls remain accessible.

#### FE-032 Tablet layout under 768px
- **Description**: Verify layout behavior at tablet widths.
- **Steps**
  1. Resize to 768px width.
  2. Inspect widget spacing and typography scale.
- **Expected result**: Balanced spacing with readable content.
- **Pass criteria**: No overlapping controls.

#### FE-033 Desktop layout baseline
- **Description**: Validate desktop layout on 1366x768 and 1920x1080.
- **Steps**
  1. Load at both widths.
  2. Verify major regions align and margins/padding look intentional.
- **Expected result**: Consistent, centered layout and comfortable whitespace.
- **Pass criteria**: No unexpected clipping, oversized containers, or hidden controls.

#### FE-034 Orientation and zoom resilience
- **Description**: Validate behavior under zoom and orientation changes.
- **Steps**
  1. Set mobile zoom to 80%, 125%, 150%.
  2. On mobile simulate orientation change.
- **Expected result**: UI remains functional and readable.
- **Pass criteria**: No interaction blocking from fixed heights/overflows.

### 3.6 Visual / Style Compliance

#### FE-035 Tailwind utility consistency
- **Description**: Validate that main components follow expected utility-based visual styling.
- **Steps**
  1. Inspect computed styles for cards/buttons/input fields.
  2. Compare against baseline style guide values used in `index.html` design.
- **Expected result**: Reusable spacing, border radii, and color usage are consistent.
- **Pass criteria**: No mixed legacy style blocks causing visual inconsistency.

#### FE-036 Contrast and legibility
- **Description**: Confirm text remains readable across themes/backgrounds.
- **Steps**
  1. Load page and inspect light backgrounds with dark text and controls.
  2. Evaluate button/link contrast manually.
- **Expected result**: Sufficient contrast for normal text and interactive elements.
- **Pass criteria**: No low-contrast combinations that reduce legibility.

#### FE-037 Interaction states of controls
- **Description**: Verify visible hover/focus/active states are present.
- **Steps**
  1. Tab through controls with keyboard.
  2. Hover/click visible CTA controls.
- **Expected result**: Focus and pointer states provide clear feedback.
- **Pass criteria**: Focus outline/focus ring visible and not suppressed.

#### FE-038 Visual consistency after save/re-render
- **Description**: Validate UI remains visually stable after data updates.
- **Steps**
  1. Add/edit bookmark and notes.
  2. Trigger a full re-render path (refresh/update bus event).
- **Expected result**: Visual states/spacing remain stable and no flicker/disruptive jumps.
- **Pass criteria**: No duplicated or shifted widget wrappers after updates.

## 4. Backend / Data Layer Tests

### 4.1 data/config.json Schema Validation

#### BE-001 Validate required top-level keys
- **Description**: Confirm required config fields are present and typed correctly.
- **Steps**
  1. Parse `data/config.json` in browser using fetch.
  2. Validate required sections (widgets, layout, defaults).
- **Expected result**: All required keys exist and map to expected types.
- **Pass criteria**: Validation passes with no missing key errors.

#### BE-002 Validate unsupported keys handling
- **Description**: Ensure extra keys do not break runtime parsing.
- **Steps**
  1. Add temporary extra key in config.
  2. Reload config loader.
- **Expected result**: Extra keys are ignored or tolerated.
- **Pass criteria**: Core data still loads and renders correctly.

#### BE-003 Validate malformed config handling
- **Description**: Confirm behavior for invalid JSON syntax.
- **Steps**
  1. Introduce syntax error in `data/config.json`.
  2. Reload page.
- **Expected result**: Loader handles parser failure without total crash.
- **Pass criteria**: A controlled fallback message and no endless load loop.

#### BE-004 Validate widget config schema per type
- **Description**: Verify each widget entry has required properties and compatible values.
- **Steps**
  1. Check each widget object has type and any required settings.
  2. Test with missing required widget fields.
- **Expected result**: Invalid widget definitions are rejected or safely defaulted.
- **Pass criteria**: No fatal exception in app due to schema mismatch.

#### BE-005 Validate default/fallback config path
- **Description**: Ensure app can run when config file is incomplete.
- **Steps**
  1. Remove optional sections from config.
  2. Reload page.
- **Expected result**: Missing optional sections fall back to sensible defaults.
- **Pass criteria**: App still renders core widgets and controls.

### 4.2 config-loader.js

#### BE-006 config-loader exports and API surface
- **Description**: Confirm loader exposes expected API methods and signatures.
- **Steps**
  1. Inspect module import in console.
  2. Invoke exported loader function(s) once.
- **Expected result**: Public API resolves and can be called.
- **Pass criteria**: No `undefined` export exceptions.

#### BE-007 async fetch lifecycle behavior
- **Description**: Validate asynchronous load resolves/rejects gracefully.
- **Steps**
  1. Throttle network and observe pending/fulfilled states.
  2. Force fetch failure and then recover.
- **Expected result**: Loader can represent pending, success, and error states.
- **Pass criteria**: Loading indicator or error state appears appropriately.

#### BE-008 cache-control compatibility
- **Description**: Confirm no assumptions about non-browser caching policy.
- **Steps**
  1. Reload repeatedly with hard refresh and normal refresh.
  2. Modify config between reloads.
- **Expected result**: Most recent config is loaded when expected.
- **Pass criteria**: Fetch path avoids stale cache causing stale rendering in dev/test mode.

#### BE-009 error enrichment and reporting
- **Description**: Ensure load errors include actionable details.
- **Steps**
  1. Break config endpoint temporarily.
  2. Check surfaced error output/message.
- **Expected result**: Error is descriptive without exposing stack traces.
- **Pass criteria**: Error message indicates configuration issue and recovery path.

### 4.3 store.js

#### BE-010 default store initialization
- **Description**: Validate initial store state shape and defaults.
- **Steps**
  1. Load store module with empty local storage.
  2. Inspect returned state.
- **Expected result**: Store initializes to defined defaults.
- **Pass criteria**: No `undefined` properties used by UI.

#### BE-011 immutable update semantics
- **Description**: Confirm state updates do not mutate shared references unexpectedly.
- **Steps**
  1. Capture pre/post state snapshots for edit actions.
  2. Compare object identity expectations.
- **Expected result**: Predictable updates and reactivity compatibility.
- **Pass criteria**: No accidental mutation causing stale renders.

#### BE-012 state subscription and callbacks
- **Description**: Validate subscriber notifications fire on change.
- **Steps**
  1. Register a callback/listener.
  2. Trigger bookmark add/edit/delete action.
- **Expected result**: Subscriber receives payload updates.
- **Pass criteria**: UI-bound listeners refresh as expected.

#### BE-013 persistence integration from store
- **Description**: Confirm store writes changes to localStorage.
- **Steps**
  1. Perform edit action.
  2. Inspect localStorage after action.
- **Expected result**: Storage contains serialized latest state.
- **Pass criteria**: Persistence timestamp/version updates or equivalent marker present.

#### BE-014 store reset behavior
- **Description**: Validate clear/reset path returns app to defaults.
- **Steps**
  1. Populate store with custom state.
  2. Invoke reset API or UI reset function if present.
- **Expected result**: State returns to baseline.
- **Pass criteria**: Custom content removed and widget set returns to defaults.

### 4.4 widget-registry.js

#### BE-015 widget registration by key
- **Description**: Validate all widgets register correctly with unique keys.
- **Steps**
  1. Load registry and enumerate registrations.
  2. Check for duplicates and missing registration.
- **Expected result**: clock, bookmarks, notes, search are registered uniquely.
- **Pass criteria**: No duplicate keys and all required widgets available.

#### BE-016 lazy load behavior
- **Description**: Verify widget module lazy loading behaves correctly.
- **Steps**
  1. Inspect module loading when widget is enabled.
  2. Measure whether unused modules load unnecessarily.
- **Expected result**: Widgets load when needed, or predictable eager load as defined.
- **Pass criteria**: No unresolved module import when widget is disabled.

#### BE-017 renderer fallback for unknown type
- **Description**: Validate graceful handling of unknown widget type from config.
- **Steps**
  1. Inject unknown widget type in config.
  2. Reload app.
- **Expected result**: Unknown widget doesn't crash app.
- **Pass criteria**: Render fallback/placeholder and continue other widget processing.

#### BE-018 duplicate widget type conflict handling
- **Description**: Validate behavior for duplicate widget IDs or repeated config entries.
- **Steps**
  1. Add duplicate widget entries in config.
  2. Reload and inspect registry resolution.
- **Expected result**: App handles duplicates without collision errors.
- **Pass criteria**: Either dedupe strategy or deterministic first/last policy documented by UI behavior.

### 4.5 event-bus.js

#### BE-019 event subscription lifecycle
- **Description**: Confirm event listeners can be attached and disposed.
- **Steps**
  1. Register temporary subscriber.
  2. Trigger related event.
  3. Dispose listener.
- **Expected result**: Event fires once before dispose and never after cleanup.
- **Pass criteria**: No memory-leak-like duplicate events after repeated toggles.

#### BE-020 event payload validation
- **Description**: Validate event payload shape and data consistency.
- **Steps**
  1. Emit widget update events with expected payload.
  2. Attempt malformed payload.
- **Expected result**: Well-formed payload processes correctly; malformed payload handled safely.
- **Pass criteria**: No thrown exceptions due to shape mismatch.

#### BE-021 event ordering and debounce
- **Description**: Confirm event bursts do not cause redundant rendering.
- **Steps**
  1. Emit rapid successive updates.
  2. Observe UI and state update counts.
- **Expected result**: Final state is consistent.
- **Pass criteria**: No dropped final updates and no race-induced partial writes.

## 5. Integration Tests

### 5.1 Config → Widget flow

#### IN-001 Config-driven rendering to widget mount
- **Description**: Verify entire flow from `config.json` to widget DOM exists.
- **Steps**
  1. Load app with fully populated config.
  2. Verify each widget renders according to config.
- **Expected result**: Config sections map correctly to widget outputs.
- **Pass criteria**: All widgets specified in config are present and functional.

#### IN-002 Toggle widget enablement in config
- **Description**: Validate disabling widget in config removes widget from DOM.
- **Steps**
  1. Mark one widget disabled in config.
  2. Reload app.
- **Expected result**: Disabled widget not rendered.
- **Pass criteria**: No render errors and remaining layout updates correctly.

#### IN-003 Config + store merge precedence
- **Description**: Verify precedence when config and localStorage both define state.
- **Steps**
  1. Seed localStorage with modified data and keep config default.
  2. Load app.
- **Expected result**: Save precedence rule is honored (documented by existing behavior).
- **Pass criteria**: Result matches intended source of truth policy.

#### IN-004 Search provider update from config
- **Description**: Validate search widget behavior follows config-defined provider URL/params.
- **Steps**
  1. Set config search provider to alternate base URL.
  2. Save and reload.
  3. Trigger search query.
- **Expected result**: Search target URL changes accordingly.
- **Pass criteria**: Generated target includes configured provider.

### 5.2 Edit Mode → Store → Re-render

#### IN-005 Edit bookmark then immediate UI update
- **Description**: Verify live chain from edit form to store and re-render.
- **Steps**
  1. Enter edit mode.
  2. Update bookmark title.
  3. Save and observe widget rendering.
- **Expected result**: Widget updates without full page reload.
- **Pass criteria**: DOM updates occur and reflect updated value.

#### IN-006 Edit notes in one session and persist
- **Description**: Validate one-shot note edit updates store and stays rendered.
- **Steps**
  1. Edit notes and save.
  2. Check store payload and UI.
- **Expected result**: Store and DOM share the latest text.
- **Pass criteria**: No mismatch between store and visible content.

#### IN-007 Multi-widget simultaneous updates
- **Description**: Validate multiple widget updates in one edit session.
- **Steps**
  1. Edit bookmarks and notes in one save action.
  2. Refresh page.
- **Expected result**: Both updates persist and render.
- **Pass criteria**: Combined changes persisted together with no partial failure.

### 5.3 Bookmark CRUD

#### IN-008 Full CRUD with persistence
- **Description**: Validate create-read-update-delete lifecycle for bookmarks.
- **Steps**
  1. Add bookmark.
  2. Edit bookmark.
  3. Delete bookmark.
  4. Reload page.
- **Expected result**: Lifecycle completes end-to-end with persistence.
- **Pass criteria**: Final list reflects delete operation and edit/add not retained unless saved.

#### IN-009 Bookmark validation on CRUD operations
- **Description**: Verify input validation across create/update path.
- **Steps**
  1. Add bookmark with invalid URL, missing label, duplicate entries.
  2. Attempt save.
- **Expected result**: Invalid inputs are blocked or corrected.
- **Pass criteria**: Only valid entries appear in persisted store.

#### IN-010 Duplicate URL policy
- **Description**: Validate handling of duplicate bookmark URLs.
- **Steps**
  1. Add two items with identical URL.
  2. Save and inspect widget ordering.
- **Expected result**: Expected duplicate policy applied (allow or dedupe).
- **Pass criteria**: No silent data corruption; explicit and consistent behavior.

## 6. Nginx / Delivery Tests

### 6.1 MIME types (especially .js modules)

#### DX-001 JavaScript modules served as application/javascript
- **Description**: Confirm `.js` and `.mjs` assets are served with correct MIME type.
- **Steps**
  1. Open devtools Network and load page.
  2. Check module files response headers.
- **Expected result**: JS module files are served as JS MIME.
- **Pass criteria**: Browser imports execute without MIME-related errors.

#### DX-002 JSON and CSS MIME checks
- **Description**: Confirm `data/config.json` and stylesheet resources are served correctly.
- **Steps**
  1. Reload and inspect response headers for `data/config.json` and CSS from Tailwind CDN/local.
- **Expected result**: JSON returns `application/json`, stylesheet returns style MIME.
- **Pass criteria**: No failed stylesheet or parser errors due MIME mismatch.

### 6.2 index.html served at root

#### DX-003 root-to-index routing
- **Description**: Verify root requests resolve to `index.html`.
- **Steps**
  1. Request `/`.
  2. Request `/index.html`.
- **Expected result**: Both URLs return same SPA-like entry document.
- **Pass criteria**: Status 200 and identical relevant markup.

#### DX-004 fallback behavior for unknown route
- **Description**: Confirm unknown static route behavior does not break app assets.
- **Steps**
  1. Request unknown path not mapped to file.
  2. Verify nginx returns expected behavior from config.
- **Expected result**: Static server behavior is consistent and documented (404 or fallback).
- **Pass criteria**: No security-sensitive directory listing and no broken partial HTML output.

### 6.3 Assets reachable

#### DX-005 asset path integrity
- **Description**: Confirm all core assets are retrievable by browser from expected paths.
- **Steps**
  1. Manually request `js/config-loader.js`, `js/store.js`, `js/widget-registry.js`, `js/event-bus.js`, and widget modules.
  2. Ensure status 200 for all.
- **Expected result**: All files return 200.
- **Pass criteria**: No 404/403 on required assets in production-like deployment path.

#### DX-006 cache-control headers
- **Description**: Verify headers support predictable static behavior.
- **Steps**
  1. Inspect response headers for cache control on `index.html` and JS asset files.
  2. Evaluate long-lived cache policy suitability.
- **Expected result**: Distinct cache strategy exists for entry shell and immutable assets.
- **Pass criteria**: No stale UI from over-aggressive caching in test/deploy env.

#### DX-007 compression and size sanity
- **Description**: Validate gzip/brotli and uncompressed transfer sizes are reasonable.
- **Steps**
  1. Review network size and content-encoding for JS/CSS.
  2. Confirm no unexpected bloated assets loaded unexpectedly.
- **Expected result**: Static resources efficiently served.
- **Pass criteria**: No accidental huge assets loaded unexpectedly.

## 7. Usability and Accessibility Checks

- Validate action hierarchy and discoverability across view and edit modes.
- Validate keyboard-only operation for key controls (edit mode toggle, remove action, add actions, search submit).
- Validate mobile touch target size and tap usability (`44px`-plus targets where practical).
- Validate readable and visible focus states in all actionable components.
- Validate standalone install behavior where supported (icon + safe area + immersive launch posture).
- Validate contrast and low-light readability after deep interaction (hover/active/focus states).

## 8. Regression Checklist

- Confirm index shell and scripts still load after any static deployment change.
- Verify bookmark CRUD remains end-to-end functional.
- Verify notes storage does not regress with Unicode and multiline input.
- Verify edit mode does not create duplicate event listeners or stale renders.
- Verify store persistence still recovers from invalid localStorage values.
- Verify search widget remains functional when search provider values change.
- Verify Nginx serves `.js` modules with `application/javascript`.
- Verify visual layout remains coherent at mobile, tablet, and desktop breakpoints.
- Verify config shape changes are forward-compatible with existing users.

## 9. Pass/Fail Criteria

### 9.1 Pass Criteria
- All mandatory test cases in sections 3–6 are executed.
- At least 90% of listed scenarios pass with no critical defects.
- No blocking runtime errors in browser console on baseline supported browsers.
- Config load, edit mode save, and reload persistence paths complete successfully.
- Nginx returns correct MIME types for all JS modules and JSON assets.

### 9.2 Fail Criteria
- Critical or blocker defects in page load, widget initialization, or data persistence.
- Repeated module import failures or missing asset delivery (404/MIME).
- Data-loss conditions in localStorage for add/edit/delete operations.
- Regression causing edit mode to mutate state without save confirmation.
- Hard crashes on invalid config or storage payloads.
- Any user-facing security issue from static delivery config in basic checks.
