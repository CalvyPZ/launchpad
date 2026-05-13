# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

CalvyBots Launchpad is a **static-first** personal dashboard — no build step, no bundler, no TypeScript. See `.cursorrules` for the full architecture and constraints. Key hard rules: **no Python**, **no test frameworks**, **no npm install for the frontend**, **no README files** unless explicitly requested.

### Team structure

Five subagents are defined in `.cursor/agents/`. See `.cursor/rules/workflow-and-process.mdc` for invocation rules.

| Agent | File | Subagent type | Scope |
|-------|------|---------------|-------|
| Team Lead | `.cursor/agents/team-lead.md` | `team-lead` | Prioritisation, delegation, `team/` docs |
| Frontend Dev | `.cursor/agents/frontend-senior-dev.md` | `frontend-senior-dev` | UI, widgets, store, CSS, PWA frontend |
| Backend Dev | `.cursor/agents/backend-senior-dev.md` | `backend-senior-dev` | nginx, sw.js, manifest, MIME, `/api/` |
| QA | `.cursor/agents/qa-engineer.md` | `qa-engineer` | QA verdicts, checklists, sign-off |
| Cleanup | `.cursor/agents/senior-cleanup-engineer.md` | `senior-cleanup-engineer` | **Client-only** — never invoke autonomously |

### Production stack

The app runs on Docker Compose at port 8033, typically behind a Cloudflare tunnel on the production Ubuntu server.

| Service | Container | Image | Port |
|---------|-----------|-------|------|
| nginx (static + reverse proxy) | `web_app` | `nginx:alpine` | 8033→80 |
| API sidecar | `web_app_api` | `node:20-alpine` | 3000 (internal) |

### Starting the production Docker stack

```bash
# Ensure Docker daemon is running
sudo dockerd &>/dev/null &
sleep 3

# Symlink workspace to production volume path
sudo mkdir -p /mnt/data && sudo ln -sf /workspace /mnt/data/web_app

# Start
cd /workspace && sudo docker compose up -d

# Verify
sudo docker compose ps
curl -sf http://localhost:8033/
curl -sf http://localhost:8033/api/health
```

### Alternative: local nginx dev server (no Docker)

```bash
cd /workspace/api && PORT=3000 node server.js &
sudo nginx
# App at http://localhost:8033
```

Requires the update script to have run (sets up nginx config symlink and web root symlink).

### Gotchas

- **Static file changes are instant** — no restart needed for HTML/JS/CSS/JSON edits. Just refresh the browser.
- **Container restart only needed for**: `nginx-site.conf`, `docker-compose.yml`, or `api/server.js` changes.
- **The API sidecar is optional** — the frontend never calls `/api/` endpoints in current code. It's diagnostic-only.
- **CDN dependencies require internet** — Alpine.js, Tailwind Play CDN, marked, DOMPurify all load from CDN on first visit. Service worker caches same-origin assets for offline shell after first load.
- **All user data is in localStorage** (`calvybots_*` keys). No database. Clearing browser data resets the dashboard.
- **`nginx-site.local.conf`** has `root /usr/share/nginx/html` which the update script symlinks to `/workspace`. If nginx returns 403, verify: `ls -la /usr/share/nginx/html`.
- **Port conflict**: if both Docker and local nginx try port 8033, stop one first. `sudo docker compose down` or `sudo nginx -s stop`.
- **`/api/` must never be cached by the service worker** — this is a hard architectural rule.
- **No `npm install` for the frontend** — only the `api/` service has a `package.json`, and it has zero runtime dependencies.

### Skills

Workflow skills are in `.cursor/skills/`:
- `dev-environment.md` — starting/stopping/troubleshooting the dev environment
- `widget-development.md` — widget creation and modification workflow
- `deployment.md` — deployment to production
- `qa-testing.md` — QA validation workflows and checklist locations
- `git-workflow.md` — git conventions and branching

### Rules

- **Substantive work uses Cursor `Task` subagents** — see `.cursor/rules/chain-of-command.mdc`: the chat agent must not substitute prose handoffs for `Task` calls (`team-lead` first, then dev/QA `subagent_type`s as delegated).

Workspace rules are in `.cursor/rules/`:
- `architecture.mdc` — static-first constraints, module loading, widget contract, localStorage schema
- `visual-design.mdc` — cyan/dark palette tokens, component patterns, motion, accessibility
- `widget-development.mdc` — per-instance isolation, Markdown safety, recurrence model, resize
- `pwa-and-hosting.mdc` — service worker strategy, manifest rules, nginx config, security headers
- `workflow-and-process.mdc` — team coordination, delegation format, QA output format
