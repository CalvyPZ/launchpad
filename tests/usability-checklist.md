# CalvyBots — Usability Checklist

> QA reference document. Run this checklist after each Frontend or Backend delivery.
> Record outcomes in `team/qa-status.md` and append verdicts to `team/qa-complete-v4.md` when the Team Lead requests repo updates.
> Items marked **[Interactive]** require a live browser session and cannot be verified by static code review alone.

---

## 1. Page load and shell

- [ ] Page loads at `/` without uncaught JS errors in the console.
- [ ] Offline banner (`aria-live` strip) is **hidden** when the browser is online.
- [ ] Offline banner **appears** within 1–2 seconds of disconnecting the network. **[Interactive]**
- [ ] Dashboard title (editable in header) renders the correct persisted or default value.
- [ ] Alpine.js mounts without errors; `x-data="launchpad"` is active on root.
- [ ] Tailwind CDN and Alpine.js CDN respond 200 in Network tab. **[Interactive]**

---

## 2. Widget rendering

- [ ] Default widget layout loads (clock, or user's saved layout).
- [ ] Each widget renders its content without overlapping the shell title.
- [ ] **No duplicate widget titles** — shell renders the title once; widget body does not add another.
- [ ] Widget cards have visible card borders/surfaces (depth model not flat).
- [ ] Cyan accent color (`#2dd4bf`) is used for interactive highlights, not purple/violet.

### Clock widget
- [ ] Clock displays current local time and updates every second.
- [ ] Clock displays current date.
- [ ] Clock gracefully handles DST transitions (no freeze or jump to wrong hour). **[Interactive]**

### Sticky Notes widget
- [ ] Notes textarea accepts text input and persists on blur/save.
- [ ] Markdown renders in preview mode (headings, lists, emphasis, links).
- [ ] Markdown is sanitized — a `<script>` tag in note content does not execute. **[Interactive]**
- [ ] Split / Source / Preview mode buttons toggle correctly with `aria-pressed`.
- [ ] When Markdown CDN libraries are unavailable offline, a plain-language message appears (not a spinner). **[Interactive]**
- [ ] Multiple Notes instances each have **independent** content (editing one does not affect another). **[Interactive]**

### To-Do widget
- [ ] Tasks can be added via the input field and confirmed with Enter or button.
- [ ] Tasks can be marked done (checkbox or equivalent).
- [ ] Tasks persist across page reload. **[Interactive]**
- [ ] Empty state shows a helpful message, not a blank area.
- [ ] Recurrence options are visible and labeled in plain language (e.g. "Every day at a set time", "Never (manual only)").
- [ ] Daily reset: completed tasks reset after the configured time on the following day. **[Interactive]**
- [ ] Weekly reset: completed tasks reset on the configured weekday and time. **[Interactive]**
- [ ] Never reset: completed tasks do NOT auto-clear. **[Interactive]**
- [ ] Multiple To-Do instances each have **independent** tasks and recurrence settings. **[Interactive]**

---

## 3. Edit mode

- [ ] Edit toggle button activates edit mode; visual indicator confirms (e.g. button label, border style).
- [ ] In edit mode, widget drag handles are visible and reachable by keyboard.
- [ ] Widgets can be reordered by drag-and-drop; new order persists after reload. **[Interactive]**
- [ ] Add Widget dropdown appears in edit mode and lists only: **Clock**, **Sticky Notes**, **To-Do**.
- [ ] Bookmarks, Search, and Sysinfo do **not** appear in the Add Widget dropdown.
- [ ] Adding a widget renders it immediately and persists after reload. **[Interactive]**
- [ ] Remove button appears on each widget card in edit mode.
- [ ] Removing a widget prompts confirmation (or is reversible) before deleting. **[Interactive]**
- [ ] Widget rename (inline input) is visible and functional in edit mode.
- [ ] Renamed widget title persists after reload. **[Interactive]**
- [ ] Edit mode hint or cue is visible to new users.
- [ ] Exiting edit mode with Escape key works. **[Interactive]**

---

## 4. Persistence and migration

- [ ] `calvybots_widgets` key exists in localStorage after first load.
- [ ] Layout and widget state survive a hard page reload.
- [ ] Legacy `calvybots_notes` key (if present) is migrated into the first Notes widget row and removed.
- [ ] Legacy `calvybots_todo` key (if present) is migrated into the first To-Do widget row and removed.
- [ ] If no Notes/To-Do widget exists at migration time, legacy keys are left intact (not lost). **[Interactive]**
- [ ] Adding a new widget after migration triggers migration check (new instance gets clean state, not stale legacy). **[Interactive]**

---

## 5. PWA and installability

- [ ] `<link rel="manifest">` is present in `<head>`.
- [ ] `manifest.json` is served with `Content-Type: application/manifest+json`.
- [ ] `sw.js` is served with `Cache-Control: no-store`.
- [ ] Service worker registers successfully (Application > Service Workers in DevTools shows "activated"). **[Interactive]**
- [ ] Install prompt appears in supported browsers (Chrome, Edge) when served over HTTPS. **[Interactive]**
- [ ] Installed app launches in standalone mode (no browser chrome). **[Interactive]**
- [ ] Offline: opening the app with no network shows the cached shell (not a browser error page). **[Interactive]**
- [ ] Offline: Markdown preview libraries may be unavailable; this is expected and clearly communicated.
- [ ] `/api/` routes are **not** intercepted by the service worker (Network tab shows direct network requests). **[Interactive]**
- [ ] Icons appear in the install prompt (SVG icon at minimum). **[Interactive]**

---

## 6. Visual and accessibility

- [ ] Cyan accent (`#2dd4bf`) is consistent across focus rings, active controls, and interactive highlights.
- [ ] No purple/violet/indigo colors appear in active UI states.
- [ ] Card depth is visible — widget cards have surface contrast against the page background.
- [ ] All interactive elements have a visible `:focus-visible` ring.
- [ ] Keyboard navigation reaches all controls without traps.
- [ ] Icon-only buttons have `aria-label` attributes.
- [ ] Color contrast meets WCAG AA for primary text on card surfaces.
- [ ] Offline indicator has `aria-live="polite"` and announces the state change to screen readers. **[Interactive]**

---

## 7. Mobile and responsive

- [ ] Layout is single-column at viewport width ≤ 640px.
- [ ] All touch targets are ≥ 42px in height.
- [ ] Edit mode controls are reachable in portrait orientation on a narrow screen.
- [ ] Widget resize does not conflict with vertical scroll on mobile (resize disabled below 640px or resize handle does not activate on scroll). **[Interactive]**
- [ ] `env(safe-area-inset-*)` padding applies when app is in standalone mode on iOS. **[Interactive]**
- [ ] Notes pane splits to single-column on narrow viewports.

---

## 8. Error and edge states

- [ ] If `data/config.json` fails to load (404 or network error), the app falls back gracefully without a crash.
- [ ] If `localStorage` is unavailable (private browsing, storage blocked), the app loads in a degraded-but-functional state.
- [ ] Corrupted localStorage values (non-JSON) are handled without throwing; app falls back to defaults.
- [ ] If a widget module fails to load (404 JS), a compact error card renders instead of a blank slot.

---

## Sign-off record

| Date | Track | Verdict | QA Agent | Doc reference |
|------|-------|---------|----------|---------------|
| 2026-05-13 | PWA / online-first | Pass | qa-engineer | `team/qa-complete-v4.md` PWA supplement |
| 2026-05-13 | Notes & To-Do (static) | Pass with notes | qa-engineer | `team/qa-complete-v4.md` §Notes & To-Do |
| 2026-05-13 | QA remediation cycle 2 | Pass with notes | qa-engineer | `team/qa-complete-v4.md` §Cycle 2 |
| 2026-05-13 | QA remediation cycle 3 — ticker | Pass | qa-engineer | `team/qa-complete-v4.md` §Cycle 3 |
| — | Interactive follow-ups (recurrence, XSS, cold start) | Pending | — | `team/qa-complete-v4.md` §Pending |
