#!/usr/bin/env bash
# Restore a pg_dump custom-format backup into the Docker Postgres container.
#
# Usage:
#   bash scripts/vps/restore-backup-on-vps.sh /path/to/backup.dump
#
# Run from repo root on the VPS after: docker compose -f docker-compose.prod.yml up -d

set -euo pipefail

DUMP="${1:-}"
if [[ -z "$DUMP" || ! -f "$DUMP" ]]; then
  echo "Usage: $0 /path/to/backup.dump"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../.." && pwd)"
INFRA="$REPO/infra"

cd "$INFRA"
COMPOSE=(docker compose -f docker-compose.prod.yml)

echo "=== Restore database from $DUMP ==="
echo "This replaces all data in cornea_emr_v1."

read -r -p "Continue? [y/N] " ans
if [[ "${ans,,}" != "y" ]]; then
  echo "Aborted."
  exit 0
fi

"${COMPOSE[@]}" up -d postgres
echo "Waiting for Postgres..."
for i in $(seq 1 30); do
  if "${COMPOSE[@]}" exec -T postgres pg_isready -U cornea -d cornea_emr_v1 >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "Terminating connections and dropping database..."
"${COMPOSE[@]}" exec -T postgres psql -U cornea -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'cornea_emr_v1' AND pid <> pg_backend_pid();" \
  >/dev/null 2>&1 || true
"${COMPOSE[@]}" exec -T postgres psql -U cornea -d postgres -c "DROP DATABASE IF EXISTS cornea_emr_v1;"
"${COMPOSE[@]}" exec -T postgres psql -U cornea -d postgres -c "CREATE DATABASE cornea_emr_v1 OWNER cornea;"

echo "Restoring..."
docker cp "$DUMP" cornea-emr-db:/tmp/restore.dump
"${COMPOSE[@]}" exec -T postgres pg_restore -U cornea -d cornea_emr_v1 --no-owner --no-acl /tmp/restore.dump
"${COMPOSE[@]}" exec -T postgres rm -f /tmp/restore.dump

echo "Restarting API..."
"${COMPOSE[@]}" up -d api

echo "Done. Verify: curl -s http://127.0.0.1:3000/health/ready"
