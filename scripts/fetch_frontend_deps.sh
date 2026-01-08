#!/usr/bin/env bash
# Fetch frontend vendor files (Bootstrap CSS/JS and Chart.js) into frontend/vendor
# Usage: ./scripts/fetch_frontend_deps.sh

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT/frontend/vendor"
mkdir -p "$VENDOR_DIR"

echo "Fetching Bootstrap and Chart.js into $VENDOR_DIR"

BOOT_CSS_URL="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"
BOOT_JS_URL="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"
CHART_URL="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"

cd "$VENDOR_DIR"
curl -fsSL "$BOOT_CSS_URL" -o bootstrap.min.css
curl -fsSL "$BOOT_JS_URL" -o bootstrap.bundle.min.js
curl -fsSL "$CHART_URL" -o chart.umd.min.js

echo "Fetched files:"
ls -la "$VENDOR_DIR"

echo "To use local vendor files, edit frontend/index.html to point to vendor/ files or use the provided script to prefer local files."
