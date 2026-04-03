from __future__ import annotations

import asyncio
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from shapely.geometry import shape

APP_TITLE = "Geonovum Registry Dashboard Backend"
APP_VERSION = "0.1.0"
YEARCODE = 2025

CBS_BASE = "https://api.pdok.nl/cbs/gebiedsindelingen/ogc/v1"
BAG_BASE = "https://api.pdok.nl/kadaster/bag/ogc/v2"

PROVINCIE_URL = (
    f"{CBS_BASE}/collections/provincie_gegeneraliseerd/items"
    f"?f=json&limit=1000&jaarcode={YEARCODE}"
)
GEMEENTE_URL = (
    f"{CBS_BASE}/collections/gemeente_gegeneraliseerd/items"
    f"?f=json&limit=1000&jaarcode={YEARCODE}"
)
WIJK_URL = (
    f"{CBS_BASE}/collections/wijk_gegeneraliseerd/items"
    f"?f=json&limit=1000&jaarcode={YEARCODE}"
)
BUURT_URL = (
    f"{CBS_BASE}/collections/buurt_gegeneraliseerd/items"
    f"?f=json&limit=1000&jaarcode={YEARCODE}"
)
BAG_PAND_URL = f"{BAG_BASE}/collections/pand/items?f=json&limit=1000"

SUMMARY_FILE = Path(__file__).resolve().parent / "bag_pand_summary_store.json"
SUMMARY_MAX_AGE_SECONDS = 24 * 60 * 60
SUMMARY_DATASET_KEY = "bag_pand"

CacheValue = Tuple[float, Any]
_cache: Dict[str, CacheValue] = {}
_bag_pand_summary_store: Optional[Dict[str, Any]] = None


def cache_get(key: str) -> Optional[Any]:
    record = _cache.get(key)
    if not record:
        return None
    expires_at, value = record
    if time.time() >= expires_at:
        _cache.pop(key, None)
        return None
    return value


def cache_set(key: str, value: Any, ttl_seconds: int) -> None:
    _cache[key] = (time.time() + ttl_seconds, value)




def get_cached_admin_data() -> Optional[Dict[str, Any]]:
    cached = cache_get("admin_data_v3")
    return cached if isinstance(cached, dict) else None


def cached_municipality_to_province_map() -> Dict[str, str]:
    admin_data = get_cached_admin_data() or {}
    mapping: Dict[str, str] = {}

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
        print(f"[summary-store] failed to load summary file: {e}")
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


async def fetch_json(
    url: str,
    *,
    ttl_seconds: int = 3600,
    request_retries: int = 3,
    retry_delay_seconds: float = 1.5,
) -> Any:
    cached = cache_get(url)
    if cached is not None:
        return cached

    headers = {
        "Accept": "application/geo+json,application/json;q=0.9,text/html;q=0.1",
        "User-Agent": "geonovum-registry-dashboard/0.1.0",
    }

    last_error: Optional[HTTPException] = None

    for attempt in range(1, max(1, request_retries) + 1):
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(url, headers=headers)
        except httpx.RequestError as exc:
            last_error = HTTPException(
                status_code=502,
                detail=f"Upstream request error: {exc!s}",
            )
        else:
            if response.status_code == 200:
                data = response.json()
                cache_set(url, data, ttl_seconds)
                return data

            snippet = response.text[:300].replace("\n", " ")
            last_error = HTTPException(
                status_code=502,
                detail=f"Upstream error {response.status_code} for {url}. Body: {snippet}",
            )

            if response.status_code < 500:
                raise last_error

        if attempt < max(1, request_retries):
            await asyncio.sleep(retry_delay_seconds * attempt)

    assert last_error is not None
    raise last_error


async def fetch_all_features(start_url: str, *, ttl_seconds: int = 3600) -> Dict[str, Any]:
    cache_key = f"all::{start_url}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    all_features: List[Dict[str, Any]] = []
    next_url: Optional[str] = start_url

    while next_url:
        fc = await fetch_json(next_url, ttl_seconds=ttl_seconds)
        all_features.extend(fc.get("features", []) or [])
        next_url = None
        for link in fc.get("links", []) or []:
            if link.get("rel") == "next" and link.get("href"):
                next_url = link["href"]
                break

    out = {"type": "FeatureCollection", "features": all_features}
    cache_set(cache_key, out, ttl_seconds)
    return out


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


def find_province_statcode_for_municipality(
    municipality_feature: Dict[str, Any],
    province_features: List[Dict[str, Any]],
) -> str:
    try:
        municipality_geom = shape(municipality_feature["geometry"])
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


async def load_admin_data() -> Dict[str, Any]:
    cache_key = "admin_data_v3"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    provincie_raw = await fetch_all_features(PROVINCIE_URL, ttl_seconds=24 * 3600)
    gemeente_raw = await fetch_all_features(GEMEENTE_URL, ttl_seconds=24 * 3600)
    wijk_raw = await fetch_all_features(WIJK_URL, ttl_seconds=24 * 3600)
    buurt_raw = await fetch_all_features(BUURT_URL, ttl_seconds=24 * 3600)

    provincies = preprocess_features(provincie_raw, "provincie")
    gemeenten = preprocess_features(gemeente_raw, "gemeente")
    wijken = preprocess_features(wijk_raw, "wijk")
    buurten = preprocess_features(buurt_raw, "buurt")

    gm_to_province: Dict[str, str] = {}

    for feature in gemeenten["features"]:
        props = feature["properties"]
        statcode = props["_statcode"]
        if not statcode.startswith("GM"):
            continue

        matched_pv = find_province_statcode_for_municipality(
            feature,
            provincies["features"],
        )

        props["_pvstatcode"] = matched_pv
        gm_to_province[statcode] = matched_pv

    for feature in wijken["features"]:
        gmcode = str(feature["properties"].get("_gmcode", "")).strip()
        gm_statcode = f"GM{gmcode}" if gmcode else ""
        feature["properties"]["_pvstatcode"] = gm_to_province.get(gm_statcode, "")

    for feature in buurten["features"]:
        gmcode = str(feature["properties"].get("_gmcode", "")).strip()
        gm_statcode = f"GM{gmcode}" if gmcode else ""
        feature["properties"]["_pvstatcode"] = gm_to_province.get(gm_statcode, "")

    result = {
        "provincies": provincies,
        "gemeenten": gemeenten,
        "wijken": wijken,
        "buurten": buurten,
    }
    cache_set(cache_key, result, 24 * 3600)
    return result


async def get_area_feature(level: str, statcode: str) -> Dict[str, Any]:
    data = await load_admin_data()
    level = (level or "").strip().lower()
    statcode = (statcode or "").strip().upper()

    if level == "province":
        features = data["provincies"]["features"]
    elif level == "municipality":
        features = data["gemeenten"]["features"]
    elif level == "wijk":
        features = data["wijken"]["features"]
    elif level == "buurt":
        features = data["buurten"]["features"]
    else:
        raise HTTPException(status_code=400, detail="Invalid level")

    for feature in features:
        if str(feature.get("properties", {}).get("_statcode", "")).upper() == statcode:
            return feature

    raise HTTPException(status_code=404, detail=f"Area not found for level={level}, statcode={statcode}")


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
    data = await load_admin_data()
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

    for feature in data["gemeenten"]["features"]:
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
                print(
                    f"[bag-pand-summary] municipality={municipality_statcode} attempt={attempt}/{max(1, municipality_retry_attempts)}"
                )
                return await count_bag_pand_for_area("municipality", municipality_statcode)
            except Exception as exc:  # pragma: no cover - defensive logging path
                last_error = exc
                print(
                    f"[bag-pand-summary] municipality={municipality_statcode} failed on attempt {attempt}/{max(1, municipality_retry_attempts)}: {exc}"
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
            print(
                f"[bag-pand-summary] province={pv_statcode} municipality={municipality_statcode} name={municipality_name} skipped_existing=true"
            )
            return True

        print(
            f"[bag-pand-summary] province={pv_statcode} municipality={municipality_statcode} name={municipality_name} second_pass={str(second_pass).lower()} status=start"
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
            print(
                f"[bag-pand-summary] province={pv_statcode} municipality={municipality_statcode} name={municipality_name} second_pass={str(second_pass).lower()} status=failed"
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

        print(
            f"[bag-pand-summary] province={pv_statcode} municipality={municipality_statcode} name={municipality_name} count={count} status=done"
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
    await load_admin_data()
    store = load_bag_pand_summary_store()
    return get_summary_dataset(store, SUMMARY_DATASET_KEY)


app = FastAPI(title=APP_TITLE, version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_load_bag_pand_summary_store() -> None:
    await load_admin_data()
    load_bag_pand_summary_store()


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"ok": True, "service": APP_TITLE, "version": APP_VERSION}


@app.get("/api/areas/provinces")
async def get_provinces() -> Dict[str, Any]:
    data = await load_admin_data()
    return data["provincies"]


@app.get("/api/areas/municipalities")
async def get_municipalities(
    province_statcode: Optional[str] = Query(default=None)
) -> Dict[str, Any]:
    data = await load_admin_data()
    features = data["gemeenten"]["features"]

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
    data = await load_admin_data()
    features = data["wijken"]["features"]

    if municipality_gmcode:
        gmcode = normalize_gmcode(municipality_gmcode)
        if not gmcode:
            return {"type": "FeatureCollection", "features": []}

        features = [
            f for f in features
            if str(f.get("properties", {}).get("_gmcode", "")).strip() == gmcode
        ]

    return {"type": "FeatureCollection", "features": features}


@app.get("/api/areas/buurten")
async def get_buurten(
    municipality_gmcode: Optional[str] = Query(default=None),
    wijk_statcode: Optional[str] = Query(default=None),
) -> Dict[str, Any]:
    data = await load_admin_data()
    features = data["buurten"]["features"]

    if municipality_gmcode:
        gmcode = normalize_gmcode(municipality_gmcode)
        if not gmcode:
            return {"type": "FeatureCollection", "features": []}

        features = [
            f for f in features
            if str(f.get("properties", {}).get("_gmcode", "")).strip() == gmcode
        ]

    if wijk_statcode:
        body = wijk_body(wijk_statcode)
        if not body:
            return {"type": "FeatureCollection", "features": []}

        features = [
            f for f in features
            if str(f.get("properties", {}).get("_statcode", "")).upper().startswith(f"BU{body}")
        ]

    return {"type": "FeatureCollection", "features": features}


@app.get("/api/areas/all")
async def get_all_areas() -> Dict[str, Any]:
    return await load_admin_data()





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
