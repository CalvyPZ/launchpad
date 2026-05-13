# Team Lead Status

Date: 2026-05-13

Status: **Client direction recorded — PWA with online-first behavior**

## Manager — client decision (record for delegation)

The client requires the site to **qualify as a Progressive Web App** with **basic offline support**, while making clear that the **primary experience is online**. Manager should prioritize:

1. **Installability and PWA shell** — manifest, icons, standalone display, service worker registration, and nginx MIME or cache headers already aligned in repo; confirm PNG `icons/icon-192.png` and `icons/icon-512.png` when art is ready (see `icons/README.md`) for broadest install surfaces.
2. **Offline behavior** — precache the same-origin app shell (HTML, CSS, core JS, widgets, manifest, SVG icon) so repeat visits can open without a network; do **not** treat offline as a full second mode. CDN assets (Tailwind, Alpine, fonts) remain network-first at the browser layer; optional follow-up is self-hosting those assets if the client wants richer offline styling.
3. **Online-first fetch policy** — service worker uses **network-first for same-origin** requests so connected users receive updates promptly; cache is fallback when the network fails. API routes stay out of the service worker path (direct to network).
4. **UX** — a lightweight **offline indicator** in the UI is acceptable so users understand when they are on cached shell only.

Frontend Dev implements or adjusts behavior per the above; Backend Dev confirms `nginx-site.conf` continues to serve `sw.js` and `manifest.json` correctly; QA validates install + online-first + offline shell per `team/delegation-v4.md` PWA bullets and the supplement below.

---

## Current delegation (visual track, unchanged in spirit)

1. **Frontend Dev**
   - Continue visual iteration with a clear focus on making cyan accents obvious, premium, and creative (depth, gradients, glow, and motion accents).
   - Maintain the dark charcoal foundation and mobile web-app friendliness.
   - Rework any elements that still appear flat or muted from the last pass.
   - Honor the **PWA / online-first** client direction above in parallel (service worker, manifest copy, offline strip).

2. **QA**
   - Revalidate visual hierarchy and accessibility/usability with the updated style after Frontend Dev changes.
   - Verify `tests/usability-checklist.md` and the `## 7. Usability and Accessibility Checks` section in `tests/test-plan.md`.
   - Confirm cyan accents are visible, non-harsh, and integrated into controls, focus, and cards.
   - Execute **PWA / online-first QA** (manifest + SW registration, connected reload picks up asset changes, offline opens cached dashboard, API uncached by SW).

Overall direction:

- Build a **static, build-free** dashboard that runs directly from `index.html` on nginx.
- Use **Tailwind CSS via Play CDN** as the only required utility styling layer.
- Keep optional logic lightweight (vanilla JS + small CDN helpers only), with a registry-driven widget system.
- Implement **dark-mode-first**, modern minimalist visual language.
- Deliver an **edit mode** for rearranging, adding, removing, and configuring widgets with persistence in `localStorage`.
- Deliver a **PWA** with **basic offline shell** and **online-primary** runtime policy.

Next step is immediate parallel implementation by Frontend Dev and QA against this updated manager delegation.

---

## Client direction — Notes & To-Do widgets (2026-05-13)

**Status:** Recorded for Team Lead prioritisation and delegation. Implementation sequencing is at lead discretion; QA should treat this as a **new acceptance track** once builds land.

### Manager summary (what the client asked for)

1. **Multiple instances** — Users may have **several** Sticky Notes and **several** To-Do widgets on the dashboard at once; behaviour and data must not collide between instances.
2. **Survives power cycle** — All widget instances, titles, content, layout, sizes, and recurrence settings remain after device restart (same persistence tier as the rest of the dashboard: today `localStorage`; if the team moves widget payloads into a single serialised document, that document must remain the source of truth on reload).
3. **Renamable** — Each widget has a user-editable **display name** (distinct from internal `id`), surfaced in the shell/header in edit and normal use where appropriate.
4. **To-Do recurrence / reset** — User-configurable **reset schedule** so lists can behave as **daily**, **weekly**, or **non-repeating** tasks: when the configured boundary passes, completed items (or the whole list per product decision) reset according to spec; **never** repeating tasks do not auto-clear.
5. **Notes: Markdown** — Note bodies support **Markdown** rendering (or a safe subset) with sensible defaults for editing vs preview.
6. **Layout** — Widgets are **resizable** on capable viewports while remaining **usable on mobile** (touch targets, min sizes, no reliance on hover-only affordances).

### Delegation (Team Lead → devs)

- **Frontend Dev**
  - Extend the widget **data model** and `js/store.js` (or successor) so each widget instance has stable `id`, optional `title`, layout/size fields, and **scoped** notes/todo payload (no shared global key per type for all instances).
  - Implement **rename** in edit mode (inline or modal; match existing dashboard patterns).
  - **To-Do:** model recurrence (`never` | `daily` | `weekly` or equivalent), user-facing configuration UI, and evaluation on load (and optionally `setInterval` / `visibilitychange` for long sessions) so resets happen at configured local times; document edge cases (timezone, DST) in code comments or brief.
  - **Notes:** integrate a **small Markdown** pipeline (prefer dependency already aligned with static hosting); **sanitize** output before `innerHTML` or use a safe renderer.
  - **Resize:** resizable shell or card with **minimum dimensions** and **mobile-safe** interaction (e.g. handle size, no accidental drags while scrolling).
  - Update `team/style-guide.md` if new interaction patterns (resize handles, markdown toolbar, recurrence controls) need tokenised rules.
- **Backend Dev**
  - No new server persistence required unless product later adds accounts; confirm nginx continues to serve any **new static assets** (e.g. markdown library if self-hosted) with correct MIME and caching; keep `/api/` out of SW cache per existing PWA rules.
- **QA**
  - Execute the checklist in `team/delegation-v4.md` under **Client amendment — Notes & To-Do depth** and the supplement **Notes & To-Do widgets — QA acceptance (pending)** in `team/qa-complete-v4.md`.
  - Explicit **human-friendliness / UX** pass: labelling for recurrence, empty states, errors, discoverability of rename and resize, and thumb reach on small screens.

### Next step

**Update (2026-05-13):** Implementation and static QA review are recorded under **Subagent execution** below. Team Lead should confirm reset semantics with the client if needed; QA should run **interactive** supplement checks (browser, cold start, time-based recurrence, XSS probes, viewports) before full sign-off.

### Assignments issued (2026-05-13)

Formal, file-scoped tasks for the Notes & To-Do track live in **`team/assignments-notes-todo.md`**, including the team default for recurrence (**daily/weekly:** clear `done` only, keep ids/text; **never:** no auto reset; evaluate on load and `visibilitychange` using device-local time with user-configured `HH:MM` and weekly weekday 0–6). **Frontend Dev** should implement first (store, shell, widgets, CDN markdown, resize, migration off legacy keys); **Backend Dev** follows for nginx / SW precache verification only as needed for assets introduced by that work.

### Subagent execution (2026-05-13)

Cursor **Task** subagents were run against the project files in this order:

1. **Team Lead** — Authored **`team/assignments-notes-todo.md`** (Frontend / Backend / QA / Definition of done) and recorded **Assignments issued** above.
2. **Frontend Dev** — Implemented the checklist in **`team/assignments-notes-todo.md`** in **`js/store.js`**, **`js/app.js`**, **`js/widgets/{notes,todo,clock}.js`**, **`css/style.css`**, **`index.html`**.
3. **Backend Dev** — Confirmed **`nginx-site.conf`** and **`sw.js`** need no change for CDN-only Markdown libraries; no repository edits in that pass.
4. **QA** — Static/code + UX review: **`team/qa-complete-v4.md`** subsection **Verdict — Notes & To-Do (static review 2026-05-13)**; **`team/qa-status.md`** updated with outcome (**Pass with notes**) and pointer to interactive follow-up testing.

Interactive browser testing (cold start, time-based recurrence, XSS probes, multi-viewport) remains recommended before treating the track as fully closed.

### QA remediation delegation (2026-05-13)

Frontend Dev implemented **`team/assignments-qa-remediation-v1.md`**; QA recorded cycles 2–3 in **`team/qa-complete-v4.md`**. Interactive re-verify items in that assignments file remain recommended before client demo.

### Team Lead sign-off — Notes & To-Do QA loop (2026-05-13)

Per **`team/assignments-qa-remediation-v1.md`** (Definition of done and ordered checklist), the Frontend remediation work is in place; **`team/qa-complete-v4.md`** records **QA remediation cycle 2** (**Pass with notes**, remediation DoD met from static review) and **QA remediation cycle 3 — ticker hygiene** (**Pass**, static), confirming todo-reset interval arm/disarm when the tab is hidden or visible and leaving no further code findings from that pass. **The Notes & To-Do QA remediation implementation track is closed from Team Lead’s perspective:** what remains is only interactive verification—the **QA — second cycle re-verify** list in the assignments file plus the supplement acceptance bullets in the same QA doc—so hands-on browser QA is still recommended before a client demo.

