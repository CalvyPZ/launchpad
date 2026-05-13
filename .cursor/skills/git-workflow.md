# Skill: Git Workflow

Use this skill for git operations, branch management, and understanding the project's git conventions.

## Branch conventions

- `main` — production branch, deployed via `deploy.sh`
- `cursor/*` — agent-created feature branches
- No PR required for internal dev sprints (see `team/brief.md` §8)

## Standard workflow

```bash
# Check current state
git status
git branch -a

# Create feature branch
git checkout -b cursor/feature-name

# Make changes, then commit
git add -A
git commit -m "short description of change"

# Push
git push -u origin cursor/feature-name
```

## Deploying to production

On the Ubuntu server:
```bash
cd /mnt/data/web_app
git pull origin main
# Static files are picked up immediately by nginx volume mount
# Only restart containers if nginx-site.conf or docker-compose.yml changed
```

Or use the deploy script:
```bash
./deploy.sh
```

## Important notes

- This is a static-first project — no build step means git changes are immediately live once pulled
- The `deploy.sh` script handles: git pull → docker compose restart → health check
- `docker-compose.yml` mounts the repo root as the nginx web root (read-only)
- File changes in JS/CSS/HTML are immediately served by nginx without container restart
