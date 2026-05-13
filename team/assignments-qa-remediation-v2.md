# Assignments — QA remediation follow-ups (Frontend accessibility & picker semantics)

**Date:** 2026-05-13
**Track:** QA follow-up pass after prior static review
**Owner:** Frontend Dev
**Status:** Completed

---

## Scope

Address 4 medium/low findings from frontend QA follow-up:

1. Accessible naming for icon-only widget drag handle in `js/app.js`.
2. Widget picker listbox semantics and keyboard robustness in `index.html`.
3. Normalize malformed CSS pseudo-element selectors in `css/style.css`.
4. Apply safe-area insets where relevant for mobile/pwa shell alignment (`env(safe-area-inset-*)`) in line with style-guide expectations.

## Files to touch

- `index.html`
- `js/app.js`
- `css/style.css`
- `team/style-guide.md` (if any visible behavior/pattern docs change)
- `team/lead-status.md`

## Acceptance bullets

- `js/app.js`: every icon-only control, including widget drag handles, has a meaningful `aria-label` (and/or visible tooltip text where appropriate) that is announced by screen readers.
- `index.html`: widget add flow exposes a valid listbox/select pattern (`role="listbox"` + stable combobox/popup semantics), supports keyboard open/close and item navigation (Arrow keys + Enter/Space activation), and remains usable with pointer/touch input.
- `css/style.css`: focus and pseudo-element selectors are normalized to valid syntax; specifically remove malformed `:::`/`:::-webkit-*` usages.
- `css/style.css`: safe-area insets are used in mobile shell regions that may conflict with notches / browser chrome, and keep a non-safe-area fallback.
- `index.html` + `css/style.css`: no regressions in existing widget add flow or drag interactions; changes are documented where the interaction contract changes.
- `team/style-guide.md`: updated for any new visible interaction pattern (e.g., picker behavior, accessible naming, safe-area handling).

## Notes

- 2026-05-13: Completed in this pass. Added combobox/listbox semantics to the widget picker, keyboard support (open/close + navigation + activation), icon-only drag-handle naming and keyboard reorder, pseudo-selector syntax normalization, and safe-area padding for shell/mobile containers.

### QA cycle 4 follow-up (2026-05-13)

- Closed remaining follow-up defects from QA cycle 4:
- Normalized `css/style.css` malformed pseudo-element selectors to valid CSS (`:focus-visible`, `::-webkit-scrollbar*`).
- Updated `team/style-guide.md` manifest filename reference from `manifest.webmanifest` to `manifest.json`.

## Definition of done

- `js/app.js`, `index.html`, and `css/style.css` satisfy all acceptance bullets with static review and a short interactive smoke check from the QA engineer.
- Any visible styling/behavioral changes are reflected in `team/style-guide.md`.
- `team/lead-status.md` and this assignment file are updated with outcome and status.
- Frontend commits include all changed files for this deliverable, including any required team docs.
