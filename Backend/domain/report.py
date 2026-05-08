from __future__ import annotations

import asyncio
import io
import logging
import math
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import httpx
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw
from pyproj import Transformer
from reportlab.graphics.shapes import Circle, Drawing, Line, Rect
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from shapely.geometry import shape
from shapely.ops import transform as shp_transform

from Backend.domain.admin import get_area_feature
from Backend.domain.geometry import bbox_from_feature, feature_intersects_area
from Backend.pdok import BAG_COLLECTION_URLS, BAG_PAND_URL, fetch_all_features

logger = logging.getLogger(__name__)


# Frontend NL_BOUNDS (Frontend/app.js:605).
NL_BOUNDS_WGS84: Tuple[float, float, float, float] = (3.31, 50.75, 7.23, 53.55)

# Outline colors per area level — matches the frontend's wijk/buurt line paint
# (Frontend/app.js cbs-wijk-line / cbs-buurt-line) AND the brief's spec.
AREA_OUTLINE_COLORS = {
    "wijk": "#f97316",
    "buurt": "#8b5cf6",
}

# Mirror of Frontend/app.js BAG_COLLECTIONS (lines 614-661). The brief forbids
# redefining the JS source, so the values are duplicated here verbatim.
BAG_LAYER_DISPLAY: Dict[str, Dict[str, Any]] = {
    "pand": {
        "label_nl": "Pand",
        "label_en": "Building",
        "geometry": "polygon",
        "swatch": "#d9c4a6",
        "stroke": "#8b5e3c",
    },
    "verblijfsobject": {
        "label_nl": "Verblijfsobject",
        "label_en": "Residential unit",
        "geometry": "point",
        "swatch": "#0ea5e9",
        "stroke": "#0ea5e9",
    },
    "adres": {
        "label_nl": "Adres",
        "label_en": "Address",
        "geometry": "point",
        "swatch": "#f97316",
        "stroke": "#f97316",
    },
    "woonplaats": {
        "label_nl": "Woonplaats",
        "label_en": "Place",
        "geometry": "polygon",
        "swatch": "#bbf7d0",
        "stroke": "#16a34a",
    },
    "standplaats": {
        "label_nl": "Standplaats",
        "label_en": "Standplace",
        "geometry": "polygon",
        "swatch": "#fde68a",
        "stroke": "#d97706",
    },
    "ligplaats": {
        "label_nl": "Ligplaats",
        "label_en": "Mooring place",
        "geometry": "polygon",
        "swatch": "#c7d2fe",
        "stroke": "#4f46e5",
    },
}

# Mirror of Frontend/app.js BOUWJAAR_BUCKETS (line 1291).
BOUWJAAR_BUCKETS: List[Tuple[str, float, float]] = [
    ("<1900", float("-inf"), 1899),
    ("1900-1909", 1900, 1909),
    ("1910-1919", 1910, 1919),
    ("1920-1929", 1920, 1929),
    ("1930-1939", 1930, 1939),
    ("1940-1949", 1940, 1949),
    ("1950-1959", 1950, 1959),
    ("1960-1969", 1960, 1969),
    ("1970-1979", 1970, 1979),
    ("1980-1989", 1980, 1989),
    ("1990-1999", 1990, 1999),
    ("2000-2009", 2000, 2009),
    ("2010-2019", 2010, 2019),
    ("2020+", 2020, float("inf")),
]

# Mirror of Frontend/app.js OPPERVLAKTE_BUCKETS (line 1308). Half-open [min, lt).
OPPERVLAKTE_BUCKETS: List[Tuple[str, float, float]] = [
    ("<50 m²", float("-inf"), 50),
    ("50-75 m²", 50, 75),
    ("75-100 m²", 75, 100),
    ("100-150 m²", 100, 150),
    ("150-250 m²", 150, 250),
    ("250+ m²", 250, float("inf")),
]

# Mirror of Frontend/app.js GEBRUIKSDOEL_CATEGORIES (line 1317).
GEBRUIKSDOEL_CATEGORIES = [
    "woonfunctie",
    "winkelfunctie",
    "kantoorfunctie",
    "industriefunctie",
    "onderwijsfunctie",
    "gezondheidszorgfunctie",
    "sportfunctie",
    "logiesfunctie",
    "bijeenkomstfunctie",
    "celfunctie",
    "overige gebruiksfunctie",
]

GEBRUIKSDOEL_LABELS = {
    "woonfunctie": {"nl": "Woonfunctie", "en": "Residential"},
    "winkelfunctie": {"nl": "Winkelfunctie", "en": "Retail"},
    "kantoorfunctie": {"nl": "Kantoorfunctie", "en": "Office"},
    "industriefunctie": {"nl": "Industriefunctie", "en": "Industrial"},
    "onderwijsfunctie": {"nl": "Onderwijsfunctie", "en": "Education"},
    "gezondheidszorgfunctie": {"nl": "Gezondheidszorgfunctie", "en": "Healthcare"},
    "sportfunctie": {"nl": "Sportfunctie", "en": "Sport"},
    "logiesfunctie": {"nl": "Logiesfunctie", "en": "Lodging"},
    "bijeenkomstfunctie": {"nl": "Bijeenkomstfunctie", "en": "Assembly"},
    "celfunctie": {"nl": "Celfunctie", "en": "Detention"},
    "overige gebruiksfunctie": {"nl": "Overige gebruiksfunctie", "en": "Other use"},
}

THEME_HEADING = "#1B4D3E"
THEME_ACCENT = "#7FB539"
THEME_TEXT = "#1c1c1c"
THEME_SECONDARY = "#535353"
THEME_BORDER = "#b4b4b4"
THEME_SUBTLE_BG = "#f4f4f4"

# PDOK retired the BRT-Achtergrondkaart WMS (only WMTS remains for this layer).
# We stitch WMTS tiles to produce a basemap image at an arbitrary bbox/size.
PDOK_BRT_WMTS_TEMPLATE = (
    "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/standaard/EPSG:3857/{z}/{x}/{y}.png"
)
WMTS_TILE_PX = 256
WEB_MERCATOR_HALF_EXTENT = 20037508.342789244


T = {
    "nl": {
        "report_title": "Basisregistraties Rapport",
        "generated_on": "Gegenereerd op",
        "breadcrumb_separator": " &gt; ",
        "level_wijk": "Wijk",
        "level_buurt": "Buurt",
        "boundaries_section": "Grenzen",
        "data_layers_section": "Gegevenslagen",
        "summary_stats": "Samenvatting",
        "metric_layer": "Laag",
        "metric_count": "Aantal",
        "metric_area": "Oppervlakte",
        "metric_density": "Dichtheid (pand per km²)",
        "chart_bouwjaar_title": "Bouwjaar",
        "chart_bouwjaar_desc": "Verdeling van panden per bouwjaarklasse.",
        "chart_gebruiksdoel_title": "Gebruiksdoel",
        "chart_gebruiksdoel_desc": "Aantal verblijfsobjecten per functietype.",
        "chart_oppervlakte_title": "Oppervlakte verblijfsobjecten",
        "chart_oppervlakte_desc": "Verdeling van verblijfsobjecten naar gebruiksoppervlakte.",
        "sample_records": "Voorbeeldrecords",
        "sample_records_caption": "Eerste 50 panden in het geselecteerde gebied.",
        "col_id": "ID",
        "col_bouwjaar": "Bouwjaar",
        "col_gebruiksdoel": "Gebruiksdoel",
        "col_oppervlakte": "Oppervlakte (m²)",
        "col_status": "Status",
        "axis_count": "Aantal",
        "axis_year": "Bouwjaar",
        "axis_area": "Oppervlakte (m²)",
    },
    "en": {
        "report_title": "Dutch Base Registries Report",
        "generated_on": "Generated on",
        "breadcrumb_separator": " &gt; ",
        "level_wijk": "District",
        "level_buurt": "Neighborhood",
        "boundaries_section": "Boundaries",
        "data_layers_section": "Data layers",
        "summary_stats": "Summary Statistics",
        "metric_layer": "Layer",
        "metric_count": "Count",
        "metric_area": "Area",
        "metric_density": "Density (buildings per km²)",
        "chart_bouwjaar_title": "Year of construction",
        "chart_bouwjaar_desc": "Distribution of buildings by construction year class.",
        "chart_gebruiksdoel_title": "Function / use",
        "chart_gebruiksdoel_desc": "Residential units per function type.",
        "chart_oppervlakte_title": "Surface area of residential units",
        "chart_oppervlakte_desc": "Distribution of residential units by usable surface area.",
        "sample_records": "Sample Records",
        "sample_records_caption": "First 50 buildings in the selected area.",
        "col_id": "ID",
        "col_bouwjaar": "Year built",
        "col_gebruiksdoel": "Use",
        "col_oppervlakte": "Area (m²)",
        "col_status": "Status",
        "axis_count": "Count",
        "axis_year": "Year built",
        "axis_area": "Surface area (m²)",
    },
}


def _t(lang: str, key: str) -> str:
    norm = "en" if lang == "en" else "nl"
    return T[norm].get(key, T["nl"].get(key, key))


def _bag_label(key: str, lang: str) -> str:
    info = BAG_LAYER_DISPLAY.get(key, {})
    if lang == "en":
        return info.get("label_en") or key
    return info.get("label_nl") or key


_to_3857 = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True).transform
_to_28992 = Transformer.from_crs("EPSG:4326", "EPSG:28992", always_xy=True).transform


def _pad_bbox(bbox_wgs84: Tuple[float, float, float, float], pct: float = 0.10) -> Tuple[float, float, float, float]:
    minx, miny, maxx, maxy = bbox_wgs84
    dx = (maxx - minx) * pct
    dy = (maxy - miny) * pct
    return (minx - dx, miny - dy, maxx + dx, maxy + dy)


def _bbox_to_3857(bbox_wgs84: Tuple[float, float, float, float]) -> Tuple[float, float, float, float]:
    minx_w, miny_w, maxx_w, maxy_w = bbox_wgs84
    minx_m, miny_m = _to_3857(minx_w, miny_w)
    maxx_m, maxy_m = _to_3857(maxx_w, maxy_w)
    return (minx_m, miny_m, maxx_m, maxy_m)


def _fit_bbox_to_aspect(
    bbox_3857: Tuple[float, float, float, float], width_px: int, height_px: int
) -> Tuple[float, float, float, float]:
    minx, miny, maxx, maxy = bbox_3857
    bbox_w = maxx - minx
    bbox_h = maxy - miny
    if bbox_w <= 0 or bbox_h <= 0:
        return bbox_3857
    target_ratio = width_px / height_px
    bbox_ratio = bbox_w / bbox_h
    cx = (minx + maxx) / 2
    cy = (miny + maxy) / 2
    if bbox_ratio < target_ratio:
        new_w = bbox_h * target_ratio
        return (cx - new_w / 2, miny, cx + new_w / 2, maxy)
    new_h = bbox_w / target_ratio
    return (minx, cy - new_h / 2, maxx, cy + new_h / 2)


def _project_to_3857(geom):
    return shp_transform(_to_3857, geom)


def _project_to_28992(geom):
    return shp_transform(_to_28992, geom)


def _world_to_pixel(
    x: float,
    y: float,
    bbox: Tuple[float, float, float, float],
    size: Tuple[int, int],
) -> Tuple[float, float]:
    minx, miny, maxx, maxy = bbox
    w_px, h_px = size
    px = (x - minx) / (maxx - minx) * w_px
    py = h_px - (y - miny) / (maxy - miny) * h_px
    return (px, py)


def _outer_rings(geom) -> List[List[Tuple[float, float]]]:
    rings: List[List[Tuple[float, float]]] = []
    if geom.is_empty:
        return rings
    if geom.geom_type == "Polygon":
        rings.append(list(geom.exterior.coords))
    elif geom.geom_type == "MultiPolygon":
        for poly in geom.geoms:
            rings.append(list(poly.exterior.coords))
    return rings


def _hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    h = hex_color.strip().lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _wmts_tile_size_m(z: int) -> float:
    return (2 * WEB_MERCATOR_HALF_EXTENT) / (2**z)


def _3857_to_tile_xy_float(x_m: float, y_m: float, z: int) -> Tuple[float, float]:
    ts = _wmts_tile_size_m(z)
    tx = (x_m + WEB_MERCATOR_HALF_EXTENT) / ts
    ty = (WEB_MERCATOR_HALF_EXTENT - y_m) / ts
    return (tx, ty)


def _pick_wmts_zoom(
    bbox_3857: Tuple[float, float, float, float], width_px: int, max_zoom: int = 19
) -> int:
    minx, _miny, maxx, _maxy = bbox_3857
    bbox_w = max(maxx - minx, 1.0)
    desired_tiles = max(width_px / WMTS_TILE_PX, 1.0)
    target_tile_size_m = bbox_w / desired_tiles
    zoom_float = math.log2((2 * WEB_MERCATOR_HALF_EXTENT) / target_tile_size_m)
    return max(0, min(max_zoom, int(round(zoom_float))))


async def _fetch_basemap_image(
    client: httpx.AsyncClient,
    bbox_3857: Tuple[float, float, float, float],
    width: int,
    height: int,
) -> Image.Image:
    """Stitch BRT-Achtergrondkaart WMTS tiles to fill bbox_3857 at width × height."""
    z = _pick_wmts_zoom(bbox_3857, width)
    minx, miny, maxx, maxy = bbox_3857

    tx_min_f, ty_max_f = _3857_to_tile_xy_float(minx, miny, z)
    tx_max_f, ty_min_f = _3857_to_tile_xy_float(maxx, maxy, z)
    tx_min = max(0, int(math.floor(tx_min_f)))
    tx_max = min(2**z - 1, int(math.floor(tx_max_f)))
    ty_min = max(0, int(math.floor(ty_min_f)))
    ty_max = min(2**z - 1, int(math.floor(ty_max_f)))

    if tx_max < tx_min or ty_max < ty_min:
        return Image.new("RGB", (width, height), (244, 244, 244))

    cols = tx_max - tx_min + 1
    rows = ty_max - ty_min + 1
    canvas = Image.new("RGB", (cols * WMTS_TILE_PX, rows * WMTS_TILE_PX), (244, 244, 244))

    async def fetch_one(tx: int, ty: int) -> Tuple[int, int, Optional[Image.Image]]:
        url = PDOK_BRT_WMTS_TEMPLATE.format(z=z, x=tx, y=ty)
        try:
            resp = await client.get(url, timeout=15.0)
            resp.raise_for_status()
            return (tx, ty, Image.open(io.BytesIO(resp.content)).convert("RGB"))
        except Exception as exc:
            logger.warning("WMTS tile fetch failed z=%d x=%d y=%d: %s", z, tx, ty, exc)
            return (tx, ty, None)

    tasks = [
        fetch_one(tx, ty)
        for tx in range(tx_min, tx_max + 1)
        for ty in range(ty_min, ty_max + 1)
    ]
    results = await asyncio.gather(*tasks)
    for tx, ty, tile_img in results:
        if tile_img is None:
            continue
        canvas.paste(tile_img, ((tx - tx_min) * WMTS_TILE_PX, (ty - ty_min) * WMTS_TILE_PX))

    ts_m = _wmts_tile_size_m(z)
    canvas_minx = -WEB_MERCATOR_HALF_EXTENT + tx_min * ts_m
    canvas_maxy = WEB_MERCATOR_HALF_EXTENT - ty_min * ts_m
    px_per_m = WMTS_TILE_PX / ts_m

    crop_left = (minx - canvas_minx) * px_per_m
    crop_top = (canvas_maxy - maxy) * px_per_m
    crop_right = (maxx - canvas_minx) * px_per_m
    crop_bottom = (canvas_maxy - miny) * px_per_m
    cropped = canvas.crop(
        (
            max(0, int(round(crop_left))),
            max(0, int(round(crop_top))),
            min(canvas.size[0], int(round(crop_right))),
            min(canvas.size[1], int(round(crop_bottom))),
        )
    )
    if cropped.size[0] == 0 or cropped.size[1] == 0:
        return Image.new("RGB", (width, height), (244, 244, 244))
    return cropped.resize((width, height), Image.LANCZOS)


def _draw_boundary_overlay(
    base: Image.Image,
    geom_wgs84,
    bbox_3857: Tuple[float, float, float, float],
    color_hex: str,
    line_width: int = 3,
) -> Image.Image:
    geom_3857 = _project_to_3857(geom_wgs84)
    overlay = base.convert("RGBA").copy()
    draw = ImageDraw.Draw(overlay, "RGBA")
    color_rgba = _hex_to_rgb(color_hex) + (255,)
    size = base.size
    for ring in _outer_rings(geom_3857):
        pts = [_world_to_pixel(x, y, bbox_3857, size) for (x, y) in ring]
        if len(pts) >= 2:
            draw.line(pts, fill=color_rgba, width=line_width, joint="curve")
    return overlay.convert("RGB")


async def _render_overview_map(
    client: httpx.AsyncClient,
    geom_wgs84,
    color_hex: str,
    width_px: int = 700,
    height_px: int = 580,
) -> bytes:
    bbox_3857 = _bbox_to_3857(NL_BOUNDS_WGS84)
    bbox_3857 = _fit_bbox_to_aspect(bbox_3857, width_px, height_px)
    base = await _fetch_basemap_image(client, bbox_3857, width_px, height_px)
    img = _draw_boundary_overlay(base, geom_wgs84, bbox_3857, color_hex, line_width=4)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _render_zoom_map(
    client: httpx.AsyncClient,
    bbox_wgs84: Tuple[float, float, float, float],
    geom_wgs84,
    color_hex: str,
    width_px: int = 1700,
    height_px: int = 1100,
) -> bytes:
    bbox_3857 = _bbox_to_3857(_pad_bbox(bbox_wgs84, 0.10))
    bbox_3857 = _fit_bbox_to_aspect(bbox_3857, width_px, height_px)
    base = await _fetch_basemap_image(client, bbox_3857, width_px, height_px)
    img = _draw_boundary_overlay(base, geom_wgs84, bbox_3857, color_hex, line_width=5)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def aggregate_bouwjaar(features: List[Dict[str, Any]]) -> List[int]:
    counts = [0] * len(BOUWJAAR_BUCKETS)
    for f in features:
        raw = (f.get("properties") or {}).get("bouwjaar")
        try:
            year = int(float(raw))
        except (TypeError, ValueError):
            continue
        if year < 1:
            continue
        for i, (_label, lo, hi) in enumerate(BOUWJAAR_BUCKETS):
            if lo <= year <= hi:
                counts[i] += 1
                break
    return counts


def aggregate_oppervlakte(features: List[Dict[str, Any]]) -> List[int]:
    counts = [0] * len(OPPERVLAKTE_BUCKETS)
    for f in features:
        raw = (f.get("properties") or {}).get("oppervlakte")
        try:
            v = float(raw)
        except (TypeError, ValueError):
            continue
        if v <= 0:
            continue
        for i, (_label, lo, hi) in enumerate(OPPERVLAKTE_BUCKETS):
            if lo <= v < hi:
                counts[i] += 1
                break
    return counts


def aggregate_gebruiksdoel(features: List[Dict[str, Any]]) -> List[Tuple[str, int]]:
    counts: Dict[str, int] = {c: 0 for c in GEBRUIKSDOEL_CATEGORIES}
    for f in features:
        raw = (f.get("properties") or {}).get("gebruiksdoel")
        if not isinstance(raw, str) or not raw.strip():
            continue
        for tok in raw.split(","):
            t = tok.strip().lower()
            if t in counts:
                counts[t] += 1
    entries = [(c, counts[c]) for c in GEBRUIKSDOEL_CATEGORIES if counts[c] > 0]
    entries.sort(key=lambda e: e[1], reverse=True)
    return entries


def _render_bar_chart(
    *,
    labels: List[str],
    values: List[int],
    title: str,
    xlabel: str,
    ylabel: str,
    cmap_name: str,
    horizontal: bool = False,
    rotate_x: int = 0,
) -> bytes:
    fig, ax = plt.subplots(figsize=(8, 4.4), dpi=300)
    fig.patch.set_facecolor("white")
    cmap = plt.get_cmap(cmap_name)
    n = max(len(values), 1)
    colors = [cmap(0.20 + 0.70 * (i / max(n - 1, 1))) for i in range(n)]
    if horizontal:
        ax.barh(labels, values, color=colors, edgecolor="white", linewidth=0.4)
        ax.invert_yaxis()
        ax.set_xlabel(xlabel, color=THEME_SECONDARY, fontsize=10)
    else:
        ax.bar(labels, values, color=colors, edgecolor="white", linewidth=0.4)
        ax.set_ylabel(ylabel, color=THEME_SECONDARY, fontsize=10)
        ax.set_xlabel(xlabel, color=THEME_SECONDARY, fontsize=10)
        if rotate_x:
            for tick in ax.get_xticklabels():
                tick.set_rotation(rotate_x)
                tick.set_ha("right")
    ax.set_title(title, color=THEME_HEADING, fontsize=13, fontweight="bold", pad=14)
    ax.tick_params(axis="both", colors=THEME_SECONDARY, labelsize=9)
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color(THEME_BORDER)
    ax.grid(
        axis="x" if horizontal else "y",
        color=THEME_BORDER,
        alpha=0.35,
        linewidth=0.5,
    )
    fig.tight_layout()
    buf = io.BytesIO()
    fig.savefig(buf, format="PNG", dpi=300, bbox_inches="tight", facecolor="white")
    plt.close(fig)
    return buf.getvalue()


def render_bouwjaar_chart(features: List[Dict[str, Any]], lang: str) -> Optional[bytes]:
    counts = aggregate_bouwjaar(features)
    if sum(counts) == 0:
        return None
    return _render_bar_chart(
        labels=[b[0] for b in BOUWJAAR_BUCKETS],
        values=counts,
        title=_t(lang, "chart_bouwjaar_title"),
        xlabel=_t(lang, "axis_year"),
        ylabel=_t(lang, "axis_count"),
        cmap_name="YlOrRd",
        rotate_x=45,
    )


def render_gebruiksdoel_chart(features: List[Dict[str, Any]], lang: str) -> Optional[bytes]:
    entries = aggregate_gebruiksdoel(features)
    if not entries:
        return None
    labels = [GEBRUIKSDOEL_LABELS.get(k, {}).get(lang if lang in ("nl", "en") else "nl", k) for (k, _) in entries]
    values = [v for (_, v) in entries]
    return _render_bar_chart(
        labels=labels,
        values=values,
        title=_t(lang, "chart_gebruiksdoel_title"),
        xlabel=_t(lang, "axis_count"),
        ylabel="",
        cmap_name="Set2",
        horizontal=True,
    )


def render_oppervlakte_chart(features: List[Dict[str, Any]], lang: str) -> Optional[bytes]:
    counts = aggregate_oppervlakte(features)
    if sum(counts) == 0:
        return None
    return _render_bar_chart(
        labels=[b[0] for b in OPPERVLAKTE_BUCKETS],
        values=counts,
        title=_t(lang, "chart_oppervlakte_title"),
        xlabel=_t(lang, "axis_area"),
        ylabel=_t(lang, "axis_count"),
        cmap_name="Blues",
    )


async def _fetch_bag_features(
    area_feature: Dict[str, Any], object_type: str
) -> List[Dict[str, Any]]:
    bag_url = BAG_PAND_URL if object_type == "pand" else BAG_COLLECTION_URLS.get(object_type)
    if not bag_url:
        return []
    bbox = bbox_from_feature(area_feature)
    url = f"{bag_url}&bbox={bbox}"
    raw_fc = await fetch_all_features(url, ttl_seconds=15 * 60)
    return [
        f
        for f in (raw_fc.get("features") or [])
        if feature_intersects_area(f, area_feature)
    ]


def _format_int(value: int, lang: str) -> str:
    if lang == "en":
        return f"{value:,}"
    return f"{value:,}".replace(",", ".")


def _format_decimal(value: float, lang: str, places: int = 2) -> str:
    s = f"{value:,.{places}f}"
    if lang == "en":
        return s
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _format_date_today() -> str:
    return datetime.now().strftime("%d-%m-%Y")


def _build_breadcrumb(
    province: str, municipality: str, area_type: str, area_name: str, lang: str
) -> str:
    sep = _t(lang, "breadcrumb_separator")
    level_label = _t(lang, "level_wijk") if area_type == "wijk" else _t(lang, "level_buurt")
    parts = [p for p in [province, municipality, f"{level_label}: {area_name}"] if p]
    return sep.join(parts)


def _legend_swatch(color_hex: str, kind: str) -> Drawing:
    drawing = Drawing(12 * mm, 4 * mm)
    if kind == "line":
        drawing.add(
            Line(
                0,
                2 * mm,
                12 * mm,
                2 * mm,
                strokeColor=HexColor(color_hex),
                strokeWidth=2.4,
            )
        )
    elif kind == "circle":
        drawing.add(
            Circle(
                6 * mm,
                2 * mm,
                1.6 * mm,
                fillColor=HexColor(color_hex),
                strokeColor=HexColor(color_hex),
            )
        )
    else:
        drawing.add(
            Rect(
                0,
                0.6 * mm,
                12 * mm,
                2.8 * mm,
                fillColor=HexColor(color_hex),
                strokeColor=HexColor(color_hex),
                strokeWidth=0.6,
            )
        )
    return drawing


def _legend_table(rows: List[Tuple[str, str, str]]) -> Table:
    label_style = ParagraphStyle(
        "LegendLabel",
        fontName="Helvetica",
        fontSize=10,
        textColor=HexColor(THEME_TEXT),
        leading=12,
    )
    data: List[List[Any]] = []
    for label, color_hex, kind in rows:
        data.append([_legend_swatch(color_hex, kind), Paragraph(label, label_style)])
    table = Table(data, colWidths=[14 * mm, 150 * mm])
    table.setStyle(
        TableStyle(
            [
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


async def build_report_pdf(
    *,
    area_type: str,
    area_id: str,
    area_name: str,
    parent_municipality: str,
    parent_province: str,
    layers: List[str],
    language: str,
    bbox: List[float],
) -> bytes:
    lang = "en" if language == "en" else "nl"
    area_type_norm = "buurt" if area_type == "buurt" else "wijk"
    area_color = AREA_OUTLINE_COLORS[area_type_norm]

    area_feature = await get_area_feature(area_type_norm, area_id)
    geom = shape(area_feature["geometry"])

    geom_rd = _project_to_28992(geom)
    area_km2 = geom_rd.area / 1_000_000.0

    if bbox and len(bbox) == 4:
        bbox_tuple: Tuple[float, float, float, float] = (
            float(bbox[0]),
            float(bbox[1]),
            float(bbox[2]),
            float(bbox[3]),
        )
    else:
        b = geom.bounds
        bbox_tuple = (b[0], b[1], b[2], b[3])

    requested_layers = [k for k in layers if k in BAG_LAYER_DISPLAY]

    fetched_features: Dict[str, List[Dict[str, Any]]] = {}
    for key in requested_layers:
        try:
            fetched_features[key] = await _fetch_bag_features(area_feature, key)
        except Exception as exc:
            logger.warning("report fetch failed for layer=%s: %s", key, exc)
            fetched_features[key] = []

    pand_features = fetched_features.get("pand", [])

    async with httpx.AsyncClient() as client:
        try:
            zoom_png = await _render_zoom_map(client, bbox_tuple, geom, area_color)
        except Exception as exc:
            logger.warning("zoom map render failed: %s", exc)
            zoom_png = None
        try:
            overview_png = await _render_overview_map(client, geom, area_color)
        except Exception as exc:
            logger.warning("overview map render failed: %s", exc)
            overview_png = None

    styles = getSampleStyleSheet()
    h_title = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        textColor=HexColor(THEME_HEADING),
        leading=24,
        spaceAfter=4,
        alignment=TA_LEFT,
    )
    h_sub = ParagraphStyle(
        "ReportSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        textColor=HexColor(THEME_SECONDARY),
        leading=14,
        spaceAfter=2,
    )
    h_meta = ParagraphStyle(
        "ReportMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        textColor=HexColor(THEME_SECONDARY),
        leading=12,
        spaceAfter=10,
    )
    h_section = ParagraphStyle(
        "ReportSection",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        textColor=HexColor(THEME_HEADING),
        leading=18,
        spaceBefore=10,
        spaceAfter=8,
    )
    h_subsection = ParagraphStyle(
        "ReportSubSection",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        textColor=HexColor(THEME_HEADING),
        leading=14,
        spaceBefore=4,
        spaceAfter=4,
    )
    h_body = ParagraphStyle(
        "ReportBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=HexColor(THEME_TEXT),
        leading=13,
        spaceAfter=4,
    )
    h_caption = ParagraphStyle(
        "ReportCaption",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        textColor=HexColor(THEME_SECONDARY),
        leading=11,
        spaceAfter=8,
    )

    breadcrumb = _build_breadcrumb(
        parent_province, parent_municipality, area_type_norm, area_name, lang
    )

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=f"{_t(lang, 'report_title')} - {area_name}",
        author="Geonovum Registry Dashboard",
    )

    story: List[Any] = []

    story.append(Paragraph(_t(lang, "report_title"), h_title))
    story.append(Paragraph(area_name, h_sub))
    story.append(Paragraph(breadcrumb, h_sub))
    story.append(
        Paragraph(f"{_t(lang, 'generated_on')}: {_format_date_today()}", h_meta)
    )

    if overview_png:
        ov_img = RLImage(io.BytesIO(overview_png), width=60 * mm, height=50 * mm)
        ov_img.hAlign = "RIGHT"
        story.append(ov_img)
        story.append(Spacer(1, 6))

    if zoom_png:
        zoom_img = RLImage(io.BytesIO(zoom_png), width=170 * mm, height=110 * mm)
        zoom_img.hAlign = "CENTER"
        story.append(zoom_img)
    story.append(Spacer(1, 8))

    story.append(Paragraph(_t(lang, "boundaries_section"), h_subsection))
    story.append(_legend_table([(_t(lang, f"level_{area_type_norm}"), area_color, "line")]))
    story.append(Spacer(1, 6))
    if requested_layers:
        story.append(Paragraph(_t(lang, "data_layers_section"), h_subsection))
        legend_rows: List[Tuple[str, str, str]] = []
        for key in requested_layers:
            info = BAG_LAYER_DISPLAY[key]
            kind = "circle" if info.get("geometry") == "point" else "fill"
            color = info.get("swatch") or info.get("stroke") or THEME_ACCENT
            legend_rows.append((_bag_label(key, lang), color, kind))
        story.append(_legend_table(legend_rows))

    story.append(PageBreak())
    story.append(Paragraph(_t(lang, "summary_stats"), h_section))

    summary_rows: List[List[Any]] = [
        [
            Paragraph(f"<b>{_t(lang, 'metric_layer')}</b>", h_body),
            Paragraph(f"<b>{_t(lang, 'metric_count')}</b>", h_body),
        ]
    ]
    for key in requested_layers:
        summary_rows.append(
            [
                Paragraph(_bag_label(key, lang), h_body),
                Paragraph(_format_int(len(fetched_features.get(key, [])), lang), h_body),
            ]
        )
    summary_rows.append(
        [
            Paragraph(_t(lang, "metric_area"), h_body),
            Paragraph(f"{_format_decimal(area_km2, lang, 3)} km²", h_body),
        ]
    )
    if pand_features and area_km2 > 0:
        density = len(pand_features) / area_km2
        summary_rows.append(
            [
                Paragraph(_t(lang, "metric_density"), h_body),
                Paragraph(_format_decimal(density, lang, 1), h_body),
            ]
        )

    summary_table = Table(summary_rows, colWidths=[110 * mm, 50 * mm])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HexColor(THEME_SUBTLE_BG)),
                ("LINEBELOW", (0, 0), (-1, 0), 0.5, HexColor(THEME_BORDER)),
                ("LINEBELOW", (0, -1), (-1, -1), 0.5, HexColor(THEME_BORDER)),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(summary_table)

    if "pand" in requested_layers and pand_features:
        chart_png = render_bouwjaar_chart(pand_features, lang)
        if chart_png:
            story.append(PageBreak())
            story.append(Paragraph(_t(lang, "chart_bouwjaar_title"), h_section))
            story.append(RLImage(io.BytesIO(chart_png), width=170 * mm, height=95 * mm))
            story.append(Paragraph(_t(lang, "chart_bouwjaar_desc"), h_caption))

    if "verblijfsobject" in requested_layers:
        vo_features = fetched_features.get("verblijfsobject", [])
        gebruik_png = render_gebruiksdoel_chart(vo_features, lang)
        if gebruik_png:
            story.append(PageBreak())
            story.append(Paragraph(_t(lang, "chart_gebruiksdoel_title"), h_section))
            story.append(RLImage(io.BytesIO(gebruik_png), width=170 * mm, height=95 * mm))
            story.append(Paragraph(_t(lang, "chart_gebruiksdoel_desc"), h_caption))
        opp_png = render_oppervlakte_chart(vo_features, lang)
        if opp_png:
            story.append(PageBreak())
            story.append(Paragraph(_t(lang, "chart_oppervlakte_title"), h_section))
            story.append(RLImage(io.BytesIO(opp_png), width=170 * mm, height=95 * mm))
            story.append(Paragraph(_t(lang, "chart_oppervlakte_desc"), h_caption))

    if pand_features:
        story.append(PageBreak())
        story.append(Paragraph(_t(lang, "sample_records"), h_section))
        story.append(Paragraph(_t(lang, "sample_records_caption"), h_caption))
        sample = pand_features[:50]
        cols = ["col_id", "col_bouwjaar", "col_gebruiksdoel", "col_oppervlakte", "col_status"]
        header_style = ParagraphStyle(
            "ReportTableHead",
            fontName="Helvetica-Bold",
            fontSize=8,
            textColor=HexColor("#ffffff"),
            leading=10,
        )
        cell_style = ParagraphStyle(
            "ReportTableCell",
            fontName="Helvetica",
            fontSize=8,
            textColor=HexColor(THEME_TEXT),
            leading=10,
        )
        rows: List[List[Any]] = [[Paragraph(_t(lang, c), header_style) for c in cols]]
        for feat in sample:
            props = feat.get("properties") or {}
            rid = str(props.get("identificatie") or props.get("id") or "")
            bouwjaar = str(props.get("bouwjaar") or "")
            gebruiksdoel = str(props.get("gebruiksdoel") or "")
            oppervlakte = props.get("oppervlakte")
            if isinstance(oppervlakte, (int, float)):
                opp_str = _format_decimal(float(oppervlakte), lang, 0)
            elif oppervlakte:
                opp_str = str(oppervlakte)
            else:
                opp_str = ""
            status = str(props.get("status") or "")
            rows.append(
                [
                    Paragraph(rid, cell_style),
                    Paragraph(bouwjaar, cell_style),
                    Paragraph(gebruiksdoel, cell_style),
                    Paragraph(opp_str, cell_style),
                    Paragraph(status, cell_style),
                ]
            )

        sample_table = Table(
            rows,
            colWidths=[42 * mm, 20 * mm, 50 * mm, 24 * mm, 30 * mm],
            repeatRows=1,
        )
        ts = TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HexColor(THEME_HEADING)),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LINEBELOW", (0, 0), (-1, 0), 0.4, HexColor(THEME_BORDER)),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
        for r in range(1, len(rows)):
            if r % 2 == 0:
                ts.add("BACKGROUND", (0, r), (-1, r), HexColor(THEME_SUBTLE_BG))
        sample_table.setStyle(ts)
        story.append(sample_table)

    doc.build(story)
    return buffer.getvalue()
