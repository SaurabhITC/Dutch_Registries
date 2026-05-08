from __future__ import annotations

import asyncio
import json
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from Backend.config import settings
from Backend.logging_setup import get_logger
from Backend.domain import (
    cached_municipality_to_province_map,
    count_bag_pand_for_area,
    feature_matches_area_for_bag_object,
    get_area_feature,
    load_buurten_for_municipality,
    load_municipalities,
    load_provinces,
    load_wijken_for_municipality,
    bbox_from_feature,
    feature_intersects_area,
    wijk_body,
)
from Backend.domain.report import build_report_pdf
from Backend.paths import SUMMARY_FILE
from Backend.pdok import BAG_COLLECTION_URLS, BAG_PAND_URL, fetch_all_features

logger = get_logger(__name__)

APP_TITLE = "Geonovum Registry Dashboard Backend"
APP_VERSION = "0.1.0"

SUMMARY_MAX_AGE_SECONDS = settings.summary_max_age_seconds
SUMMARY_DATASET_KEY = "bag_pand"

FRONTEND_DIR = settings.frontend_dir
CORS_ORIGINS = settings.cors_origins

_bag_pand_summary_store: Optional[Dict[str, Any]] = None


def normalize_province_summary_entry(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        count = int(value.get("count") or 0)
        municipalities_raw = value.get("municipalities", {}) or {}
        status = str(value.get("status") or "complete").strip().lower() or "complete"
        updated_at = value.get("updated_at")
        completed_at = value.get("completed_at")
        failed_municipalities_raw = value.get("failed_municipalities", []) or []
    else:
        count = int(value or 0)
        municipalities_raw = {}
        status = "complete"
        updated_at = None
        completed_at = None
        failed_municipalities_raw = []

    municipalities: Dict[str, int] = {}
    if isinstance(municipalities_raw, dict):
        for gm_statcode, municipality_count in municipalities_raw.items():
            municipalities[str(gm_statcode).strip().upper()] = int(municipality_count or 0)

    failed_municipalities: List[Dict[str, Any]] = []
    if isinstance(failed_municipalities_raw, list):
        for item in failed_municipalities_raw:
            if not isinstance(item, dict):
                continue
            failed_municipalities.append(
                {
                    "statcode": str(item.get("statcode", "")).strip().upper(),
                    "name": str(item.get("name", "")).strip(),
                    "error": str(item.get("error", "")).strip(),
                }
            )

    return {
        "count": count,
        "municipalities": municipalities,
        "status": status,
        "updated_at": updated_at,
        "completed_at": completed_at,
        "failed_municipalities": failed_municipalities,
    }


def empty_summary_dataset(*, source: str) -> Dict[str, Any]:
    return {
        "created_at": None,
        "source": source,
        "provinces": {},
    }


def empty_bag_pand_summary_store() -> Dict[str, Any]:
    return {
        "version": 2,
        "datasets": {
            SUMMARY_DATASET_KEY: empty_summary_dataset(
                source="bag_pand_precomputed_summary"
            )
        },
    }


def normalize_summary_store(data: Any) -> Dict[str, Any]:
    if not isinstance(data, dict):
        data = empty_bag_pand_summary_store()

    # Migrate the legacy flat BAG-pand-only store into the new multi-dataset structure.
    if "datasets" not in data:
        legacy_dataset = empty_summary_dataset(source="bag_pand_precomputed_summary")
        legacy_dataset["created_at"] = data.get("created_at")
        legacy_dataset["source"] = data.get(
            "source", "bag_pand_precomputed_summary"
        )
        legacy_dataset["municipalities"] = dict(data.get("municipalities", {}) or {})
        legacy_dataset["provinces"] = dict(data.get("provinces", {}) or {})

        data = {
            "version": 2,
            "datasets": {
                SUMMARY_DATASET_KEY: legacy_dataset,
            },
        }

    data["version"] = 2

    datasets = data.get("datasets")
    if not isinstance(datasets, dict):
        datasets = {}
        data["datasets"] = datasets

    gm_to_pv = cached_municipality_to_province_map()
    normalized_datasets: Dict[str, Dict[str, Any]] = {}

    for dataset_key, dataset_value in datasets.items():
        dataset = dataset_value if isinstance(dataset_value, dict) else {}
        provinces_raw = dataset.get("provinces", {}) or {}
        legacy_municipalities_raw = dataset.get("municipalities", {}) or {}

        normalized_provinces: Dict[str, Dict[str, Any]] = {}
        if isinstance(provinces_raw, dict):
            for province_statcode, province_value in provinces_raw.items():
                normalized_provinces[str(province_statcode).strip().upper()] = (
                    normalize_province_summary_entry(province_value)
                )

        if isinstance(legacy_municipalities_raw, dict):
            for municipality_statcode, municipality_count in legacy_municipalities_raw.items():
                gm_statcode = str(municipality_statcode).strip().upper()
                province_statcode = gm_to_pv.get(gm_statcode, "__UNASSIGNED__")

                province_entry = normalized_provinces.setdefault(
                    province_statcode,
                    normalize_province_summary_entry({"count": 0, "municipalities": {}}),
                )
                province_entry["municipalities"][gm_statcode] = int(municipality_count or 0)

        normalized_datasets[str(dataset_key)] = {
            "created_at": dataset.get("created_at"),
            "source": dataset.get("source") or f"{dataset_key}_precomputed_summary",
            "provinces": normalized_provinces,
        }

    if SUMMARY_DATASET_KEY not in normalized_datasets:
        normalized_datasets[SUMMARY_DATASET_KEY] = empty_summary_dataset(
            source="bag_pand_precomputed_summary"
        )

    data["datasets"] = normalized_datasets
    return data


def get_summary_dataset(
    data: Optional[Dict[str, Any]],
    dataset_key: str,
) -> Dict[str, Any]:
    normalized = normalize_summary_store(data or empty_bag_pand_summary_store())
    dataset = normalized["datasets"].get(dataset_key)
    if not isinstance(dataset, dict):
        dataset = empty_summary_dataset(source=f"{dataset_key}_precomputed_summary")
        normalized["datasets"][dataset_key] = dataset
    return dataset


def get_dataset_province_count(
    dataset: Dict[str, Any],
    province_statcode: str,
) -> Optional[int]:
    province_entry = (dataset.get("provinces", {}) or {}).get(province_statcode)
    if not isinstance(province_entry, dict):
        return None
    count = province_entry.get("count")
    return int(count) if count is not None else None


def get_dataset_municipality_count(
    dataset: Dict[str, Any],
    municipality_statcode: str,
) -> Optional[int]:
    provinces = dataset.get("provinces", {}) or {}
    for province_entry in provinces.values():
        if not isinstance(province_entry, dict):
            continue

        municipality_counts = province_entry.get("municipalities", {}) or {}
        if municipality_statcode in municipality_counts:
            return int(municipality_counts[municipality_statcode])

    return None


def get_or_create_dataset_province_entry(
    dataset: Dict[str, Any],
    province_statcode: str,
) -> Dict[str, Any]:
    provinces = dataset.setdefault("provinces", {})
    province_key = str(province_statcode or "").strip().upper()
    province_entry = normalize_province_summary_entry(provinces.get(province_key, {}))
    provinces[province_key] = province_entry
    return province_entry


def recompute_dataset_province_entry_count(province_entry: Dict[str, Any]) -> int:
    municipality_counts = province_entry.get("municipalities", {}) or {}
    province_entry["count"] = int(sum(int(v or 0) for v in municipality_counts.values()))
    province_entry["updated_at"] = time.time()
    return int(province_entry["count"])


def summarize_failed_municipalities(
    failed_items: List[Dict[str, Any]],
    province_statcode: str,
) -> List[Dict[str, Any]]:
    province_key = str(province_statcode or "").strip().upper()
    summarized: List[Dict[str, Any]] = []

    for item in failed_items:
        if not isinstance(item, dict):
            continue
        if str(item.get("province_statcode", "")).strip().upper() != province_key:
            continue

        summarized.append(
            {
                "statcode": str(item.get("statcode", "")).strip().upper(),
                "name": str(item.get("name", "")).strip(),
                "error": str(item.get("error", "")).strip(),
            }
        )

    summarized.sort(key=lambda item: item.get("statcode", ""))
    return summarized


def save_bag_pand_summary_dataset_checkpoint(
    store: Dict[str, Any],
    dataset: Dict[str, Any],
) -> Dict[str, Any]:
    dataset["created_at"] = time.time()
    dataset["source"] = "bag_pand_precomputed_summary"
    store.setdefault("datasets", {})[SUMMARY_DATASET_KEY] = dataset
    save_bag_pand_summary_store(store)
    return dataset


def load_bag_pand_summary_store() -> Dict[str, Any]:
    global _bag_pand_summary_store

    if not SUMMARY_FILE.exists():
        _bag_pand_summary_store = empty_bag_pand_summary_store()
        return _bag_pand_summary_store

    try:
        with SUMMARY_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)

        _bag_pand_summary_store = normalize_summary_store(data)
        return _bag_pand_summary_store

    except Exception as e:
        logger.error("failed to load summary file: %s", e)
        _bag_pand_summary_store = empty_bag_pand_summary_store()
        return _bag_pand_summary_store


def save_bag_pand_summary_store(data: Dict[str, Any]) -> Dict[str, Any]:
    global _bag_pand_summary_store

    SUMMARY_FILE.parent.mkdir(parents=True, exist_ok=True)
    normalized = normalize_summary_store(data)

    with SUMMARY_FILE.open("w", encoding="utf-8") as f:
        json.dump(normalized, f, ensure_ascii=False, indent=2)

    _bag_pand_summary_store = normalized
    return _bag_pand_summary_store


def is_bag_pand_summary_store_fresh(data: Optional[Dict[str, Any]]) -> bool:
    dataset = get_summary_dataset(data, SUMMARY_DATASET_KEY)

    created_at = dataset.get("created_at")
    if not created_at:
        return False

    age = time.time() - created_at
    return age < SUMMARY_MAX_AGE_SECONDS


async def build_bag_pand_summary_store(
    province_statcode: Optional[str] = None,
    *,
    resume: bool = True,
    municipality_retry_attempts: int = 2,
    retry_failed_municipalities: bool = True,
) -> Dict[str, Any]:
    gemeenten = await load_municipalities()
    store = load_bag_pand_summary_store()
    dataset = get_summary_dataset(store, SUMMARY_DATASET_KEY)

    only_province = str(province_statcode or "").strip().upper()
    affected_municipalities: Dict[str, int] = {}
    affected_provinces: Dict[str, int] = {}
    failed_municipalities_first_pass: List[Dict[str, Any]] = []
    failed_municipalities_final: List[Dict[str, Any]] = []
    skipped_municipalities: List[str] = []
    touched_provinces: set[str] = set()
    municipality_features: List[Dict[str, Any]] = []
    municipality_total_by_province: Dict[str, int] = {}

    for feature in gemeenten["features"]:
        props = feature.get("properties", {}) or {}
        municipality_statcode = str(props.get("_statcode", "")).strip().upper()
        pv_statcode = str(props.get("_pvstatcode", "")).strip().upper()

        if not municipality_statcode.startswith("GM"):
            continue
        if only_province and pv_statcode != only_province:
            continue
        if not pv_statcode:
            continue

        municipality_features.append(feature)
        municipality_total_by_province[pv_statcode] = municipality_total_by_province.get(pv_statcode, 0) + 1

    municipality_features.sort(
        key=lambda feature: (
            str(feature.get("properties", {}).get("_pvstatcode", "")).strip().upper(),
            str(feature.get("properties", {}).get("_statnaam", "")).strip().lower(),
            str(feature.get("properties", {}).get("_statcode", "")).strip().upper(),
        )
    )

    async def try_count_municipality(municipality_statcode: str) -> int:
        last_error: Optional[Exception] = None
        for attempt in range(1, max(1, municipality_retry_attempts) + 1):
            try:
                logger.info(
                    "municipality=%s attempt=%d/%d",
                    municipality_statcode,
                    attempt,
                    max(1, municipality_retry_attempts),
                )
                return await count_bag_pand_for_area("municipality", municipality_statcode)
            except Exception as exc:  # pragma: no cover - defensive logging path
                last_error = exc
                logger.warning(
                    "municipality=%s failed on attempt %d/%d: %s",
                    municipality_statcode,
                    attempt,
                    max(1, municipality_retry_attempts),
                    exc,
                )
                if attempt < max(1, municipality_retry_attempts):
                    await asyncio.sleep(1.5 * attempt)

        assert last_error is not None
        raise last_error

    async def process_municipality(feature: Dict[str, Any], *, second_pass: bool = False) -> bool:
        props = feature.get("properties", {}) or {}
        municipality_statcode = str(props.get("_statcode", "")).strip().upper()
        municipality_name = str(props.get("_statnaam", municipality_statcode)).strip()
        pv_statcode = str(props.get("_pvstatcode", "")).strip().upper()

        if not municipality_statcode.startswith("GM") or not pv_statcode:
            return False

        province_entry = get_or_create_dataset_province_entry(dataset, pv_statcode)
        touched_provinces.add(pv_statcode)

        if resume and not second_pass and municipality_statcode in (province_entry.get("municipalities", {}) or {}):
            skipped_municipalities.append(municipality_statcode)
            logger.info(
                "province=%s municipality=%s name=%s skipped_existing=true",
                pv_statcode,
                municipality_statcode,
                municipality_name,
            )
            return True

        logger.info(
            "province=%s municipality=%s name=%s second_pass=%s status=start",
            pv_statcode,
            municipality_statcode,
            municipality_name,
            str(second_pass).lower(),
        )

        try:
            count = await try_count_municipality(municipality_statcode)
        except Exception as exc:
            failure = {
                "province_statcode": pv_statcode,
                "statcode": municipality_statcode,
                "name": municipality_name,
                "error": str(exc),
            }
            if second_pass:
                failed_municipalities_final.append(failure)
            else:
                failed_municipalities_first_pass.append(failure)
            logger.warning(
                "province=%s municipality=%s name=%s second_pass=%s status=failed",
                pv_statcode,
                municipality_statcode,
                municipality_name,
                str(second_pass).lower(),
            )
            return False

        province_entry["municipalities"][municipality_statcode] = int(count)
        province_entry["status"] = "partial"
        province_entry["completed_at"] = None
        province_entry["failed_municipalities"] = [
            item
            for item in (province_entry.get("failed_municipalities", []) or [])
            if str(item.get("statcode", "")).strip().upper() != municipality_statcode
        ]
        recompute_dataset_province_entry_count(province_entry)
        save_bag_pand_summary_dataset_checkpoint(store, dataset)

        affected_municipalities[municipality_statcode] = int(count)
        affected_provinces[pv_statcode] = int(province_entry["count"])

        logger.info(
            "province=%s municipality=%s name=%s count=%d status=done",
            pv_statcode,
            municipality_statcode,
            municipality_name,
            count,
        )
        return True

    for feature in municipality_features:
        await process_municipality(feature, second_pass=False)

    if retry_failed_municipalities and failed_municipalities_first_pass:
        retry_features_by_statcode = {
            str(feature.get("properties", {}).get("_statcode", "")).strip().upper(): feature
            for feature in municipality_features
        }
        to_retry = list(failed_municipalities_first_pass)
        failed_municipalities_first_pass = []

        for failure in to_retry:
            municipality_statcode = str(failure.get("statcode", "")).strip().upper()
            feature = retry_features_by_statcode.get(municipality_statcode)
            if feature is None:
                failed_municipalities_final.append(failure)
                continue
            await process_municipality(feature, second_pass=True)
    else:
        failed_municipalities_final.extend(failed_municipalities_first_pass)
        failed_municipalities_first_pass = []

    finalized_provinces = [only_province] if only_province else sorted(touched_provinces)

    for pv_statcode in finalized_provinces:
        if not pv_statcode:
            continue

        province_entry = get_or_create_dataset_province_entry(dataset, pv_statcode)
        recompute_dataset_province_entry_count(province_entry)

        expected_municipality_count = municipality_total_by_province.get(pv_statcode, 0)
        completed_municipality_count = len(province_entry.get("municipalities", {}) or {})
        failed_for_province = summarize_failed_municipalities(
            failed_municipalities_final,
            pv_statcode,
        )
        province_entry["failed_municipalities"] = failed_for_province

        if expected_municipality_count and completed_municipality_count >= expected_municipality_count and not failed_for_province:
            province_entry["status"] = "complete"
            province_entry["completed_at"] = time.time()
        else:
            province_entry["status"] = "partial"
            province_entry["completed_at"] = None

        province_entry["updated_at"] = time.time()
        affected_provinces[pv_statcode] = int(province_entry["count"])

    save_bag_pand_summary_dataset_checkpoint(store, dataset)

    return {
        "store": store,
        "dataset": dataset,
        "affected_municipalities": affected_municipalities,
        "affected_provinces": affected_provinces,
        "failed_municipalities": failed_municipalities_final,
        "skipped_municipalities": skipped_municipalities,
        "status": "complete" if not failed_municipalities_final else "partial",
    }


async def ensure_bag_pand_summary_store() -> Dict[str, Any]:
    store = load_bag_pand_summary_store()
    return get_summary_dataset(store, SUMMARY_DATASET_KEY)


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_bag_pand_summary_store()
    yield


app = FastAPI(title=APP_TITLE, version=APP_VERSION, lifespan=lifespan)

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
    data = await load_municipalities()
    features = data["features"]

    if province_statcode:
        features = [
            f for f in features
            if f.get("properties", {}).get("_pvstatcode") == province_statcode
        ]

    return {"type": "FeatureCollection", "features": features}


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
    area_feature = await get_area_feature(level, statcode)
    bbox = bbox_from_feature(area_feature)
    url = f"{BAG_PAND_URL}&bbox={bbox}"

    raw_fc = await fetch_all_features(url, ttl_seconds=15 * 60)
    filtered_features = [
        f for f in raw_fc.get("features", []) or []
        if feature_intersects_area(f, area_feature)
    ]

    return {
        "type": "FeatureCollection",
        "features": filtered_features,
    }


@app.get("/api/bag/{object_type}")
async def get_bag_object(
    object_type: str,
    level: str = Query(...),
    statcode: str = Query(...),
) -> Dict[str, Any]:
    object_type_norm = str(object_type or "").strip().lower()

    if object_type_norm not in BAG_COLLECTION_URLS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported BAG object type: {object_type}",
        )

    area_feature = await get_area_feature(level, statcode)
    bbox = bbox_from_feature(area_feature)
    url = f"{BAG_COLLECTION_URLS[object_type_norm]}&bbox={bbox}"

    raw_fc = await fetch_all_features(url, ttl_seconds=15 * 60)
    filtered_features = [
        f for f in raw_fc.get("features", []) or []
        if feature_matches_area_for_bag_object(f, area_feature, object_type_norm)
    ]

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
