# Backend API completion note (v2)

## Files modified

- `n:\web_app\docker-compose.yml`
- `n:\web_app\nginx\default.conf`
- `n:\web_app\api\package.json`
- `n:\web_app\api\server.js`
- `n:\web_app\api\routes\README.md`
- `n:\web_app\data\schema.md`

## Files created

- `n:\web_app\team\backend-complete-v2.md`

## How to start

```bash
docker compose up -d
```

Both services (`web` and `api`) are managed in `docker-compose.yml` and start automatically.

## Architecture diagram

```text
User Browser
    |
    | HTTP
    v
 nginx (web :80 on host 8033)
    |-- serves static files from /usr/share/nginx/html
    |-- serves SPA fallback -> /index.html
    |
    +-- /api/* proxy -> Node service
            |
            v
    calvybots-api (container web_app_api)
            |
            +-- reads ../data/config.json
            +-- exposes /api/health, /api/system, /api/config
            +-- future route modules under api/routes/
```

## Frontend notes

- Browser calls should target relative API paths:
  - `fetch('/api/health')`
  - `fetch('/api/system')`
  - `fetch('/api/config')`
- This works because nginx proxies `/api/*` to `http://api:3000` and serves static assets from the same host for all non-API routes.
