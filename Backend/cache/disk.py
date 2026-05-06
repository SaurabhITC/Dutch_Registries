from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, Optional

from config import settings
from logging_setup import get_logger

logger = get_logger(__name__)

ADMIN_CACHE_VERSION = 1


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
        "yearcode": settings.yearcode,
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

    if int(data.get("yearcode") or 0) != settings.yearcode:
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


def load_municipality_to_province_map_file(path: Path) -> Dict[str, str]:
    if not path.exists():
        return {}

    try:
        with path.open("r", encoding="utf-8") as f:
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


def save_municipality_to_province_map_file(path: Path, mapping: Dict[str, str]) -> Dict[str, str]:
    path.parent.mkdir(parents=True, exist_ok=True)

    cleaned: Dict[str, str] = {}
    for gm_statcode, pv_statcode in mapping.items():
        gm = str(gm_statcode).strip().upper()
        pv = str(pv_statcode).strip().upper()
        if gm.startswith("GM") and pv.startswith("PV"):
            cleaned[gm] = pv

    with path.open("w", encoding="utf-8") as f:
        json.dump(dict(sorted(cleaned.items())), f, ensure_ascii=False, indent=2)

    return cleaned
