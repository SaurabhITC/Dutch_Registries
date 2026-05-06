from __future__ import annotations

from typing import Any, Dict, List

from shapely.geometry import shape


def bbox_from_feature(feature: Dict[str, Any]) -> str:
    geom = shape(feature["geometry"])
    minx, miny, maxx, maxy = geom.bounds
    return f"{minx},{miny},{maxx},{maxy}"


def feature_intersects_area(feature: Dict[str, Any], area_feature: Dict[str, Any]) -> bool:
    try:
        geom_a = shape(feature["geometry"])
        geom_b = shape(area_feature["geometry"])
        return geom_a.intersects(geom_b)
    except Exception:
        return False


def find_best_province_statcode_for_municipality(
    municipality_feature: Dict[str, Any],
    province_features: List[Dict[str, Any]],
) -> str:
    try:
        municipality_geom = shape(municipality_feature["geometry"])
    except Exception:
        return ""

    best_pv = ""
    best_overlap_area = 0.0

    for province_feature in province_features:
        try:
            province_geom = shape(province_feature["geometry"])
            overlap_area = municipality_geom.intersection(province_geom).area
        except Exception:
            continue

        if overlap_area > best_overlap_area:
            best_overlap_area = overlap_area
            best_pv = str(
                province_feature.get("properties", {}).get("_statcode", "")
            ).strip().upper()

    if best_pv:
        return best_pv

    try:
        probe = municipality_geom.representative_point()
        for province_feature in province_features:
            province_geom = shape(province_feature["geometry"])
            if province_geom.contains(probe) or province_geom.intersects(probe):
                return str(
                    province_feature.get("properties", {}).get("_statcode", "")
                ).strip().upper()
    except Exception:
        return ""

    return ""
