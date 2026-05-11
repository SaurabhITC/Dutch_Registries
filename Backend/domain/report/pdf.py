from __future__ import annotations

import io
import logging
from datetime import datetime
from typing import Any, Dict, List, Tuple

import httpx
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

from Backend.domain.admin import get_area_feature
from Backend.domain.geometry import bbox_from_feature, feature_assigned_to_area
from Backend.pdok import BAG_COLLECTION_URLS, BAG_PAND_URL, fetch_all_features

from .charts import (
    render_bouwjaar_chart,
    render_gebruiksdoel_chart,
    render_oppervlakte_chart,
)
from .maps import _project_to_28992, _render_overview_map, _render_zoom_map
from .strings import (
    AREA_OUTLINE_COLORS,
    BAG_LAYER_DISPLAY,
    THEME_ACCENT,
    THEME_BORDER,
    THEME_HEADING,
    THEME_SECONDARY,
    THEME_SUBTLE_BG,
    THEME_TEXT,
    _t,
)

logger = logging.getLogger(__name__)


def _bag_label(key: str, lang: str) -> str:
    info = BAG_LAYER_DISPLAY.get(key, {})
    if lang == "en":
        return info.get("label_en") or key
    return info.get("label_nl") or key


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
        if feature_assigned_to_area(f, area_feature)
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
