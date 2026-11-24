#!/bin/sh
# Container start script used by Railway (one image, two services).
#   PF_ROLE=worker -> reminder engine (scheduler + dispatcher), health check on $PORT
#   otherwise      -> apply DB migrations, then the HTTP API on $PORT
set -e
if [ "$PF_ROLE" = "worker" ]; then
  WORKER_HEALTH_PORT="${PORT:-8080}" exec node dist/worker-entry.js
fi
/repo/node_modules/.bin/prisma migrate deploy
exec node dist/server.js
