#!/usr/bin/env bash
# Daily backup: database dump + uploaded files, kept for 14 days.
# Scheduled by setup-server.sh (cron 02:30). Run manually any time:  sudo deploy/backup.sh
#
# Restore (on the same or a new server, after setup-server.sh):
#   gunzip -c /var/backups/projectflow/db-YYYYmmdd-HHMM.sql.gz | \
#     docker compose -f docker-compose.prod.yml exec -T postgres psql -U projectflow -d projectflow
#   docker run --rm -v projectflow_api_storage:/data -v /var/backups/projectflow:/b alpine \
#     sh -c "cd /data && tar xzf /b/files-YYYYmmdd-HHMM.tar.gz"
set -euo pipefail
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"
# Read only what's needed — .env isn't valid shell (e.g. SMTP_FROM=Name <addr>).
env_get() { grep -E "^$1=" .env | head -n1 | cut -d= -f2-; }
POSTGRES_USER=$(env_get POSTGRES_USER)
POSTGRES_DB=$(env_get POSTGRES_DB)

DEST=/var/backups/projectflow
STAMP=$(date +%Y%m%d-%H%M)
mkdir -p "$DEST"

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists | gzip > "$DEST/db-$STAMP.sql.gz"

docker run --rm -v projectflow_api_storage:/data:ro -v "$DEST":/b alpine \
  tar czf "/b/files-$STAMP.tar.gz" -C /data .

find "$DEST" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: db-$STAMP.sql.gz files-$STAMP.tar.gz"
