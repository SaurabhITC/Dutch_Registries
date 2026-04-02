from __future__ import annotations

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


def empty_bag_pand_summary_store() -> Dict[str, Any]:
    return {
        "created_at": None,
        "source": "bag_pand_precomputed_summary",
        "municipalities": {},
        "provinces": {},
    }


def load_bag_pand_summary_store() -> Dict[str, Any]:
    global _bag_pand_summary_store

    if not SUMMARY_FILE.exists():
        _bag_pand_summary_store = empty_bag_pand_summary_store()
        return _bag_pand_summary_store

    try:
        with SUMMARY_FILE.open("r", encoding="utf-8") as f:
            data = json.load(f)

        if not isinstance(data, dict):
            data = empty_bag_pand_summary_store()

        data.setdefault("created_at", None)
        data.setdefault("source", "bag_pand_precomputed_summary")
        data.setdefault("municipalities", {})
        data.setdefault("provinces", {})

        _bag_pand_summary_store = data
        return _bag_pand_summary_store

    except Exception as e:
        print(f"[summary-store] failed to load summary file: {e}")
        _bag_pand_summary_store = empty_bag_pand_summary_store()
        return _bag_pand_summary_store


def save_bag_pand_summary_store(data: Dict[str, Any]) -> Dict[str, Any]:
    global _bag_pand_summary_store

    SUMMARY_FILE.parent.mkdir(parents=True, exist_ok=True)

    with SUMMARY_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    _bag_pand_summary_store = data
    return _bag_pand_summary_store


def is_bag_pand_summary_store_fresh(data: Optional[Dict[str, Any]]) -> bool:
    if not data:
        return False

    created_at = data.get("created_at")
    if not created_at:
        return False

    age = time.time() - created_at
    return age < SUMMARY_MAX_AGE_SECONDS


async def fetch_json(url: str, *, ttl_seconds: int = 3600) -> Any:
    cached = cache_get(url)
    if cached is not None:
        return cached

    headers = {
        "Accept": "application/geo+json,application/json;q=0.9,text/html;q=0.1",
        "User-Agent": "geonovum-registry-dashboard/0.1.0",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, headers=headers)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Upstream request error: {exc!s}") from exc

    if response.status_code != 200:
        snippet = response.text[:300].replace("\n", " ")
        raise HTTPException(
            status_code=502,
            detail=f"Upstream error {response.status_code} for {url}. Body: {snippet}",
        )

    data = response.json()
    cache_set(url, data, ttl_seconds)
    return data


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
) -> Dict[str, Any]:
    store = empty_bag_pand_summary_store()
    data = await load_admin_data()

    municipalities: Dict[str, int] = {}
    provinces: Dict[str, int] = {}
    only_province = str(province_statcode or "").strip().upper()

    for feature in data["gemeenten"]["features"]:
        props = feature.get("properties", {}) or {}
        statcode = str(props.get("_statcode", "")).strip().upper()

        if not statcode.startswith("GM"):
            continue

        pv_statcode = str(props.get("_pvstatcode", "")).strip().upper()
        if only_province and pv_statcode != only_province:
            continue

        count = await count_bag_pand_for_area("municipality", statcode)
        municipalities[statcode] = count

        if pv_statcode:
            provinces[pv_statcode] = provinces.get(pv_statcode, 0) + count

    store["municipalities"] = municipalities
    store["provinces"] = provinces
    store["created_at"] = time.time()

    save_bag_pand_summary_store(store)
    return store


async def ensure_bag_pand_summary_store() -> Dict[str, Any]:
    data = load_bag_pand_summary_store()

    if is_bag_pand_summary_store_fresh(data):
        return data

    try:
        return await build_bag_pand_summary_store()
    except Exception as e:
        print(f"[summary-store] rebuild failed: {e}")

        if data and data.get("municipalities"):
            return data

        raise


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
        store = await ensure_bag_pand_summary_store()

        if level_norm == "municipality":
            count = store.get("municipalities", {}).get(statcode_norm)
        else:
            count = store.get("provinces", {}).get(statcode_norm)

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
) -> Dict[str, Any]:
    store = await build_bag_pand_summary_store(
        province_statcode=province_statcode
    )
    return {
        "ok": True,
        "created_at": store.get("created_at"),
        "municipality_count": len(store.get("municipalities", {})),
        "province_count": len(store.get("provinces", {})),
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
