from __future__ import annotations

import re
from typing import Any, Dict


def pretty_name(props: Dict[str, Any]) -> str:
    return str(props.get("statnaam") or props.get("naam") or props.get("name") or "")


def pretty_statcode(props: Dict[str, Any]) -> str:
    return str(props.get("statcode") or props.get("code") or "")


def normalize_gmcode(value: Any) -> str:
    s = str(value or "").strip().upper()
    if not s:
        return ""
    m = re.search(r"(\d{4})", s)
    return m.group(1) if m else ""


def municipality_code_from_statcode(statcode: str) -> str:
    statcode = (statcode or "").strip().upper()
    if len(statcode) >= 6 and statcode[:2] in {"GM", "WK", "BU"}:
        return statcode[2:6]
    return ""


def extract_municipality_code(props: Dict[str, Any], statcode: str, kind: str) -> str:
    preferred_keys = [
        "gm_code",
        "gmcode",
        "gemeentecode",
        "gemeentecode",
        "gemeentecodegm",
        "gem_code",
        "gemcode",
        "municipality_code",
        "municipalitycode",
        "gemeente_id",
        "gm_id",
    ]
    for key in preferred_keys:
        if key in props:
            code = normalize_gmcode(props.get(key))
            if code:
                return code

    for key, value in props.items():
        k = str(key).lower()
        if "gemeente" in k or k.startswith("gm"):
            code = normalize_gmcode(value)
            if code:
                return code

    # Final fallback
    return municipality_code_from_statcode(statcode)


def wijk_body(statcode: str) -> str:
    statcode = (statcode or "").strip().upper()
    if statcode.startswith("WK"):
        return statcode[2:]
    return ""


def preprocess_features(fc: Dict[str, Any], kind: str) -> Dict[str, Any]:
    out = {"type": "FeatureCollection", "features": []}
    for feature in fc.get("features", []) or []:
        props = dict(feature.get("properties") or {})
        statcode = pretty_statcode(props)

        props["_kind"] = kind
        props["_statcode"] = statcode
        props["_statnaam"] = pretty_name(props)
        props["_gmcode"] = extract_municipality_code(props, statcode, kind)
        props["_wijkbody"] = wijk_body(statcode)

        f2 = dict(feature)
        f2["properties"] = props
        out["features"].append(f2)
    return out
