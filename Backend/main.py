from __future__ import annotations

import asyncio
import json
import re
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from shapely.geometry import shape

# Allow `from config import ...` whether main is loaded as `main` (tests insert
# Backend/ into sys.path) or as `Backend.main` (uvicorn from repo root).
_BACKEND_DIR = str(Path(__file__).resolve().parent)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from config import settings
from logging_setup import get_logger
from cache import cache_get, cache_set
from pdok import (
    BAG_COLLECTION_URLS,
    BAG_PAND_URL,
    BUURT_URL,
    GEMEENTE_URL,
    PROVINCIE_URL,
    WIJK_URL,
    fetch_all_features,
    fetch_json,
)

logger = get_logger(__name__)

APP_TITLE = "Geonovum Registry Dashboard Backend"
APP_VERSION = "0.1.0"
YEARCODE = settings.yearcode

SUMMARY_MAX_AGE_SECONDS = settings.summary_max_age_seconds
SUMMARY_DATASET_KEY = "bag_pand"

ADMIN_CACHE_VERSION = 1

RUNTIME_DATA_DIR = settings.data_dir
FRONTEND_DIR = settings.frontend_dir
CORS_ORIGINS = settings.cors_origins

ADMIN_CACHE_DIR = RUNTIME_DATA_DIR / "admin_data"
ADMIN_PROVINCES_FILE = ADMIN_CACHE_DIR / "provinces.json"
ADMIN_MUNICIPALITIES_FILE = ADMIN_CACHE_DIR / "municipalities.json"
ADMIN_MUNICIPALITY_PROVINCE_MAP_FILE = ADMIN_CACHE_DIR / "municipality_to_province.json"
ADMIN_WIJKEN_DIR = ADMIN_CACHE_DIR / "wijken"
ADMIN_BUURTEN_DIR = ADMIN_CACHE_DIR / "buurten"

BAG_DATA_DIR = RUNTIME_DATA_DIR / "bag_data"
SUMMARY_FILE = BAG_DATA_DIR / "bag_pand_summary_store.json"

for p in [
    RUNTIME_DATA_DIR,
    ADMIN_CACHE_DIR,
    ADMIN_WIJKEN_DIR,
    ADMIN_BUURTEN_DIR,
    BAG_DATA_DIR,
]:
    p.mkdir(parents=True, exist_ok=True)

_bag_pand_summary_store: Optional[Dict[str, Any]] = None


def get_cached_admin_data() -> Optional[Dict[str, Any]]:
    cached = cache_get("admin_data_v3")
    return cached if isinstance(cached, dict) else None


def cached_municipality_to_province_map() -> Dict[str, str]:
    mapping: Dict[str, str] = {}

    file_mapping = load_municipality_to_province_map_file()
    if file_mapping:
        return file_mapping

    municipality_cache = cache_get("admin_municipalities_v1")
    if isinstance(municipality_cache, dict):
        for feature in municipality_cache.get("features", []) or []:
            props = feature.get("properties", {}) or {}
            gm_statcode = str(props.get("_statcode", "")).strip().upper()
            pv_statcode = str(props.get("_pvstatcode", "")).strip().upper()

            if gm_statcode.startswith("GM") and pv_statcode.startswith("PV"):
                mapping[gm_statcode] = pv_statcode

    if mapping:
        return mapping

    admin_data = get_cached_admin_data() or {}
    for feature in admin_data.get("gemeenten", {}).get("features", []) or []:
        props = feature.get("properties", {}) or {}
        gm_statcode = str(props.get("_statcode", "")).strip().upper()
        pv_statcode = str(props.get("_pvstatcode", "")).strip().upper()

        if gm_statcode.startswith("GM") and pv_statcode.startswith("PV"):
            mapping[gm_statcode] = pv_statcode

    return mapping


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


def empty_feature_collection() -> Dict[str, Any]:
    return {"type": "FeatureCollection", "features": []}


def wrap_admin_cache_payload(
    fc: Dict[str, Any],
    *,
    level: str,
    parent_gmcode: Optional[str] = None,
    parent_statcode: Optional[str] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "cache_version": ADMIN_CACHE_VERSION,
        "level": level,
        "yearcode": YEARCODE,
        "source": "cbs_gebiedsindelingen",
        "saved_at": time.time(),
        "type": "FeatureCollection",
        "features": list(fc.get("features", []) or []),
    }

    if parent_gmcode:
        payload["parent_gmcode"] = str(parent_gmcode).strip()
    if parent_statcode:
        payload["parent_statcode"] = str(parent_statcode).strip().upper()

    return payload


def normalize_admin_cache_payload(
    data: Any,
    *,
    expected_level: str,
    expected_parent_gmcode: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not isinstance(data, dict):
        return None

    if int(data.get("cache_version") or 0) != ADMIN_CACHE_VERSION:
        return None

    if str(data.get("level") or "").strip().lower() != expected_level:
        return None

    if int(data.get("yearcode") or 0) != YEARCODE:
        return None

    if expected_parent_gmcode is not None:
        stored_parent = str(data.get("parent_gmcode") or "").strip()
        if stored_parent != str(expected_parent_gmcode).strip():
            return None

    features = data.get("features", []) or []
    if not isinstance(features, list):
        return None

    return {"type": "FeatureCollection", "features": features}


def load_admin_cache_file(
    path: Path,
    *,
    expected_level: str,
    expected_parent_gmcode: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None

    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        logger.error("failed to read %s: %s", path, e)
        return None

    fc = normalize_admin_cache_payload(
        data,
        expected_level=expected_level,
        expected_parent_gmcode=expected_parent_gmcode,
    )
    if fc is None:
        return None

    return fc


def save_admin_cache_file(
    path: Path,
    fc: Dict[str, Any],
    *,
    level: str,
    parent_gmcode: Optional[str] = None,
    parent_statcode: Optional[str] = None,
) -> Dict[str, Any]:
    path.parent.mkdir(parents=True, exist_ok=True)

    payload = wrap_admin_cache_payload(
        fc,
        level=level,
        parent_gmcode=parent_gmcode,
        parent_statcode=parent_statcode,
    )

    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    return fc


def pretty_name(props: Dict[str, Any]) -> str:
    return str(props.get("statnaam") or props.get("naam") or props.get("name") or "")


def pretty_statcode(props: Dict[str, Any]) -> str:
    return str(props.get("statcode") or props.get("code") or "")


def normalize_gmcode(value: Any) -> str:
    s = str(value or "").strip().upper()
    if not s:
        return ""
    m = re.search(r"(\d{4})", s)
    return m.group(1) if m else ""


def municipality_code_from_statcode(statcode: str) -> str:
    statcode = (statcode or "").strip().upper()
    if len(statcode) >= 6 and statcode[:2] in {"GM", "WK", "BU"}:
        return statcode[2:6]
    return ""


def extract_municipality_code(props: Dict[str, Any], statcode: str, kind: str) -> str:
    preferred_keys = [
        "gm_code",
        "gmcode",
        "gemeentecode",
        "gemeentecode",
        "gemeentecodegm",
        "gem_code",
        "gemcode",
        "municipality_code",
        "municipalitycode",
        "gemeente_id",
        "gm_id",
    ]
    for key in preferred_keys:
        if key in props:
            code = normalize_gmcode(props.get(key))
            if code:
                return code

    for key, value in props.items():
        k = str(key).lower()
        if "gemeente" in k or k.startswith("gm"):
            code = normalize_gmcode(value)
            if code:
                return code

    # Final fallback
    return municipality_code_from_statcode(statcode)


def wijk_body(statcode: str) -> str:
    statcode = (statcode or "").strip().upper()
    if statcode.startswith("WK"):
        return statcode[2:]
    return ""


def preprocess_features(fc: Dict[str, Any], kind: str) -> Dict[str, Any]:
    out = {"type": "FeatureCollection", "features": []}
    for feature in fc.get("features", []) or []:
        props = dict(feature.get("properties") or {})
        statcode = pretty_statcode(props)

        props["_kind"] = kind
        props["_statcode"] = statcode
        props["_statnaam"] = pretty_name(props)
        props["_gmcode"] = extract_municipality_code(props, statcode, kind)
        props["_wijkbody"] = wijk_body(statcode)

        f2 = dict(feature)
        f2["properties"] = props
        out["features"].append(f2)
    return out


def load_municipality_to_province_map_file() -> Dict[str, str]:
    if not ADMIN_MUNICIPALITY_PROVINCE_MAP_FILE.exists():
        return {}

    try:
        with ADMIN_MUNICIPALITY_PROVINCE_MAP_FILE.open("r", encoding="utf-8") as f:
            raw = json.load(f)
    except Exception as e:
        logger.error("failed to read municipality_to_province map: %s", e)
        return {}

    if not isinstance(raw, dict):
        return {}

    mapping: Dict[str, str] = {}
    for gm_statcode, pv_statcode in raw.items():
        gm = str(gm_statcode).strip().upper()
        pv = str(pv_statcode).strip().upper()
        if gm.startswith("GM") and pv.startswith("PV"):
            mapping[gm] = pv

    return mapping


def save_municipality_to_province_map_file(mapping: Dict[str, str]) -> Dict[str, str]:
    ADMIN_MUNICIPALITY_PROVINCE_MAP_FILE.parent.mkdir(parents=True, exist_ok=True)

    cleaned: Dict[str, str] = {}
    for gm_statcode, pv_statcode in mapping.items():
        gm = str(gm_statcode).strip().upper()
        pv = str(pv_statcode).strip().upper()
        if gm.startswith("GM") and pv.startswith("PV"):
            cleaned[gm] = pv

    with ADMIN_MUNICIPALITY_PROVINCE_MAP_FILE.open("w", encoding="utf-8") as f:
        json.dump(dict(sorted(cleaned.items())), f, ensure_ascii=False, indent=2)

    return cleaned


def find_best_province_statcode_for_municipality(
    municipality_feature: Dict[str, Any],
    province_features: List[Dict[str, Any]],
) -> str:
    try:
        municipality_geom = shape(municipality_feature["geometry"])
    except Exception:
        return ""

    best_pv = ""
    best_overlap_area = 0.0

    for province_feature in province_features:
        try:
            province_geom = shape(province_feature["geometry"])
            overlap_area = municipality_geom.intersection(province_geom).area
        except Exception:
            continue

        if overlap_area > best_overlap_area:
            best_overlap_area = overlap_area
            best_pv = str(
                province_feature.get("properties", {}).get("_statcode", "")
            ).strip().upper()

    if best_pv:
        return best_pv

    try:
        probe = municipality_geom.representative_point()
        for province_feature in province_features:
            province_geom = shape(province_feature["geometry"])
            if province_geom.contains(probe) or province_geom.intersects(probe):
                return str(
                    province_feature.get("properties", {}).get("_statcode", "")
                ).strip().upper()
    except Exception:
        return ""

    return ""


async def load_municipality_to_province_map() -> Dict[str, str]:
    cache_key = "municipality_to_province_map_v1"
    cached = cache_get(cache_key)
    if isinstance(cached, dict) and cached:
        return cached

    disk_cached = load_municipality_to_province_map_file()
    if disk_cached:
        cache_set(cache_key, disk_cached, 24 * 3600)
        return disk_cached

    provincies = await load_provinces()
    gemeente_raw = await fetch_all_features(GEMEENTE_URL, ttl_seconds=24 * 3600)
    gemeenten = preprocess_features(gemeente_raw, "gemeente")

    mapping: Dict[str, str] = {}

    for feature in gemeenten.get("features", []) or []:
        props = feature.get("properties", {}) or {}
        gm_statcode = str(props.get("_statcode", "")).strip().upper()
        if not gm_statcode.startswith("GM"):
            continue

        pv_statcode = find_best_province_statcode_for_municipality(
            feature,
            provincies["features"],
        )
        if pv_statcode.startswith("PV"):
            mapping[gm_statcode] = pv_statcode

    mapping = save_municipality_to_province_map_file(mapping)
    cache_set(cache_key, mapping, 24 * 3600)
    return mapping


def municipality_to_province_map_from_features(
    gemeenten: Dict[str, Any],
) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for feature in gemeenten.get("features", []) or []:
        props = feature.get("properties", {}) or {}
        gm_statcode = str(props.get("_statcode", "")).strip().upper()
        pv_statcode = str(props.get("_pvstatcode", "")).strip().upper()

        if gm_statcode.startswith("GM") and pv_statcode.startswith("PV"):
            mapping[gm_statcode] = pv_statcode

    return mapping


async def load_provinces() -> Dict[str, Any]:
    cache_key = "admin_provinces_v1"
    cached = cache_get(cache_key)
    if isinstance(cached, dict):
        return cached

    disk_cached = load_admin_cache_file(
        ADMIN_PROVINCES_FILE,
        expected_level="province",
    )
    if isinstance(disk_cached, dict):
        cache_set(cache_key, disk_cached, 24 * 3600)
        return disk_cached

    provincie_raw = await fetch_all_features(PROVINCIE_URL, ttl_seconds=24 * 3600)
    provincies = preprocess_features(provincie_raw, "provincie")

    save_admin_cache_file(
        ADMIN_PROVINCES_FILE,
        provincies,
        level="province",
    )
    cache_set(cache_key, provincies, 24 * 3600)
    return provincies


async def load_municipalities() -> Dict[str, Any]:
    cache_key = "admin_municipalities_v1"
    cached = cache_get(cache_key)
    if isinstance(cached, dict):
        return cached

    disk_cached = load_admin_cache_file(
        ADMIN_MUNICIPALITIES_FILE,
        expected_level="municipality",
    )
    if isinstance(disk_cached, dict):
        cache_set(cache_key, disk_cached, 24 * 3600)
        return disk_cached

    gm_to_pv = await load_municipality_to_province_map()

    gemeente_raw = await fetch_all_features(GEMEENTE_URL, ttl_seconds=24 * 3600)
    gemeenten = preprocess_features(gemeente_raw, "gemeente")

    for feature in gemeenten["features"]:
        props = feature.get("properties", {}) or {}
        gm_statcode = str(props.get("_statcode", "")).strip().upper()

        if not gm_statcode.startswith("GM"):
            continue

        props["_pvstatcode"] = gm_to_pv.get(gm_statcode, "")

    save_admin_cache_file(
        ADMIN_MUNICIPALITIES_FILE,
        gemeenten,
        level="municipality",
    )
    cache_set(cache_key, gemeenten, 24 * 3600)
    return gemeenten


def gm_statcode_from_gmcode(value: Any) -> str:
    gmcode = normalize_gmcode(value)
    return f"GM{gmcode}" if gmcode else ""


async def load_wijken_for_municipality(municipality_gmcode: str) -> Dict[str, Any]:
    gmcode = normalize_gmcode(municipality_gmcode)
    if not gmcode:
        return empty_feature_collection()

    cache_key = f"admin_wijken_by_gm_v1::{gmcode}"
    cached = cache_get(cache_key)
    if isinstance(cached, dict):
        return cached

    disk_path = ADMIN_WIJKEN_DIR / f"{gmcode}.json"
    disk_cached = load_admin_cache_file(
        disk_path,
        expected_level="wijk",
        expected_parent_gmcode=gmcode,
    )
    if isinstance(disk_cached, dict):
        cache_set(cache_key, disk_cached, 24 * 3600)
        return disk_cached

    municipality_statcode = gm_statcode_from_gmcode(gmcode)
    municipality_feature = await get_area_feature("municipality", municipality_statcode)
    municipality_props = municipality_feature.get("properties", {}) or {}
    municipality_bbox = bbox_from_feature(municipality_feature)

    wijk_raw = await fetch_all_features(
        f"{WIJK_URL}&bbox={municipality_bbox}",
        ttl_seconds=24 * 3600,
    )
    wijken = preprocess_features(wijk_raw, "wijk")

    filtered_features: List[Dict[str, Any]] = []
    province_statcode = str(municipality_props.get("_pvstatcode", "")).strip().upper()

    for feature in wijken.get("features", []) or []:
        props = feature.get("properties", {}) or {}
        if str(props.get("_gmcode", "")).strip() != gmcode:
            continue
        props["_pvstatcode"] = province_statcode
        filtered_features.append(feature)

    result = {"type": "FeatureCollection", "features": filtered_features}

    save_admin_cache_file(
        disk_path,
        result,
        level="wijk",
        parent_gmcode=gmcode,
        parent_statcode=municipality_statcode,
    )
    cache_set(cache_key, result, 24 * 3600)
    return result


async def load_buurten_for_municipality(municipality_gmcode: str) -> Dict[str, Any]:
    gmcode = normalize_gmcode(municipality_gmcode)
    if not gmcode:
        return empty_feature_collection()

    cache_key = f"admin_buurten_by_gm_v1::{gmcode}"
    cached = cache_get(cache_key)
    if isinstance(cached, dict):
        return cached

    disk_path = ADMIN_BUURTEN_DIR / f"{gmcode}.json"
    disk_cached = load_admin_cache_file(
        disk_path,
        expected_level="buurt",
        expected_parent_gmcode=gmcode,
    )
    if isinstance(disk_cached, dict):
        cache_set(cache_key, disk_cached, 24 * 3600)
        return disk_cached

    municipality_statcode = gm_statcode_from_gmcode(gmcode)
    municipality_feature = await get_area_feature("municipality", municipality_statcode)
    municipality_props = municipality_feature.get("properties", {}) or {}
    municipality_bbox = bbox_from_feature(municipality_feature)

    buurt_raw = await fetch_all_features(
        f"{BUURT_URL}&bbox={municipality_bbox}",
        ttl_seconds=24 * 3600,
    )
    buurten = preprocess_features(buurt_raw, "buurt")

    filtered_features: List[Dict[str, Any]] = []
    province_statcode = str(municipality_props.get("_pvstatcode", "")).strip().upper()

    for feature in buurten.get("features", []) or []:
        props = feature.get("properties", {}) or {}
        if str(props.get("_gmcode", "")).strip() != gmcode:
            continue
        props["_pvstatcode"] = province_statcode
        filtered_features.append(feature)

    result = {"type": "FeatureCollection", "features": filtered_features}

    save_admin_cache_file(
        disk_path,
        result,
        level="buurt",
        parent_gmcode=gmcode,
        parent_statcode=municipality_statcode,
    )
    cache_set(cache_key, result, 24 * 3600)
    return result


async def load_wijken() -> Dict[str, Any]:
    cache_key = "admin_wijken_v1"
    cached = cache_get(cache_key)
    if isinstance(cached, dict):
        return cached

    gemeenten = await load_municipalities()
    gm_to_province = municipality_to_province_map_from_features(gemeenten)

    wijk_raw = await fetch_all_features(WIJK_URL, ttl_seconds=24 * 3600)
    wijken = preprocess_features(wijk_raw, "wijk")

    for feature in wijken["features"]:
        gmcode = str(feature.get("properties", {}).get("_gmcode", "")).strip()
        gm_statcode = f"GM{gmcode}" if gmcode else ""
        feature["properties"]["_pvstatcode"] = gm_to_province.get(gm_statcode, "")

    cache_set(cache_key, wijken, 24 * 3600)
    return wijken


async def load_buurten() -> Dict[str, Any]:
    cache_key = "admin_buurten_v1"
    cached = cache_get(cache_key)
    if isinstance(cached, dict):
        return cached

    gemeenten = await load_municipalities()
    gm_to_province = municipality_to_province_map_from_features(gemeenten)

    buurt_raw = await fetch_all_features(BUURT_URL, ttl_seconds=24 * 3600)
    buurten = preprocess_features(buurt_raw, "buurt")

    for feature in buurten["features"]:
        gmcode = str(feature.get("properties", {}).get("_gmcode", "")).strip()
        gm_statcode = f"GM{gmcode}" if gmcode else ""
        feature["properties"]["_pvstatcode"] = gm_to_province.get(gm_statcode, "")

    cache_set(cache_key, buurten, 24 * 3600)
    return buurten


async def load_admin_data() -> Dict[str, Any]:
    cache_key = "admin_data_v3"
    cached = cache_get(cache_key)
    if isinstance(cached, dict):
        return cached

    provincies = await load_provinces()
    gemeenten = await load_municipalities()
    wijken = await load_wijken()
    buurten = await load_buurten()

    result = {
        "provincies": provincies,
        "gemeenten": gemeenten,
        "wijken": wijken,
        "buurten": buurten,
    }
    cache_set(cache_key, result, 24 * 3600)
    return result


async def get_area_feature(level: str, statcode: str) -> Dict[str, Any]:
    level = (level or "").strip().lower()
    statcode = (statcode or "").strip().upper()

    if level == "province":
        features = (await load_provinces())["features"]

    elif level == "municipality":
        features = (await load_municipalities())["features"]

    elif level == "wijk":
        gmcode = municipality_code_from_statcode(statcode)
        if not gmcode:
            raise HTTPException(
                status_code=400,
                detail=f"Could not extract municipality code from wijk statcode={statcode}",
            )
        features = (await load_wijken_for_municipality(gmcode))["features"]

    elif level == "buurt":
        gmcode = municipality_code_from_statcode(statcode)
        if not gmcode:
            raise HTTPException(
                status_code=400,
                detail=f"Could not extract municipality code from buurt statcode={statcode}",
            )
        features = (await load_buurten_for_municipality(gmcode))["features"]

    else:
        raise HTTPException(status_code=400, detail="Invalid level")

    for feature in features:
        if str(feature.get("properties", {}).get("_statcode", "")).upper() == statcode:
            return feature

    raise HTTPException(
        status_code=404,
        detail=f"Area not found for level={level}, statcode={statcode}",
    )


def feature_intersects_area(feature: Dict[str, Any], area_feature: Dict[str, Any]) -> bool:
    try:
        geom_a = shape(feature["geometry"])
        geom_b = shape(area_feature["geometry"])
        return geom_a.intersects(geom_b)
    except Exception:
        return False


def bbox_from_feature(feature: Dict[str, Any]) -> str:
    geom = shape(feature["geometry"])
    minx, miny, maxx, maxy = geom.bounds
    return f"{minx},{miny},{maxx},{maxy}"


def feature_matches_area_for_bag_object(
    feature: Dict[str, Any],
    area_feature: Dict[str, Any],
    object_type: str,
) -> bool:
    return feature_intersects_area(feature, area_feature)


async def count_bag_pand_for_area(level: str, statcode: str) -> int:
    area_feature = await get_area_feature(level, statcode)
    bbox = bbox_from_feature(area_feature)
    url = f"{BAG_PAND_URL}&bbox={bbox}"

    cache_key = f"bag_pand_summary::{level.strip().lower()}::{statcode.strip().upper()}"
    cached = cache_get(cache_key)
    if cached is not None:
        return int(cached)

    raw_fc = await fetch_all_features(url, ttl_seconds=15 * 60)
    count = sum(
        1
        for f in raw_fc.get("features", []) or []
        if feature_intersects_area(f, area_feature)
    )

    cache_set(cache_key, count, 15 * 60)
    return count




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
