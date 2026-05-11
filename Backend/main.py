from __future__ import annotations

import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from Backend.cache import (
    load_bag_features_from_cache,
    save_bag_features_to_cache,
)
from Backend.config import settings
from Backend.logging_setup import get_logger
from Backend.domain import (
    count_bag_pand_for_area,
    feature_matches_area_for_bag_object,
    get_area_feature,
    load_buurten_for_municipality,
    load_municipalities,
    load_municipalities_for_province,
    load_provinces,
    load_wijken_for_municipality,
    bbox_from_feature,
    feature_assigned_to_area,
    wijk_body,
)
from Backend.domain.bag_summary import (
    ensure_bag_pand_summary_store,
    get_dataset_municipality_count,
    get_dataset_province_count,
    load_bag_pand_summary_store,
)
from Backend.domain.rebuild import _rebuild_lock, build_bag_pand_summary_store
from Backend.domain.report import build_report_pdf
from Backend.pdok import (
    BAG_COLLECTION_URLS,
    BAG_PAND_URL,
    fetch_all_features,
    shutdown_http_client,
    startup_http_client,
)

logger = get_logger(__name__)

APP_TITLE = "Geonovum Registry Dashboard Backend"
APP_VERSION = "0.1.0"

FRONTEND_DIR = settings.frontend_dir
CORS_ORIGINS = settings.cors_origins


@asynccontextmanager
async def lifespan(app: FastAPI):
    await startup_http_client()
    load_bag_pand_summary_store()
    try:
        yield
    finally:
        await shutdown_http_client()


app = FastAPI(title=APP_TITLE, version=APP_VERSION, lifespan=lifespan)

app.add_middleware(GZipMiddleware, minimum_size=1024, compresslevel=6)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "service": APP_TITLE, "version": APP_VERSION}


@app.get("/api/areas/provinces")
async def get_provinces() -> Dict[str, Any]:
    return await load_provinces()


@app.get("/api/areas/municipalities")
async def get_municipalities(
    province_statcode: Optional[str] = Query(default=None)
) -> Dict[str, Any]:
    if province_statcode:
        pv_statcode = province_statcode.strip().upper()
        return await load_municipalities_for_province(pv_statcode)

    return await load_municipalities()


@app.get("/api/areas/wijken")
async def get_wijken(
    municipality_gmcode: Optional[str] = Query(default=None)
) -> Dict[str, Any]:
    if not municipality_gmcode:
        raise HTTPException(
            status_code=400,
            detail="municipality_gmcode is required for wijk requests",
        )

    return await load_wijken_for_municipality(municipality_gmcode)


@app.get("/api/areas/buurten")
async def get_buurten(
    municipality_gmcode: Optional[str] = Query(default=None),
    wijk_statcode: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    if not municipality_gmcode:
        raise HTTPException(
            status_code=400,
            detail="municipality_gmcode is required for buurt requests",
        )

    data = await load_buurten_for_municipality(municipality_gmcode)
    features = data["features"]

    if wijk_statcode:
        body = wijk_body(wijk_statcode)
        if not body:
            return {"type": "FeatureCollection", "features": []}

        features = [
            f for f in features
            if str(f.get("properties", {}).get("_statcode", "")).upper().startswith(f"BU{body}")
        ]

    return {"type": "FeatureCollection", "features": features}


@app.get("/api/bag/pand/summary")

async def get_bag_pand_summary(
    level: str = Query(...),
    statcode: str = Query(...),
) -> Dict[str, Any]:
    level_norm = (level or "").strip().lower()
    statcode_norm = (statcode or "").strip().upper()

    if level_norm in {"municipality", "province"}:
        dataset = await ensure_bag_pand_summary_store()

        if level_norm == "municipality":
            count = get_dataset_municipality_count(dataset, statcode_norm)
        else:
            count = get_dataset_province_count(dataset, statcode_norm)

        if count is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"No precomputed BAG pand summary found for "
                    f"level={level_norm}, statcode={statcode_norm}"
                ),
            )

        return {
            "level": level_norm,
            "statcode": statcode_norm,
            "count": int(count),
        }

    count = await count_bag_pand_for_area(level_norm, statcode_norm)
    return {
        "level": level_norm,
        "statcode": statcode_norm,
        "count": count,
    }


@app.post("/api/bag/pand/summary/rebuild")
async def rebuild_bag_pand_summary(
    province_statcode: Optional[str] = Query(default=None),
    resume: bool = Query(default=True),
    municipality_retry_attempts: int = Query(default=2, ge=1, le=10),
    retry_failed_municipalities: bool = Query(default=True),
) -> Dict[str, Any]:
    if not settings.enable_rebuild_endpoint:
        raise HTTPException(status_code=404, detail="Not Found")

    if _rebuild_lock.locked():
        raise HTTPException(
            status_code=409,
            detail="A BAG pand summary rebuild is already in progress.",
        )

    async with _rebuild_lock:
        result = await build_bag_pand_summary_store(
            province_statcode=province_statcode,
            resume=resume,
            municipality_retry_attempts=municipality_retry_attempts,
            retry_failed_municipalities=retry_failed_municipalities,
        )

    return {
        "ok": result.get("status") == "complete",
        "status": result.get("status"),
        "created_at": result["dataset"].get("created_at"),
        "municipality_count": len(result.get("affected_municipalities", {})),
        "province_count": len(result.get("affected_provinces", {})),
        "failed_municipality_count": len(result.get("failed_municipalities", [])),
        "failed_municipalities": result.get("failed_municipalities", []),
        "skipped_municipality_count": len(result.get("skipped_municipalities", [])),
    }


@app.get("/api/bag/pand")
async def get_bag_pand(
    level: str = Query(...),
    statcode: str = Query(...),
) -> Dict[str, Any]:
    level_norm = (level or "").strip().lower()
    statcode_norm = (statcode or "").strip().upper()

    cached = load_bag_features_from_cache("pand", level_norm, statcode_norm)
    if cached is not None:
        return cached

    area_feature = await get_area_feature(level_norm, statcode_norm)
    bbox = bbox_from_feature(area_feature)
    url = f"{BAG_PAND_URL}&bbox={bbox}"

    raw_fc = await fetch_all_features(url, ttl_seconds=15 * 60)
    filtered_features = [
        f for f in raw_fc.get("features", []) or []
        if feature_assigned_to_area(f, area_feature)
    ]

    result = {
        "type": "FeatureCollection",
        "features": filtered_features,
    }

    save_bag_features_to_cache("pand", level_norm, statcode_norm, result)
    return result


@app.get("/api/bag/{object_type}")
async def get_bag_object(
    object_type: str,
    level: str = Query(...),
    statcode: str = Query(...),
) -> Dict[str, Any]:
    object_type_norm = str(object_type or "").strip().lower()
    level_norm = (level or "").strip().lower()
    statcode_norm = (statcode or "").strip().upper()

    if object_type_norm not in BAG_COLLECTION_URLS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported BAG object type: {object_type}",
        )

    cached = load_bag_features_from_cache(object_type_norm, level_norm, statcode_norm)
    if cached is not None:
        cached_features = cached.get("features", []) or []
        return {
            "type": "FeatureCollection",
            "features": cached_features,
            "count": len(cached_features),
            "object_type": object_type_norm,
            "level": level,
            "statcode": statcode,
        }

    area_feature = await get_area_feature(level_norm, statcode_norm)
    bbox = bbox_from_feature(area_feature)
    url = f"{BAG_COLLECTION_URLS[object_type_norm]}&bbox={bbox}"

    raw_fc = await fetch_all_features(url, ttl_seconds=15 * 60)
    filtered_features = [
        f for f in raw_fc.get("features", []) or []
        if feature_matches_area_for_bag_object(f, area_feature, object_type_norm)
    ]

    result = {
        "type": "FeatureCollection",
        "features": filtered_features,
    }
    save_bag_features_to_cache(object_type_norm, level_norm, statcode_norm, result)

    return {
        "type": "FeatureCollection",
        "features": filtered_features,
        "count": len(filtered_features),
        "object_type": object_type_norm,
        "level": level,
        "statcode": statcode,
    }


class ReportRequest(BaseModel):
    area_type: str = Field(..., description="'wijk' or 'buurt'")
    area_id: str
    area_name: str
    parent_municipality: str = ""
    parent_province: str = ""
    layers: List[str] = Field(default_factory=list)
    language: str = "nl"
    bbox: List[float] = Field(default_factory=list)


def _safe_filename(name: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in name.strip())
    return cleaned or "report"


@app.post("/api/report/generate")
async def generate_report(payload: ReportRequest) -> Response:
    area_type = payload.area_type.strip().lower()
    if area_type not in {"wijk", "buurt"}:
        raise HTTPException(status_code=400, detail="area_type must be 'wijk' or 'buurt'")
    if not payload.area_id.strip():
        raise HTTPException(status_code=400, detail="area_id is required")

    try:
        pdf_bytes = await build_report_pdf(
            area_type=area_type,
            area_id=payload.area_id.strip().upper(),
            area_name=payload.area_name or payload.area_id,
            parent_municipality=payload.parent_municipality,
            parent_province=payload.parent_province,
            layers=list(payload.layers or []),
            language=payload.language or "nl",
            bbox=list(payload.bbox or []),
        )
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive logging path
        logger.exception("report generation failed: %s", exc)
        raise HTTPException(status_code=500, detail=f"Report generation failed: {exc}")

    safe_name = _safe_filename(payload.area_name or payload.area_id)
    date_str = time.strftime("%Y%m%d")
    filename = f"{safe_name}_{date_str}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


app.mount("/Assets", StaticFiles(directory=str(FRONTEND_DIR / "Assets")), name="assets")
app.mount("/vendor", StaticFiles(directory=str(FRONTEND_DIR / "vendor")), name="vendor")


@app.get("/")
async def serve_index() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/{path:path}")
async def serve_frontend(path: str) -> FileResponse:
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")
    file_path = FRONTEND_DIR / path
    if file_path.is_file():
        return FileResponse(file_path)
    return FileResponse(FRONTEND_DIR / "index.html")
