# Skill: Development Environment Setup & Operation

Use this skill when starting the development environment, debugging service issues, or when an agent needs to verify the app is running correctly.

## Production stack (Docker Compose)

The canonical production environment runs via Docker Compose on port 8033.

### Start

```bash
# Ensure Docker is running
sudo dockerd &>/dev/null &
sleep 3

# Symlink workspace to production path (idempotent)
sudo mkdir -p /mnt/data && sudo ln -sf /workspace /mnt/data/web_app

# Start containers
cd /workspace && sudo docker compose up -d
```

### Verify

```bash
# Check containers are running
sudo docker compose ps

# Test frontend
curl -sf http://localhost:8033/ | head -5

# Test API health
curl -sf http://localhost:8033/api/health

# Test manifest MIME type (should be application/manifest+json)
curl -sI http://localhost:8033/manifest.json | grep Content-Type

# Test service worker (should have no-cache headers)
curl -sI http://localhost:8033/sw.js | grep Cache-Control
```

### Stop / restart

```bash
cd /workspace && sudo docker compose down
cd /workspace && sudo docker compose restart
```

### View logs

```bash
sudo docker compose logs -f --tail=100
sudo docker compose logs api --tail=50
sudo docker compose logs web --tail=50
```

## Local dev (without Docker)

For quick iteration without Docker, use nginx + Node directly:

```bash
# Start API sidecar (optional — frontend works without it)
cd /workspace/api && PORT=3000 node server.js &

# Start nginx (already configured via update script)
sudo nginx
```

The nginx config at `/etc/nginx/sites-enabled/launchpad.conf` symlinks to `/workspace/nginx-site.local.conf`. The nginx root `/usr/share/nginx/html` symlinks to `/workspace`.

### Static file changes

No restart needed — edit HTML/JS/CSS and refresh the browser. Nginx serves files directly from the workspace.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port 8033 already in use | `sudo docker compose down` or `sudo nginx -s stop` depending on which is running |
| Docker daemon not running | `sudo dockerd &>/dev/null &` then wait 3s |
| nginx 403/404 | Verify symlink: `ls -la /usr/share/nginx/html` should point to `/workspace` |
| API 502 Bad Gateway via nginx | API sidecar not running. Start it: `cd /workspace/api && node server.js` |
| manifest.json wrong MIME | Check nginx config has the `application/manifest+json` block |
