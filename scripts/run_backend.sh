#!/usr/bin/env bash
# Run the backend using either the Python shim or the compiled .so
# Usage: ./scripts/run_backend.sh shim|so

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 shim|so"
  exit 2
fi

MODE="$1"

if [ ! -f "venv/bin/activate" ]; then
  echo "Virtualenv not found. Create one with: python3.11 -m venv venv"
  exit 1
fi

source venv/bin/activate

case "$MODE" in
  shim)
    ./scripts/toggle_so.sh disable || true
    echo "Starting backend with Python shim..."
    python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
    ;;
  so)
    ./scripts/toggle_so.sh enable || true
    echo "Starting backend with compiled .so (if enabled)..."
    python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
    ;;
  *)
    echo "Unknown mode: $MODE"
    exit 2
    ;;
esac
