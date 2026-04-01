from __future__ import annotations

import re
import time
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

CacheValue = Tuple[float, Any]
_cache: Dict[str, CacheValue] = {}


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

    province_by_statcode = {
        f["properties"]["_statcode"]: f for f in provincies["features"]
    }
    gm_to_province: Dict[str, str] = {}

    for feature in gemeenten["features"]:
        props = feature["properties"]
        statcode = props["_statcode"]
        if not statcode.startswith("GM"):
            continue

        matched_pv = ""
        provinciecode = props.get("provinciecode") or props.get("pv_code") or props.get("pvcode")

        if provinciecode:
            candidate_codes = [
                str(provinciecode),
                f"PV{str(provinciecode).zfill(2)}",
                f"PV{str(provinciecode)}",
            ]
            for code in candidate_codes:
                if code in province_by_statcode:
                    matched_pv = code
                    break

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


app = FastAPI(title=APP_TITLE, version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
