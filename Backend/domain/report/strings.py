from __future__ import annotations

from typing import Any, Dict, List, Tuple


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
