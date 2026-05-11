from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, Optional

from Backend.cache.disk import atomic_write_json
from Backend.logging_setup import get_logger
from Backend.paths import BAG_FEATURE_CACHE_DIR

logger = get_logger(__name__)

BAG_FEATURE_CACHE_VERSION = 2
BAG_FEATURE_CACHE_TTL_SECONDS = 24 * 60 * 60


def _cache_path(object_type: str, level: str, statcode: str) -> Path:
    object_type_norm = str(object_type or "").strip().lower()
    level_norm = str(level or "").strip().lower()
    statcode_norm = str(statcode or "").strip().upper()
    return BAG_FEATURE_CACHE_DIR / object_type_norm / level_norm / f"{statcode_norm}.json"


def _is_cacheable(level: str) -> bool:
    return str(level or "").strip().lower() in {"wijk", "buurt"}


def load_bag_features_from_cache(
    object_type: str,
    level: str,
    statcode: str,
) -> Optional[Dict[str, Any]]:
    if not _is_cacheable(level):
        return None

    object_type_norm = str(object_type or "").strip().lower()
    level_norm = str(level or "").strip().lower()
    statcode_norm = str(statcode or "").strip().upper()

    path = _cache_path(object_type_norm, level_norm, statcode_norm)
    if not path.exists():
        return None

    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        logger.warning("failed to read BAG feature cache %s: %s", path, exc)
        return None

    if not isinstance(data, dict):
        logger.warning("BAG feature cache %s: not a dict", path)
        return None

    if int(data.get("cache_version") or 0) != BAG_FEATURE_CACHE_VERSION:
        logger.warning("BAG feature cache %s: version mismatch", path)
        return None

    if str(data.get("object_type") or "").strip().lower() != object_type_norm:
        logger.warning("BAG feature cache %s: object_type mismatch", path)
        return None

    if str(data.get("level") or "").strip().lower() != level_norm:
        logger.warning("BAG feature cache %s: level mismatch", path)
        return None

    if str(data.get("statcode") or "").strip().upper() != statcode_norm:
        logger.warning("BAG feature cache %s: statcode mismatch", path)
        return None

    saved_at = data.get("saved_at")
    if not isinstance(saved_at, (int, float)):
        logger.warning("BAG feature cache %s: missing saved_at", path)
        return None

    if time.time() - float(saved_at) > BAG_FEATURE_CACHE_TTL_SECONDS:
        return None

    features = data.get("features", []) or []
    return {"type": "FeatureCollection", "features": features}


def save_bag_features_to_cache(
    object_type: str,
    level: str,
    statcode: str,
    fc: Dict[str, Any],
) -> None:
    if not _is_cacheable(level):
        return

    object_type_norm = str(object_type or "").strip().lower()
    level_norm = str(level or "").strip().lower()
    statcode_norm = str(statcode or "").strip().upper()

    payload = {
        "cache_version": BAG_FEATURE_CACHE_VERSION,
        "object_type": object_type_norm,
        "level": level_norm,
        "statcode": statcode_norm,
        "saved_at": time.time(),
        "type": "FeatureCollection",
        "features": fc.get("features", []) or [],
    }

    path = _cache_path(object_type_norm, level_norm, statcode_norm)
    atomic_write_json(path, payload)
