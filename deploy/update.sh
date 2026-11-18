#!/usr/bin/env bash
# Pull the latest code and rebuild/restart. Database migrations run automatically.
# Also use this after editing .env (e.g. adding SMTP / WhatsApp settings).
#   sudo deploy/update.sh
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
"$REPO_DIR/deploy/backup.sh" || echo "!! backup failed — continuing with the update"
GIT_LFS_SKIP_SMUDGE=1 git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
docker image prune -f >/dev/null
curl -fsS http://127.0.0.1:4000/health && echo && echo "Update complete."
