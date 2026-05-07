from __future__ import annotations

from Backend.config import settings

RUNTIME_DATA_DIR = settings.data_dir

ADMIN_CACHE_DIR = RUNTIME_DATA_DIR / "admin_data"
ADMIN_PROVINCES_FILE = ADMIN_CACHE_DIR / "provinces.json"
ADMIN_MUNICIPALITIES_FILE = ADMIN_CACHE_DIR / "municipalities.json"
ADMIN_MUNICIPALITY_PROVINCE_MAP_FILE = ADMIN_CACHE_DIR / "municipality_to_province.json"
ADMIN_WIJKEN_DIR = ADMIN_CACHE_DIR / "wijken"
ADMIN_BUURTEN_DIR = ADMIN_CACHE_DIR / "buurten"

BAG_DATA_DIR = RUNTIME_DATA_DIR / "bag_data"
SUMMARY_FILE = BAG_DATA_DIR / "bag_pand_summary_store.json"

for _p in [
    RUNTIME_DATA_DIR,
    ADMIN_CACHE_DIR,
    ADMIN_WIJKEN_DIR,
    ADMIN_BUURTEN_DIR,
    BAG_DATA_DIR,
]:
    _p.mkdir(parents=True, exist_ok=True)
