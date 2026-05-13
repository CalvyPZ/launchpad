# Skill: Deployment Workflow

Use this skill when deploying changes, verifying production readiness, or troubleshooting the Docker/nginx/Cloudflare stack.

## Architecture

```
User → Cloudflare Tunnel → Ubuntu Server (port 8033) → nginx container → static files
                                                      → /api/ → Node.js API container (port 3000)
```

## Production deployment (on the Ubuntu server)

```bash
cd /mnt/data/web_app
./deploy.sh
```

This runs: `git pull` → `docker compose pull` → `docker compose down` → `docker compose up -d` → health checks.

### Deploy script options

```bash
./deploy.sh            # Full deploy (pull + restart)
./deploy.sh --check    # Health check only
./deploy.sh --down     # Stop containers
./deploy.sh --logs     # Tail container logs
```

## Docker Compose services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `web` | `nginx:alpine` | 8033:80 | Static file server + API reverse proxy |
| `api` | `node:20-alpine` | 3000 (internal) | Health/system/config endpoints |

## Post-deploy verification

```bash
# Frontend loads
curl -sf http://localhost:8033/ | head -3

# API responds
curl -sf http://localhost:8033/api/health

# Manifest correct MIME
curl -sI http://localhost:8033/manifest.json | grep Content-Type

# SW no-cache
curl -sI http://localhost:8033/sw.js | grep Cache-Control

# Container health
docker compose ps
docker compose logs --tail=20
```

## File change workflow

Since this is static-first with no build step:

1. Edit files directly in the repo
2. `git add . && git commit -m "description" && git push`
3. On server: `./deploy.sh` (or `git pull` if containers don't need restart)
4. Static file changes are picked up immediately (nginx serves from mounted volume)
5. Changes to `nginx-site.conf` or `docker-compose.yml` require `docker compose restart web`

## When containers DO need restart

- `nginx-site.conf` changed
- `docker-compose.yml` changed
- `api/server.js` changed (API sidecar)

## When containers do NOT need restart

- HTML, CSS, JS, manifest.json, sw.js, icons, data/*.json — all served directly from mounted volume
