"""Operator CLI for rebuilding the BAG pand summary store.

Invoked as ``python -m Backend.cli.rebuild [options]``. Wraps the same
:func:`build_bag_pand_summary_store` function used by the HTTP route, so the
two paths produce identical results. Intended for production use via
``docker exec`` / SSH / cron, where the HTTP endpoint is disabled by default.

Exit codes:
    0 — rebuild completed successfully (status == "complete").
    1 — rebuild ran but did not complete cleanly, or raised an exception.
    2 — could not start because another rebuild is already in progress.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from typing import Any

from Backend.domain.rebuild import _rebuild_lock, build_bag_pand_summary_store
from Backend.logging_setup import get_logger

logger = get_logger(__name__)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m Backend.cli.rebuild",
        description="Rebuild the BAG pand summary store from PDOK.",
    )
    parser.add_argument(
        "-p",
        "--province",
        default=None,
        metavar="PV_STATCODE",
        help="Rebuild a single province (e.g. PV20). Default: all provinces.",
    )
    parser.add_argument(
        "--no-resume",
        action="store_true",
        help="Disable resume from checkpoint. Default: resume enabled.",
    )
    parser.add_argument(
        "--retry-attempts",
        type=int,
        default=2,
        choices=range(1, 11),
        metavar="N",
        help="Per-municipality retry attempts (1-10). Default: 2.",
    )
    parser.add_argument(
        "--no-retry-failed",
        action="store_true",
        help="Skip the retry pass for previously failed municipalities. "
        "Default: retry enabled.",
    )
    return parser


async def _main(args: argparse.Namespace) -> int:
    if _rebuild_lock.locked():
        logger.error("A BAG pand summary rebuild is already in progress.")
        return 2

    async with _rebuild_lock:
        try:
            result: dict[str, Any] = await build_bag_pand_summary_store(
                province_statcode=args.province,
                resume=not args.no_resume,
                municipality_retry_attempts=args.retry_attempts,
                retry_failed_municipalities=not args.no_retry_failed,
            )
        except Exception as exc:
            logger.exception("Rebuild failed: %s", exc)
            return 1

    status = result.get("status")
    affected_mun = len(result.get("affected_municipalities", {}))
    affected_pv = len(result.get("affected_provinces", {}))
    failed_mun = len(result.get("failed_municipalities", []))
    skipped_mun = len(result.get("skipped_municipalities", []))

    logger.info(
        "Rebuild %s: provinces=%d municipalities=%d failed=%d skipped=%d",
        status,
        affected_pv,
        affected_mun,
        failed_mun,
        skipped_mun,
    )

    return 0 if status == "complete" else 1


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()
    exit_code = asyncio.run(_main(args))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
