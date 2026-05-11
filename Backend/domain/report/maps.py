from __future__ import annotations

import asyncio
import io
import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import httpx
from PIL import Image, ImageDraw
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as shp_transform

from .strings import (
    NL_BOUNDS_WGS84,
    PDOK_BRT_WMTS_TEMPLATE,
    WEB_MERCATOR_HALF_EXTENT,
    WMTS_TILE_PX,
)

logger = logging.getLogger(__name__)


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


def _draw_overlay_polygon(
    draw: ImageDraw.ImageDraw,
    geom_3857,
    bbox_3857: Tuple[float, float, float, float],
    size: Tuple[int, int],
    fill_rgba: Tuple[int, int, int, int],
    stroke_rgba: Tuple[int, int, int, int],
    stroke_w: int,
) -> None:
    for ring in _outer_rings(geom_3857):
        pts = [_world_to_pixel(x, y, bbox_3857, size) for (x, y, *_) in ring]
        if len(pts) >= 3:
            try:
                draw.polygon(pts, fill=fill_rgba, outline=stroke_rgba, width=stroke_w)
            except Exception:
                continue


def _draw_overlay_point(
    draw: ImageDraw.ImageDraw,
    geom_3857,
    bbox_3857: Tuple[float, float, float, float],
    size: Tuple[int, int],
    radius: float,
    fill_rgba: Tuple[int, int, int, int],
    stroke_rgba: Tuple[int, int, int, int],
    stroke_w: int,
) -> None:
    if geom_3857.geom_type == "Point":
        coords = [(geom_3857.x, geom_3857.y)]
    elif geom_3857.geom_type == "MultiPoint":
        coords = [(p.x, p.y) for p in geom_3857.geoms]
    else:
        try:
            rep = geom_3857.representative_point()
            coords = [(rep.x, rep.y)]
        except Exception:
            return
    for x_m, y_m in coords:
        px, py = _world_to_pixel(x_m, y_m, bbox_3857, size)
        draw.ellipse(
            [(px - radius, py - radius), (px + radius, py + radius)],
            fill=fill_rgba,
            outline=stroke_rgba,
            width=stroke_w,
        )


async def _render_layer_overlay_map(
    client: httpx.AsyncClient,
    bbox_wgs84: Tuple[float, float, float, float],
    area_geom_wgs84,
    area_color_hex: str,
    features: List[Dict[str, Any]],
    style: Dict[str, Any],
    width_px: int = 1700,
    height_px: int = 1100,
) -> Optional[bytes]:
    """
    Basemap + the given features drawn in the supplied style + the wijk/buurt
    outline on top. Returns PNG bytes matching the zoom-map size, or None on
    failure (e.g. basemap fetch fails).
    """
    try:
        bbox_3857 = _bbox_to_3857(_pad_bbox(bbox_wgs84, 0.10))
        bbox_3857 = _fit_bbox_to_aspect(bbox_3857, width_px, height_px)
        base = await _fetch_basemap_image(client, bbox_3857, width_px, height_px)
        size = base.size

        overlay = Image.new("RGBA", size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay, "RGBA")

        alpha_byte = max(0, min(255, int(round(float(style.get("alpha", 1.0)) * 255))))
        fill_rgba = _hex_to_rgb(style.get("fill", "#000000")) + (alpha_byte,)
        stroke_rgba = _hex_to_rgb(style.get("stroke", "#000000")) + (255,)
        stroke_w = max(1, int(round(float(style.get("stroke_width", 1.0)))))
        is_point = style.get("geometry") == "point"
        radius = float(style.get("radius_px") or 2.0)

        for feat in features:
            if not isinstance(feat, dict):
                continue
            geom_raw = feat.get("geometry")
            if not geom_raw:
                continue
            try:
                g = shape(geom_raw)
                if g.is_empty:
                    continue
                g_3857 = _project_to_3857(g)
            except Exception:
                continue

            if is_point:
                _draw_overlay_point(
                    draw, g_3857, bbox_3857, size, radius, fill_rgba, stroke_rgba, stroke_w
                )
            else:
                _draw_overlay_polygon(
                    draw, g_3857, bbox_3857, size, fill_rgba, stroke_rgba, stroke_w
                )

        composed = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
        with_outline = _draw_boundary_overlay(
            composed, area_geom_wgs84, bbox_3857, area_color_hex, line_width=5
        )
        buf = io.BytesIO()
        with_outline.save(buf, format="PNG")
        return buf.getvalue()
    except Exception as exc:
        logger.warning("layer overlay map render failed: %s", exc)
        return None
