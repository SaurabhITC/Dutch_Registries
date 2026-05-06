from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

import httpx
from fastapi import HTTPException

from cache import cache_get, cache_set
from logging_setup import get_logger

logger = get_logger(__name__)


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
