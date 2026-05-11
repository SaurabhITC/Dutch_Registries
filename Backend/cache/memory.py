from __future__ import annotations

import time
from collections import OrderedDict
from typing import Any, Optional, Tuple

CacheValue = Tuple[float, Any]
_MAX_ENTRIES = 500
_cache: "OrderedDict[str, CacheValue]" = OrderedDict()


def cache_get(key: str) -> Optional[Any]:
    record = _cache.get(key)
    if not record:
        return None
    expires_at, value = record
    if time.time() >= expires_at:
        _cache.pop(key, None)
        return None
    _cache.move_to_end(key)
    return value


def cache_set(key: str, value: Any, ttl_seconds: int) -> None:
    _cache[key] = (time.time() + ttl_seconds, value)
    _cache.move_to_end(key)
    while len(_cache) > _MAX_ENTRIES:
        _cache.popitem(last=False)
