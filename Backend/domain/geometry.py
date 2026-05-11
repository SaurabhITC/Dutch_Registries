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


def feature_assigned_to_area(feature: Dict[str, Any], area_feature: Dict[str, Any]) -> bool:
    """
    Return True if `feature` is assigned to `area_feature` by the
    representative-point rule.

    A feature belongs to exactly one area: the one whose polygon
    contains the feature's representative point. For Point geometries,
    the point itself is used. For Polygon and MultiPolygon geometries,
    `shapely.representative_point()` returns a point guaranteed to lie
    inside the geometry (unlike `centroid`, which can fall outside for
    concave shapes).

    This is the canonical spatial-assignment rule used by CBS and
    Kadaster for assigning addresses, buildings, and other point/area
    features to administrative units. It guarantees that summed counts
    across sibling areas equal the total in the parent area.
    """
    try:
        feature_geom = shape(feature["geometry"])
        area_geom = shape(area_feature["geometry"])
    except Exception:
        return False

    try:
        if feature_geom.geom_type == "Point":
            probe = feature_geom
        else:
            probe = feature_geom.representative_point()
        return area_geom.contains(probe)
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
