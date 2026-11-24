#!/bin/sh
# Container start script used by Railway (one image).
#   PF_ROLE=worker -> reminder engine only (scheduler + dispatcher), health check on $PORT
#   PF_ROLE=all    -> API + reminder engine in ONE service (fits Railway's free plan,
#                     which caps the number of services); the worker is restarted if
#                     it ever exits
#   otherwise      -> API only (pair with a separate PF_ROLE=worker service)
# The API path always applies DB migrations first.
set -e
if [ "$PF_ROLE" = "worker" ]; then
  WORKER_HEALTH_PORT="${PORT:-8080}" exec node dist/worker-entry.js
fi
/repo/node_modules/.bin/prisma migrate deploy
if [ "$PF_ROLE" = "all" ]; then
  (while true; do node dist/worker-entry.js; echo "worker exited ($?) - restarting in 5s"; sleep 5; done) &
fi
exec node dist/server.js
