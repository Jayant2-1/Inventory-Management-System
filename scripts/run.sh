#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
VENV_DIR="${BACKEND_DIR}/venv"

cd "${BACKEND_DIR}"

# Informational check for the C++ extension (not fatal thanks to Python fallback)
if ! ls inventory_core*.so >/dev/null 2>&1; then
    echo "Note: compiled inventory_core shared library not found in backend/. The Python fallback implementation will be used."
fi

# Ensure the project root is importable so the shared inventory_core module is discovered
export PYTHONPATH="${PROJECT_ROOT}:${PYTHONPATH:-}"

if [ ! -f "requirements.txt" ]; then
    echo "Error: requirements.txt not found in ${BACKEND_DIR}"
    exit 1
fi

# Choose Python interpreter (prefer python3.11, fallback to python3)
if command -v python3.11 >/dev/null 2>&1; then
    PYTHON_BIN="python3.11"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="python3"
else
    echo "Error: python3.11 or python3 is required but not found on PATH."
    exit 1
fi

# Create the virtual environment if needed
if [ ! -d "${VENV_DIR}" ]; then
    echo "Creating Python virtual environment at ${VENV_DIR}..."
    "${PYTHON_BIN}" -m venv "${VENV_DIR}"
fi

source "${VENV_DIR}/bin/activate"

echo "Installing/updating backend dependencies..."
python -m pip install --upgrade pip wheel >/dev/null
python -m pip install -r requirements.txt

echo "Starting high-performance inventory server..."
echo "API available at: http://127.0.0.1:8000"
echo "Health check: curl http://127.0.0.1:8000/health"
echo "Press Ctrl+C to stop the server"

exec python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000