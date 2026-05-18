# Dutch Registries Dashboard

An in-browser dashboard for exploring Dutch base registries at multiple
administrative levels. Users drill down from province → municipality → wijk →
buurt; counts and feature geometries for BAG *pand*, *verblijfsobject*,
*ligplaats*, *standplaats*, *nummeraanduiding*, and address points are fetched
live from the PDOK BAG OGC API v2 and CBS gebiedsindelingen, then summarised
through interactive charts (Chart.js) and a MapLibre GL map. A FastAPI backend
caches CBS boundaries and pre-computed BAG *pand* summaries on disk so the
typical interaction does not hit PDOK at all. Originally built as a Geonovum
internship project at the University of Twente.

## Quick start

The supported deployment is `docker compose`. No seed data needed — the
`data/` directory is created and populated automatically on first use.

```bash
docker compose up --build
```

Open http://localhost:8000 (or your server's address on a remote host).
On first use, the backend lazily fetches and caches CBS boundaries and BAG
features from PDOK - each cold area takes 10-40 seconds. Subsequent requests
are served from the on-disk cache.

To pre-build the BAG pand summary store (recommended, otherwise building
counts show as zero until each area is visited individually):

```bash
docker exec dutch-registries-dashboard python -m Backend.cli.rebuild
```

For local development without Docker, see [Local development](#local-development).

## What's inside

| Layer     | Technology |
|-----------|-----------|
| Backend   | Python 3.12, FastAPI, httpx, Shapely, pyproj, ReportLab, matplotlib, Pillow |
| Frontend  | Vanilla JS (ES modules), MapLibre GL 4.7.1, Chart.js 4.4.0 (all self-hosted, no CDN) |
| Geo data  | PDOK CBS gebiedsindelingen, PDOK BAG OGC API v2 |
| Container | Docker (python:3.12-slim base) |

## Operating the dashboard

### Rebuilding the BAG pand summary store

A full rebuild walks every municipality in the Netherlands and asks PDOK for
each BAG *pand* count. It takes roughly an hour and writes to
`data/bag_data/bag_pand_summary_store.json`. There are two ways to trigger it.

**CLI (the recommended production path).** Runs the same function the HTTP
endpoint would, with no auth surface and no token in HTTP logs:

```bash
python -m Backend.cli.rebuild                       # all provinces
python -m Backend.cli.rebuild --province PV20       # single province
python -m Backend.cli.rebuild --no-resume           # ignore checkpoint
python -m Backend.cli.rebuild --retry-attempts 5
```

Inside a running container:

```bash
docker exec dutch-registries-dashboard \
    python -m Backend.cli.rebuild --province PV20
```

Exit codes: `0` success, `1` rebuild ran but did not complete cleanly,
`2` another rebuild is already in progress.

**HTTP (opt-in, dev only).** The route `POST /api/bag/pand/summary/rebuild`
returns `404 Not Found` by default. To enable it during local development:

```bash
GEONOVUM_ENABLE_REBUILD_ENDPOINT=1 uvicorn Backend.main:app --reload
```

The 404 is deliberate — without the env var the route is indistinguishable
from a nonexistent endpoint, which is the right shape for an operator-only
task.

### Refreshing the CBS boundary cache

CBS boundaries are pinned to a single year via `GEONOVUM_YEARCODE` (default
2025). To pick up a new year, change the env var and delete
`data/admin_data/`; the next request will repopulate it from PDOK.

## Local development

```bash
python -m venv .venv
.venv\Scripts\activate                  # Windows
# source .venv/bin/activate              # macOS / Linux

pip install -r Backend/requirements.txt
uvicorn Backend.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive API docs at http://localhost:8000/docs.

The frontend is served by the same FastAPI process at `/`. There is no
separate build step — files in `Frontend/` are served as-is, and the JS uses
native ES modules.

### Tests

```bash
cd Backend
python -m pytest tests -v
```

13 smoke tests run against a `TestClient`, using the on-disk admin cache
fixtures shipped under `data/admin_data/`. No live network access required.

## Architecture

```
                  ┌────────────────────────┐
   Browser ◀──────│ FastAPI (Backend/main) │──────▶ PDOK CBS + BAG OGC APIs
   (ES modules)   └─────────┬──────────────┘            (httpx, shared pool)
                            │
                  ┌─────────▼──────────┐
                  │ data/ on disk      │
                  │ • admin_data/      │  CBS boundaries (per year)
                  │ • bag_data/        │  BAG pand summary + feature cache
                  └────────────────────┘
```

Project layout:

```
Backend/
  cli/
    rebuild.py             CLI entry point for the rebuild task
  cache/
    bag_features.py        Per-wijk/buurt on-disk feature cache
    disk.py                Atomic write helpers
    memory.py              In-process TTL cache
  domain/
    admin.py               Province/municipality/wijk/buurt loading
    bag_summary.py         BAG pand summary store
    rebuild.py             Rebuild orchestration
    geometry.py            Spatial helpers (assignment + intersection)
    codes.py               Statcode/GMcode helpers + label cleanup
    report/                PDF report package
      strings.py             Translation table + theme + constants
      maps.py                Basemap + projection + tile-stitch
      charts.py              Matplotlib chart rendering
      pdf.py                 ReportLab document assembly
  pdok/
    client.py              Shared httpx client + retry logic
    urls.py                BAG / CBS endpoint constants
  config.py                Pydantic Settings
  logging_setup.py         Logging config (respects GEONOVUM_LOG_LEVEL)
  main.py                  FastAPI app + route handlers
  paths.py                 Filesystem path constants
  tests/
    test_smoke.py          13 backend smoke tests

Frontend/
  index.html
  app.js                   Main controller (boot, event wiring, BAG pipeline)
  js/                      ES modules (loaded via type="module")
    i18n.js                NL/EN translations + language switcher
    config.js              Constants (URLs, palettes, etc.)
    api.js                 HTTP client + auto-retry
    charts.js              Chart.js orchestration + expand modal
    popups.js              Popup HTML formatting (pure functions)
    reports.js             PDF report UI orchestration
    bagLayers.js           BAG map-source + style-layer infrastructure
    areaSelection.js       Province/municipality/wijk/buurt dropdown logic
    map.js                 MapLibre instance, basemap controls, boundary layers
    legend.js              Info box, boundary legend, BAG summary card
    uiState.js             Shared state containers (state, selectionState, etc.)
  vendor/                  Self-hosted libs (no CDN)
    maplibre-gl.{js,css}
    chart.umd.min.js
    topojson-client.min.js
    countries-50m.json
  Assets/
    GEONOVUM_LOGO.png
  styles.css

data/
  admin_data/              CBS boundary cache
  bag_data/                BAG summary store + feature cache

Dockerfile
docker-compose.yml
```

## Environment variables

All settings come from `Backend/config.py` (Pydantic Settings, `GEONOVUM_`
prefix, case-insensitive, comma-split for list types).

| Variable | Default | Purpose |
|---|---|---|
| `GEONOVUM_DATA_DIR` | `<repo>/data` | Where the runtime cache lives |
| `GEONOVUM_FRONTEND_DIR` | `<repo>/Frontend` | Where static frontend assets live |
| `GEONOVUM_LOG_LEVEL` | `INFO` | Logging verbosity |
| `GEONOVUM_CORS_ORIGINS` | (empty) | Comma-separated allowed origins for CORS. Default is closed — same-origin requests work without setting this. Set for cross-origin deployments, e.g. `https://dashboard.geonovum.nl,https://internal.geonovum.nl`. |
| `GEONOVUM_YEARCODE` | `2025` | CBS year code for boundary data |
| `GEONOVUM_SUMMARY_MAX_AGE_SECONDS` | `86400` | TTL for BAG summary freshness check |
| `GEONOVUM_PDOK_CBS_BASE` | `https://api.pdok.nl/cbs/gebiedsindelingen/ogc/v1` | PDOK CBS base URL |
| `GEONOVUM_PDOK_BAG_BASE` | `https://api.pdok.nl/kadaster/bag/ogc/v2` | PDOK BAG base URL |
| `GEONOVUM_ENABLE_REBUILD_ENDPOINT` | (unset / `false`) | Set to `1` to expose `POST /api/bag/pand/summary/rebuild` |
| `PORT` | `8000` | Server port (used inside Docker; threaded through `EXPOSE`, `HEALTHCHECK`, `CMD`) |

## Recent improvements

The codebase has been substantially refactored. The backend is split into
focused modules (`cache/`, `domain/`, `pdok/`, `report/`), the FastAPI app
uses a shared httpx connection pool with retry, and on-disk caches now
include version checks. API responses are gzip-compressed for ~5-10×
transfer reduction on dense GeoJSON. Spatial assignment of BAG features
to wijken/buurten now uses representative-point containment instead of
geometric intersection, which means each feature belongs to exactly one
area and counts add up correctly. The in-memory cache is now bounded
(500-entry LRU) with disk sweep at startup. The rebuild task is gated
behind a CLI module rather than a public HTTP route. Municipalities are
loaded per-province on demand instead of national-scale.

The frontend has been modularised: `app.js` is reduced from 1999 lines
to 982 lines (51% reduction), with seven new ES modules under
`Frontend/js/` (popups, reports, bagLayers, areaSelection, map, legend,
uiState) handling their respective concerns. All third-party libraries
(MapLibre, Chart.js, topojson-client, world atlas) are self-hosted — no
runtime CDN dependency.

See `git log` for the full chronology.

## Known limitations

- First request for an uncached province pulls the full national
  municipality collection from PDOK (sliced in Python) because the CBS
  `gemeente_niet_gegeneraliseerd` collection has no server-side province
  filter. Subsequent province requests are served from per-province
  on-disk cache. True server-side filtering is future work.
- The frontend fires `/api/bag/{layer}/summary` requests at province and
  municipality level even though those endpoints only return data at
  wijk and buurt level (returns 404 by design). Browser console will
  show 404s if BAG layers are toggled on at upper levels. No user-visible
  breakage; the BAG summary card stays empty at those levels. Minor
  frontend guard could suppress the requests.
