# Dutch Registries Dashboard

An in-browser dashboard for exploring Dutch base registries (BAG, BGT, BRO) at
multiple administrative levels. Users can drill down from province → municipality
→ wijk → buurt, with live counts fetched from the PDOK CBS gebiedsindelingen and
BAG OGC API endpoints. Pre-computed BAG *pand* summaries are cached on disk and
served by the FastAPI backend to avoid repeated heavyweight API calls.

## Tech stack

| Layer    | Technology |
|----------|-----------|
| Backend  | Python 3.12, FastAPI, httpx, Shapely |
| Frontend | Vanilla JS, MapLibre GL JS |
| Geo data | PDOK CBS OGC API, PDOK BAG OGC API v2 |

## Project structure

```
Backend/     FastAPI application (main.py) and smoke tests
Frontend/    Static dashboard (HTML/JS/CSS, MapLibre GL)
data/        Runtime cache — admin boundary JSON + BAG pand summary store
```

## Local development

### Backend

```bash
# Create and activate a virtual environment
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install fastapi uvicorn httpx shapely

# Start the API server (from repo root)
uvicorn Backend.main:app --reload --host 0.0.0.0 --port 8000
```

The server starts at `http://localhost:8000`. Interactive docs are at
`http://localhost:8000/docs`.

### Frontend

Open `Frontend/index.html` directly in a browser, or serve the folder with any
static HTTP server:

```bash
# Python built-in server (from repo root)
python -m http.server 5500 --directory Frontend
```

Then visit `http://localhost:5500`.

### GEONOVUM_DATA_DIR

The backend resolves its runtime cache directory from the environment variable
`GEONOVUM_DATA_DIR`. If unset it defaults to `<repo root>/data/`.

```bash
# Override example (Docker / Azure)
export GEONOVUM_DATA_DIR=/mnt/geonovum-data
```

The directory must contain `admin_data/` and `bag_data/` sub-directories
populated by a first run of the admin-cache and summary-rebuild endpoints.

## Data refresh

To rebuild the BAG *pand* summary store (all provinces, ~7 million records):

```
POST http://localhost:8000/api/bag/pand/summary/rebuild
```

This is a long-running background job. Progress is logged to stdout. The result
is written to `data/bag_data/bag_pand_summary_store.json`.

## Tests

```bash
cd Backend
python -m pytest tests -v
```

All 7 smoke tests run against a local TestClient with mocked external calls; no
live network access required.

## Status

**In-progress prototype.** The application is functional for local exploration
but is being prepared for containerised deployment on Docker / Azure. APIs,
directory layout, and environment-variable names may change before the first
release.
