#!/usr/bin/env bash
# CalvyBots Launchpad — production deployment script
#
# Usage (from /mnt/data/web_app on the Ubuntu server):
#   ./deploy.sh           — pull latest, restart containers
#   ./deploy.sh --check   — health check only (no deploy)
#   ./deploy.sh --down    — stop and remove containers
#   ./deploy.sh --logs    — tail container logs
#
# Requirements: Docker, Docker Compose v2, git
# Production path: /mnt/data/web_app (matches docker-compose.yml volume mounts)

set -euo pipefail

COMPOSE="docker compose"
APP_PORT=8033
HEALTH_TIMEOUT=30  # seconds to wait for health check

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[deploy]${NC} $*"; }
ok()   { echo -e "${GREEN}[ok]${NC}    $*"; }
warn() { echo -e "${YELLOW}[warn]${NC}  $*"; }
fail() { echo -e "${RED}[fail]${NC}  $*" >&2; }

check_health() {
  local elapsed=0
  log "Waiting for app on port ${APP_PORT}..."
  while [ $elapsed -lt $HEALTH_TIMEOUT ]; do
    if curl -sf "http://localhost:${APP_PORT}/" -o /dev/null 2>/dev/null; then
      ok "App is responding on port ${APP_PORT}"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  fail "App did not respond on port ${APP_PORT} within ${HEALTH_TIMEOUT}s"
  return 1
}

check_api_health() {
  if curl -sf "http://localhost:${APP_PORT}/api/health" 2>/dev/null | grep -q '"ok"'; then
    ok "API /api/health is responding"
  else
    warn "API /api/health not responding (optional sidecar may still be starting)"
  fi
}

case "${1:-deploy}" in

  --check)
    log "Running health checks only..."
    check_health
    check_api_health
    ;;

  --down)
    log "Stopping containers..."
    $COMPOSE down
    ok "Containers stopped."
    ;;

  --logs)
    $COMPOSE logs -f --tail=100
    ;;

  deploy|"")
    log "=== CalvyBots Launchpad — Deploy ==="

    # Verify we are in the right directory
    if [ ! -f "docker-compose.yml" ] || [ ! -f "index.html" ]; then
      fail "Run this script from the repo root (expected docker-compose.yml and index.html)"
      exit 1
    fi

    # Pull latest from git
    log "Pulling latest changes from git..."
    git fetch origin
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    log "Current branch: ${BRANCH}"
    git pull origin "$BRANCH"
    ok "Git pull complete — $(git log -1 --format='%h %s')"

    # Pull any updated Docker images
    log "Pulling Docker images..."
    $COMPOSE pull --quiet

    # Restart containers (down + up to pick up volume/config changes)
    log "Restarting containers..."
    $COMPOSE down --remove-orphans
    $COMPOSE up -d

    ok "Containers started."
    $COMPOSE ps

    # Health check
    check_health
    check_api_health

    ok "=== Deploy complete ==="
    ;;

  *)
    fail "Unknown argument: $1"
    echo "Usage: $0 [--check | --down | --logs]"
    exit 1
    ;;

esac
