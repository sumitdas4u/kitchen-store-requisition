#!/usr/bin/env bash
# ── Dev startup ─────────────────────────────────────────────────────────────
# Postgres + Redis in Docker, backend + frontend run locally for speed.
#
# Usage:
#   ./dev.sh          Start everything
#   ./dev.sh down     Tear down containers
#   ./dev.sh reset    Tear down + wipe volumes (fresh start)
#   ./dev.sh logs     Follow container logs
#   ./dev.sh docker   Run everything in Docker (slower on Windows)

set -euo pipefail
COMPOSE="docker compose -f docker-compose.dev.yml"

case "${1:-up}" in
  up)
    echo "Starting dev stack (Postgres + Redis in Docker, apps locally)…"
    echo ""
    echo "   Backend  → http://localhost:3001"
    echo "   Frontend → http://localhost:3000"
    echo ""
    npm run dev
    ;;
  down)
    echo "Stopping infrastructure containers…"
    $COMPOSE down
    ;;
  reset)
    echo "Tearing down containers + wiping volumes…"
    $COMPOSE down -v
    echo "Clean slate. Run ./dev.sh to start fresh."
    ;;
  logs)
    $COMPOSE logs -f
    ;;
  docker)
    echo "Starting full Docker stack (all services in Docker)…"
    $COMPOSE up --build
    ;;
  *)
    echo "Usage: ./dev.sh [up|down|reset|logs|docker]"
    exit 1
    ;;
esac
