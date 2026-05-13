# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

CalvyBots Launchpad is a **static-first** personal dashboard (no build step, no bundler, no TypeScript). See `.cursorrules` for full architecture and constraints. Key rules: **no Python**, **no test frameworks**, **no npm install for the frontend**.

### Services

| Service | Command | Port | Notes |
|---------|---------|------|-------|
| **nginx** (static server) | `sudo nginx` (stop: `sudo nginx -s stop`) | 8033 | Serves all static files from `/workspace`; proxies `/api/` to port 3000. Uses config linked at `/etc/nginx/sites-enabled/launchpad.conf` → `/workspace/nginx-site.local.conf`. The nginx `root` is symlinked: `/usr/share/nginx/html` → `/workspace`. |
| **API sidecar** | `cd /workspace/api && node server.js` | 3000 | Zero npm dependencies. Provides `GET /api/health`, `/api/system`, `/api/config`. Optional — frontend works without it. |

### Starting the dev environment

1. Start the API sidecar: `cd /workspace/api && PORT=3000 node server.js &`
2. Start nginx: `sudo nginx`
3. Open `http://localhost:8033` in Chrome.

### Gotchas

- The `nginx-site.local.conf` has `root /usr/share/nginx/html` which is symlinked to `/workspace` during setup. If nginx returns 403/404, verify the symlink: `ls -la /usr/share/nginx/html`.
- The default nginx site config at `/etc/nginx/sites-enabled/default` must be removed so it does not conflict with port 80. The launchpad config listens on port 8033.
- The API sidecar reads `/workspace/data/config.json` (one directory up from `api/`). If you get 500 errors on `/api/config`, confirm the file exists.
- Static file changes (HTML, JS, CSS) are picked up immediately by nginx — no restart needed, just refresh the browser.
- CDN dependencies (Alpine.js, Tailwind Play CDN, marked, DOMPurify) require internet on first load. The service worker caches same-origin assets for offline use after the first visit.
- All user data is stored in `localStorage` (no database). Clearing browser data resets the dashboard.
