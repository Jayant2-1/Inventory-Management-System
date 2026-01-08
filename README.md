# Inventory Management System

A full-stack inventory tracking system featuring a FastAPI backend, an optional high-performance C++/pybind11 core, and a responsive dashboard powered by vanilla JavaScript, Bootstrap, and Chart.js.

## Features

- **FastAPI backend** with async endpoints for CRUD operations, analytics, and inventory insights.
- **Dual inventory core**: pure Python implementation for portability plus an optional C++ extension for speed.
- **Interactive frontend dashboard** with live charts, search, filtering, and low-stock alerts.
- **Scriptable tooling** for building the extension, running the API, and fetching frontend vendor assets.
- **Comprehensive tests** covering the core logic, REST API, and async service layer.

## Architecture

- **Backend** – FastAPI + Pydantic + Uvicorn (`backend/main.py`).
- **Inventory core** – `inventory_core.py` (Python) with an optional pybind11 C++ build.
- **Frontend** – Vanilla JS dashboard styled with Bootstrap 5 and Chart.js.
- **Tooling** – Bash scripts, CMake build files, and pytest-based automation.

```text
repository/
├── backend/            # FastAPI app, tests, dependency manifests
├── core/               # C++ sources (BST) and CMake project
├── frontend/           # Browser UI and vendor assets
├── scripts/            # Helper scripts for build/run tasks
├── inventory_core.py   # Shared pure-Python inventory engine
└── hardware_inventory_10000.csv  # Sample dataset (10k records)
```

## Prerequisites

- Python 3.11+
- pip / venv (or your preferred virtual environment manager)
- CMake + a C++17 toolchain (optional, only for building the extension)

## Quickstart

### 1. Clone and set up the backend

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
./scripts/run.sh
```

The API starts on <http://127.0.0.1:8000>. Interactive docs are available at `/docs` (Swagger) and `/redoc`.

### 2. Launch the frontend dashboard

In a separate terminal:

```bash
cd frontend
python3 -m http.server 8080
```

Open <http://localhost:8080> to explore the UI. The frontend consumes the backend API running on port 8000.

### 3. Seed demo data (optional)

```bash
curl -X POST http://127.0.0.1:8000/admin/seed -H "Content-Type: application/json" -d '{"target": 100}'
```

## Running tests

Install development dependencies and execute the pytest suite:

```bash
source .venv/bin/activate
pip install -r backend/requirements-dev.txt
pytest backend
```

## Building the C++ extension (optional)

On macOS/Linux with a working C++ toolchain:

```bash
./scripts/build.sh
```

The resulting shared library is copied into `backend/` as `inventory_core*.so`. The runtime automatically prefers the compiled module when it imports cleanly; otherwise, it falls back to the Python implementation.

## Useful scripts

- `scripts/run.sh` – Creates/activates a local venv, installs backend dependencies, and launches Uvicorn with auto-reload.
- `scripts/build.sh` – Configures and builds the C++ extension via CMake, copying the artifact into `backend/`.
- `scripts/build_direct.sh` – Alternate build flow that links directly without CMake (handy for debugging).
- `scripts/fetch_frontend_deps.sh` – Downloads or refreshes the vendored frontend libraries.
- `scripts/toggle_so.sh` – Enables or disables the compiled extension by renaming the shared library.

## Data

- `hardware_inventory_10000.csv` contains a synthetic hardware catalogue used for load testing and demos.
- `backend/sample.csv` is a compact sample leveraged by automated tests and onboarding snippets.

## Contributing

1. Fork the repository and create a feature branch.
2. Run the full test suite (`pytest backend`).
3. Submit a pull request with a clear description and tests for new behaviour.

Feel free to open issues for enhancements or bug reports—contributions are welcome!
# Inventory-Management-System-ACBT-
