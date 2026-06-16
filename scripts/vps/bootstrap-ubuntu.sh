#!/usr/bin/env bash
# Bootstrap Ubuntu VPS for Cornea EMR (Docker + Compose).
# Run as a user with sudo: bash scripts/vps/bootstrap-ubuntu.sh
set -euo pipefail

REPO="${CORNEA_REPO:-$HOME/cornea-emr}"
REPO_URL="${CORNEA_REPO_URL:-https://github.com/CorneaClinic/cornea-emr.git}"

echo "=== Cornea EMR VPS bootstrap ==="

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
  echo "Docker installed. You may need to log out and back in for group membership."
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin not found after Docker install."
  exit 1
fi

if [[ ! -d "$REPO/.git" ]]; then
  echo "Cloning $REPO_URL -> $REPO"
  git clone "$REPO_URL" "$REPO"
fi

cd "$REPO/infra"
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo ""
  echo "Created infra/.env — edit secrets before starting:"
  echo "  nano $REPO/infra/.env"
  echo ""
  echo "Required: POSTGRES_PASSWORD, JWT_SECRET, SECRETS_ENCRYPTION_KEY,"
  echo "  CORS_ORIGIN=https://corneaclinic.visionemr.net"
  echo "  APP_PUBLIC_URL=https://api.visionemr.net"
else
  echo "infra/.env already exists — skipping copy."
fi

echo ""
echo "Next steps:"
echo "  1. Edit $REPO/infra/.env"
echo "  2. cd $REPO/infra && docker compose -f docker-compose.prod.yml -f docker-compose.vps.yml up -d --build"
echo "  3. Restore DB or seed — see docs/VPS_DEPLOY.md"
echo "  4. bash $REPO/scripts/vps/setup-api-tunnel.sh api.visionemr.net"
