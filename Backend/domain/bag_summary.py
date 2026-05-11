from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional

from Backend.cache import atomic_write_json
from Backend.config import settings
from Backend.domain.admin import cached_municipality_to_province_map
from Backend.logging_setup import get_logger
from Backend.paths import SUMMARY_FILE

logger = get_logger(__name__)

SUMMARY_DATASET_KEY = "bag_pand"
SUMMARY_MAX_AGE_SECONDS = settings.summary_max_age_seconds

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

    normalized = normalize_summary_store(data)
    atomic_write_json(SUMMARY_FILE, normalized)

    _bag_pand_summary_store = normalized
    return _bag_pand_summary_store


def is_bag_pand_summary_store_fresh(data: Optional[Dict[str, Any]]) -> bool:
    dataset = get_summary_dataset(data, SUMMARY_DATASET_KEY)

    created_at = dataset.get("created_at")
    if not created_at:
        return False

    age = time.time() - created_at
    return age < SUMMARY_MAX_AGE_SECONDS


async def ensure_bag_pand_summary_store() -> Dict[str, Any]:
    store = load_bag_pand_summary_store()
    return get_summary_dataset(store, SUMMARY_DATASET_KEY)
