from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Optional

from Backend.domain.admin import count_bag_pand_for_area, load_municipalities
from Backend.domain.bag_summary import (
    SUMMARY_DATASET_KEY,
    get_or_create_dataset_province_entry,
    get_summary_dataset,
    load_bag_pand_summary_store,
    recompute_dataset_province_entry_count,
    save_bag_pand_summary_dataset_checkpoint,
)
from Backend.logging_setup import get_logger

logger = get_logger(__name__)

# Serializes rebuild requests so two concurrent POSTs can't race on the same
# in-memory store and summary file. Reads are not gated by this lock.
_rebuild_lock = asyncio.Lock()


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
