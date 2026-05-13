# Skill: QA Testing Workflow

Use this skill when performing QA validation, running acceptance checks, or verifying features after implementation.

## QA documentation locations

| Document | Purpose |
|----------|---------|
| `tests/test-plan.md` | Test matrix (§7 for usability/accessibility) |
| `tests/usability-checklist.md` | Primary QA checklist |
| `team/qa-complete-v4.md` | Running QA supplement (PWA, Notes & To-Do, remediation cycles) |
| `team/qa-status.md` | Current QA outcome summary |
| `team/delegation-v4.md` §4 | QA task list from current delegation |

## Testing tracks

### Visual track
- Cyan accents visible and integrated (controls, focus, cards)
- No purple in active UI states
- Depth and hierarchy improved (surface contrast, hover/elevation)
- No duplicate widget titles inside widget shells

### Widget flow track
- Add/edit widgets only from main dashboard page
- Dropdown widget adder exposes only: Clock, Sticky Notes, To-Do
- New widgets render and save in layout
- Existing user data preserved through migrations

### PWA / online-first track
- Manifest installable in supported browsers
- Install adds app to home/desktop, opens in standalone mode
- Offline opens cached shell dashboard
- `/api/` never cached by service worker
- Connected reload picks up asset changes

### Notes & To-Do depth track
- Multiple instances with isolated persistence
- Rename flow works
- To-Do recurrence (daily/weekly/never) with configurable reset times
- Markdown rendering with XSS safety (DOMPurify)
- Resize on desktop, usable on mobile
- Survives reload and power cycle

## How to test manually

1. Start the app: `sudo docker compose up -d` (or use nginx directly)
2. Open `http://localhost:8033` in Chrome
3. Use DevTools for:
   - Console: check for JS errors
   - Application tab: inspect localStorage (`calvybots_*` keys), manifest, service worker
   - Network tab: verify cache headers, API calls
   - Responsive mode: test mobile layouts (375px, 768px breakpoints)

## QA verdict format

```markdown
**Scope:** [track name]
**Result:** Pass / Pass with notes / Blocked / Fail

**Findings:**
- [severity] [file:line] Expected: ... Actual: ...

**Sign-off recommendation:** [for Team Lead]
```

Update `team/qa-status.md` and `team/qa-complete-v4.md` ONLY when the user explicitly asks for repo updates.
