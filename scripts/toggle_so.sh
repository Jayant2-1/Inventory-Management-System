#!/usr/bin/env bash
# Toggle the presence of the compiled C++ extension in backend/
# Usage: ./scripts/toggle_so.sh enable|disable

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
SO_NAME="inventory_core.cpython-311-darwin.so"
SO_PATH="$BACKEND_DIR/$SO_NAME"
SO_BAK_PATH="$SO_PATH.bak"

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 enable|disable"
  exit 2
fi

case "$1" in
  enable)
    if [ -e "$SO_BAK_PATH" ]; then
      mv -f "$SO_BAK_PATH" "$SO_PATH"
      echo "Enabled compiled extension: $SO_PATH"
    else
      echo "No backup .so found at $SO_BAK_PATH. Nothing to enable."
    fi
    ;;
  disable)
    if [ -e "$SO_PATH" ]; then
      mv -f "$SO_PATH" "$SO_BAK_PATH"
      echo "Disabled compiled extension (moved to $SO_BAK_PATH)"
    else
      echo "Compiled extension not present. Nothing to disable."
    fi
    ;;
  *)
    echo "Usage: $0 enable|disable"
    exit 2
    ;;
esac
