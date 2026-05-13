# CalvyBots Team Brief — Personal Quick-Access Dashboard

## 1) Project overview and goals

CalvyBots is building a personal quick-access dashboard that runs as a **static-first homepage**: fast, low-maintenance, and fully customizable by the user.

### Goals

- Provide a modern, minimalist, dark-mode-first landing/dashboard that feels fast and focused.
- Keep the implementation simple: no build step, no bundler, no local runtime dependencies.
- Support quick-access habits: weather, clock, bookmarks, notes, tasks, and calculator-style utilities.
- Keep a modular widget system so new widgets can be added without replacing the entire page.
- Enable "edit mode" to reorder, add, hide, and remove widgets in-browser.
- Ensure reliability on plain static hosting (e.g., nginx) and graceful behavior when optional APIs fail.

### Success criteria

- Loads directly from `index.html` and works from file served by nginx.
- No `npm`, no `vite`, no `webpack`, no TypeScript compilation step.
- Mobile and desktop layouts remain usable with good spacing and touch-safe controls.
- The page remains useful even when JavaScript is limited: core sections should still render sensibly.

---

## 2) Recommended file/folder structure

Use a static, predictable structure so all team members can work in one area without build tooling conflicts.

```text
N:/web_app/
  index.html
  team/
    brief.md
    lead-status.md
  assets/
    css/
      main.css
    js/
      app.js
      widget-registry.js
      widgets/
        clock.js
        weather.js
        bookmarks.js
        notes.js
        quick-links.js
        calendar.js (optional)
      edit-mode.js
      storage.js
  data/
    sample-config.json
    sample-notes.json
  icons/
    / (optional local svgs)
```

### Rationale

- `index.html` remains entrypoint for CDN-based dependencies and bootstrap.
- `assets/js/widget-registry.js` centralises registration/loading/saving behavior.
- Per-widget scripts live in `assets/js/widgets/` for ownership clarity and isolation.
- `data/` stores local sample/default config only; runtime state remains `localStorage`.
- `team/` stores process/coordination docs only.

---

## 3) Technology stack (CDN-only, no build step)

### Required baseline

- **HTML/CSS/JS** only, served as static files.
- **Tailwind CSS via Play CDN**:
  - `<script src="https://cdn.tailwindcss.com"></script>`
- **Optional light JS framework** via CDN when needed for reactivity:
  - recommended: **Alpine.js** for edit-mode UI interactions
  - or **htmx** only if endpoint-driven partial updates become required.

### Optional optional libraries (only if needed)

- `sortablejs` (for drag-and-drop) from trusted CDN for widget rearrange.
- `dayjs` for date formatting.
- Any weather API client (fetch wrapper only; no external SDK).

### Why this stack

- Static-compatible with nginx by design.
- Lower maintenance and easier deployment: one `index.html` plus static folders.
- Fast edits in plain JS for teammates with minimal setup overhead.
- CDN loads keep the app runnable without package lockfiles or install steps.
- Debuggable directly in browser console with zero compile indirection.

### Non-goals for this phase

- No SSR framework.
- No backend datastore.
- No authentication system.
- No API key hardcoding in the frontend (inject via user input or backend proxy if needed later).

---

## 4) Widget architecture

The dashboard is driven by a **widget registry + config model**.

### Core model

- `window.CALVY_WIDGETS` stores widget definitions (metadata + behavior hooks).
- App config is an ordered list saved in `localStorage`:
  - `id`, `kind`, `title`, `enabled`, `position`, and `settings`.
- At render time:
  1. Read saved config (or fallback to `data/sample-config.json`).
  2. Instantiate each enabled widget from the registry.
  3. Mount output into dedicated grid slots.
  4. Apply layout changes back to config and persist automatically.

### Widget contract

Each widget module should expose a factory shape:

- `id` (`string`) — stable widget kind id.
- `label` (`string`) — display name.
- `icon` (`string`) — optional visual label.
- `defaultSettings` (`object`) — safe defaults.
- `render(containerEl, settings, context)` — render UI into container.
- `destroy(containerEl)` (optional) — clean event listeners/timeouts.
- `onConfigChange(settings)` (optional) — refresh when settings updated.

### Loading strategy

- All widget scripts are registered once from `index.html` as static imports via script tags OR lazy `type="module"` loading from `widget-registry`.
- If a widget fails to load, render compact fallback card:
  - title + brief error + retry button.
- Keep each widget style self-contained but consume shared CSS tokens from the global theme.

### Persistence and compatibility

- Store config in `localStorage` key: `calvy.dashboard.config.v1`.
- Validate loaded config and sanitize before render:
  - remove unknown widget kinds.
  - clamp slot values.
  - fallback defaults when settings are missing.
- Export function for future import: `window.CALVY_EXPORT_STATE()`.

---

## 5) Style guide (dark-mode-first, modern minimalist)

### Visual direction

- Dark, restrained palette with subtle contrast.
- Heavy whitespace and strong typographic hierarchy.
- Clean cards, thin borders, soft elevation, minimal shadows.

### Color tokens (CSS variables)

- `--bg: #0b1020`
- `--bg-elevated: #121a2d`
- `--panel: #131b30`
- `--border: #2a3653`
- `--text: #eef2ff`
- `--muted: #a5b1c5`
- `--accent: #5ce4ff`
- `--accent-strong: #3a8dff`
- `--danger: #ff5c87`
- `--success: #33dd9c`

### Typographic system

- Headings and labels: **Outfit**, **Inter** fallback.
- Body: **Inter**.
- Use weights `500/600/700` only where needed.
- Font scale: restrained incremental scale with clear hierarchy and large tap targets.
- Avoid all-caps in body text except small tag chips.

### Spacing & layout patterns

- Grid baseline: `gap-4` for widgets, `gap-3` inside cards.
- Radii: `0.75rem` for cards, `0.5rem` for controls.
- Border emphasis over fill color; avoid saturated surfaces.
- Keep rhythm with `1.25rem`, `1.5rem`, `2rem` spacing tiers.

### Components

- **Widget card**: title row, settings button, main content, subtle CTA footer if needed.
- **Primary button**: outlined fill-on-hover style, small motion and clear focus ring.
- **Input fields**: compact, high contrast labels, inline helper text.
- **Toast/snackbar**: short-lived feedback for save/reorder actions.
- **Empty state**: concise onboarding block with 2 example actions.

### Motion language

- Use minimal micro-motion only where useful:
  - entry fade/slide for new cards (150-220ms)
  - compact reorder transition when drag/drop completes
  - respect `prefers-reduced-motion`.

---

## 6) Edit-mode concept

### User flow

1. User clicks **Edit** in header/top bar.
2. Page enters edit mode:
   - cards show drag handles
   - **Add widget**, **Remove**, and **Settings** controls become visible.
3. User rearranges/reconfigures widgets.
4. User clicks **Done**.
5. Layout is auto-saved to `localStorage`.

### Edit-mode implementation notes

- Maintain a global `appState.editMode` boolean.
- While edit mode is active:
  - card content can still be visible but actions are surfaced.
  - drag/drop interactions are enabled.
  - keyboard shortcuts available (`Esc` exits edit mode).
- Save cadence:
  - Save to `localStorage` on every structural change.
  - Debounced autosave for setting changes.
- Exit safety:
  - Cancel button restores last persisted snapshot.
  - Confirmation only for destructive actions (widget delete).
- Optional future extension:
  - JSON import/export of dashboard config from a backup modal.

### Accessibility requirements

- Controls are keyboard reachable.
- Drag handles include `aria-label` and proper `tabindex`.
- Edit mode state indicated via `aria-live` and `aria-pressed`.
- Focus trap should be avoided by default; maintain clear skip-link and back-button behavior.

---

## 7) Coordination notes for teammates

### Frontend Dev

1. Implement `index.html` shell and layout classes using Tailwind CDN.
2. Build `assets/js/app.js` and `assets/js/widget-registry.js`.
3. Implement first widget set and edit-mode UI interactions.
4. Keep styles centralized via CSS variables in `assets/css/main.css`.
5. Validate keyboard accessibility and responsive behavior (desktop + mobile).

### Backend Dev

1. Define widget config schema in `data/sample-config.json`.
2. Define placeholder API strategy docs (especially weather source, data freshness, and rate limit handling).
3. Standardize `localStorage` schema + migration rules for future schema versions.
4. Build optional static utility module `assets/js/storage.js`:
   - safe get/set
   - migration and default fallback
   - JSON validation helpers.

### QA

1. Draft test matrix:
   - rendering with default config
   - add/remove/reorder/save
   - widget failure fallback
   - edit-mode toggle and keyboard flows.
2. Verify static-host constraints:
   - works on direct file serve + nginx root.
   - CDN scripts load and fail gracefully if offline.
3. Produce manual acceptance checklist before release.

---

## 8) Communication and change control

- Keep updates in `team/brief.md` as source of truth.
- If architecture changes, append a dated section:
  - `## Update YYYY-MM-DD`.
- Each teammate should annotate assumptions and blockers in comments in their working notes.
- No PR is expected in this phase; treat this brief as baseline for the implementation sprint.

---

## 9) Current phase decision (for this repo)

Phase 1 will implement:

- Static shell + theme tokens
- Registry-driven widget architecture
- Basic widgets: clock, bookmarks, notes, weather (safe fallback)
- Edit-mode with reorder + add/remove + settings persistence
- Local-only persistence and no build requirement

## 10) Open decisions

- Weather provider and forecast depth (current conditions only vs hourly/daily)
- Whether drag-and-drop is native HTML5 or SortableJS CDN
- Whether notes support markdown rendering or plain text in v1

