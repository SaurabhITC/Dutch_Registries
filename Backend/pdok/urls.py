from __future__ import annotations

from Backend.config import settings

YEARCODE = settings.yearcode
CBS_BASE = settings.pdok_cbs_base
BAG_BASE = settings.pdok_bag_base

PROVINCIE_URL = (
    f"{CBS_BASE}/collections/provincie_gegeneraliseerd/items"
    f"?f=json&limit=1000&jaarcode={YEARCODE}"
)
GEMEENTE_URL = (
    f"{CBS_BASE}/collections/gemeente_niet_gegeneraliseerd/items"
    f"?f=json&limit=1000&jaarcode={YEARCODE}"
)
WIJK_URL = (
    f"{CBS_BASE}/collections/wijk_niet_gegeneraliseerd/items"
    f"?f=json&limit=1000&jaarcode={YEARCODE}"
)
BUURT_URL = (
    f"{CBS_BASE}/collections/buurt_niet_gegeneraliseerd/items"
    f"?f=json&limit=1000&jaarcode={YEARCODE}"
)
BAG_PAND_URL = f"{BAG_BASE}/collections/pand/items?f=json&limit=1000"
BAG_COLLECTION_URLS = {
    "pand": BAG_PAND_URL,
    "verblijfsobject": f"{BAG_BASE}/collections/verblijfsobject/items?f=json&limit=1000",
    "adres": f"{BAG_BASE}/collections/adres/items?f=json&limit=1000",
    "woonplaats": f"{BAG_BASE}/collections/woonplaats/items?f=json&limit=1000",
    "standplaats": f"{BAG_BASE}/collections/standplaats/items?f=json&limit=1000",
    "ligplaats": f"{BAG_BASE}/collections/ligplaats/items?f=json&limit=1000",
}
