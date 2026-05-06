from __future__ import annotations

import time
from typing import Any, Dict, Optional, Tuple

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
