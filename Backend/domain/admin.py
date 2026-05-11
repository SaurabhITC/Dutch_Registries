from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import HTTPException

from Backend.cache import (
    cache_get,
    cache_set,
    load_admin_cache_file,
    load_municipality_to_province_map_file,
    save_admin_cache_file,
    save_municipality_to_province_map_file,
)
from Backend.domain.codes import (
    municipality_code_from_statcode,
    normalize_gmcode,
    preprocess_features,
)
from Backend.domain.geometry import (
    bbox_from_feature,
    feature_intersects_area,
    find_best_province_statcode_for_municipality,
)
from Backend.paths import (
    ADMIN_BUURTEN_DIR,
    ADMIN_MUNICIPALITIES_FILE,
    ADMIN_MUNICIPALITY_PROVINCE_MAP_FILE,
    ADMIN_PROVINCES_FILE,
    ADMIN_WIJKEN_DIR,
)
from Backend.pdok import (
    BAG_PAND_URL,
    BUURT_URL,
    GEMEENTE_URL,
    PROVINCIE_URL,
    WIJK_URL,
    fetch_all_features,
)


_statcode_index_cache: Dict[int, Dict[str, Dict[str, Any]]] = {}


def _index_features_by_statcode(
    features: List[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    cache_key = id(features)
    cached = _statcode_index_cache.get(cache_key)
    if cached is not None:
        return cached

    index: Dict[str, Dict[str, Any]] = {}
    for feature in features:
        statcode = str(feature.get("properties", {}).get("_statcode", "")).upper()
        if not statcode:
            continue
        index[statcode] = feature

    if len(_statcode_index_cache) > 64:
        _statcode_index_cache.clear()
    _statcode_index_cache[cache_key] = index
    return index


def get_cached_admin_data() -> Optional[Dict[str, Any]]:
    cached = cache_get("admin_data_v3")
    return cached if isinstance(cached, dict) else None


def cached_municipality_to_province_map() -> Dict[str, str]:
    mapping: Dict[str, str] = {}

    file_mapping = load_municipality_to_province_map_file(ADMIN_MUNICIPALITY_PROVINCE_MAP_FILE)
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


def empty_feature_collection() -> Dict[str, Any]:
    return {"type": "FeatureCollection", "features": []}


async def load_municipality_to_province_map() -> Dict[str, str]:
    cache_key = "municipality_to_province_map_v1"
    cached = cache_get(cache_key)
    if isinstance(cached, dict) and cached:
        return cached

    disk_cached = load_municipality_to_province_map_file(ADMIN_MUNICIPALITY_PROVINCE_MAP_FILE)
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

    mapping = save_municipality_to_province_map_file(ADMIN_MUNICIPALITY_PROVINCE_MAP_FILE, mapping)
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

    index = _index_features_by_statcode(features)
    feature = index.get(statcode)
    if feature is not None:
        return feature

    raise HTTPException(
        status_code=404,
        detail=f"Area not found for level={level}, statcode={statcode}",
    )


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
