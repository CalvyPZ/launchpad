# Assignments — HTTPS reliability with Cloudflare Tunnel

**Date:** 2026-05-13  
**Track:** HTTPS availability and canonical scheme behavior

## Cycle status

- Backend Dev: implemented proxy header adjustments and validated local headers.
- Frontend Dev: audited frontend scheme behavior; no frontend-only URL rewrite bug found.
- QA: interactive closeout is blocked until the exact Cloudflare HTTPS hostname is provided.

## Backend Dev

### Scope

- Fix and validate HTTPS behavior for nginx + Cloudflare Tunnel.
- Ensure no scheme-forcing redirects to HTTP.
- Preserve PWA endpoints (`sw.js`, `manifest.json`, `/`) and keep `/api/` out of SW cache.

### Files to touch

- `nginx-site.conf`
- `sw.js`

### Acceptance bullets

- `curl -I https://<cloudflare-hostname>/` and `curl -I https://<cloudflare-hostname>/sw.js` show no redirect to `http://`.
- Frontend shell and SW assets return expected TLS headers and content metadata (content-type, cache-control, service-worker-allowed if applicable).
- Nginx includes at least `proxy_set_header X-Forwarded-Proto $scheme;` and `proxy_set_header X-Forwarded-Host $host;` under `/api/`.
- Cloudflare cache policy does not cache `/sw.js` / `/manifest.json` / `/index.html` as stale immutable assets.
- HTTPS request chain continues to serve static shell without mixed-content or insecure upgrade side effects.

### Definition of done

- `git diff` for config files shows only required changes for HTTPS canonicalization and cache safety.
- Backend confirms headers and API proxy forwarding behavior with command output snippets attached in task summary.

## Frontend Dev

### Scope

- Reproduce HTTPS failures in-browser against production Cloudflare HTTPS origin.
- Identify and fix any scheme-dependent frontend assumptions.

### Files to touch

- `index.html`
- `js/app.js`
- `js/store.js`
- `sw.js` (only if scheme-related registration logic needs adjustment)
- `manifest.json`

## Acceptance bullets

- HTTPS page load is stable at `https://...` and does not redirect to HTTP.
- `/sw.js`, `/manifest.json`, `/js/app.js`, `/api/widgets` load successfully under HTTPS with no mixed-content errors.
- Console/network logs show no forced absolute HTTP URLs from frontend runtime code.
- Widget load/save remains intact under HTTPS; widget and title data persists.
- `/api/widgets` is not cached by SW request behavior.

## Definition of done

- Frontend changes avoid absolute HTTP references and preserve installability behavior.
- Service worker registration succeeds on HTTPS origin and scope remains at `/`.
- Any required frontend fix is implemented with minimal scope and documented in `team/lead-status.md` updates.

## QA Engineer

### Scope

- Run interactive verification on the actual Cloudflare HTTPS hostname.
- Confirm no HTTP downgrade and no scheme-related runtime errors.

### Files to touch

- `team/qa-status.md` (if user explicitly asks repo update; otherwise report inline only)
- `team/qa-complete-v4.md` (same note on explicit request)

## Acceptance bullets

- Fresh profile visit remains on HTTPS for the full session.
- SW install/register status checked and `/api/widgets` not cached in SW behavior.
- Dashboard save/load flows and UI interactions work under HTTPS.
- Confirmed outcome recorded with findings or pass/fail recommendation for Team Lead.

## Cross-cycle handoff

- Frontend and Backend reports are required before final QA pass.
- QA must reference this assignment in its verdict.
- QA pass is blocked until production HTTPS hostname is confirmed.
