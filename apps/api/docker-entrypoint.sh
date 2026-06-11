#!/bin/sh
set -e
echo "[entrypoint] Running database migrations..."
node src/db/migrate-cli.js
echo "[entrypoint] Starting API (NODE_ENV=${NODE_ENV:-production})..."
exec node src/index.js
