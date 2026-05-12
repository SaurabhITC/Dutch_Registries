from __future__ import annotations

import io
from typing import Any, Dict, List, Optional, Tuple

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .strings import (
    BOUWJAAR_BUCKETS,
    GEBRUIKSDOEL_CATEGORIES,
    GEBRUIKSDOEL_LABELS,
    OPPERVLAKTE_BUCKETS,
    THEME_BORDER,
    THEME_HEADING,
    THEME_SECONDARY,
    _t,
)

# Per-category gebruiksdoel colors — must match VIZ_PALETTE_GEBRUIKSDOEL
# in Frontend/app.js so PDF and on-screen visualization stay aligned.
GEBRUIKSDOEL_COLORS: Dict[str, str] = {
    "woonfunctie":             "#fde047",
    "winkelfunctie":           "#ef4444",
    "kantoorfunctie":          "#7dd3fc",
    "industriefunctie":        "#a855f7",
    "onderwijsfunctie":        "#1d4ed8",
    "gezondheidszorgfunctie":  "#ec4899",
    "sportfunctie":            "#86efac",
    "logiesfunctie":           "#fb923c",
    "bijeenkomstfunctie":      "#06b6d4",
    "celfunctie":              "#78350f",
    "overige gebruiksfunctie": "#9ca3af",
}


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
    # Sort by count descending, but pin 'overige gebruiksfunctie' to the end
    # regardless of count, matching frontend aggregateGebruiksdoel behavior.
    entries.sort(
        key=lambda e: (e[0] == "overige gebruiksfunctie", -e[1])
    )
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
    colors: Optional[List[str]] = None,
) -> bytes:
    fig, ax = plt.subplots(figsize=(8, 4.4), dpi=300)
    fig.patch.set_facecolor("white")
    n = max(len(values), 1)
    if colors is None:
        cmap = plt.get_cmap(cmap_name)
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
        cmap_name="Spectral_r",
        rotate_x=45,
    )


def render_gebruiksdoel_chart(features: List[Dict[str, Any]], lang: str) -> Optional[bytes]:
    entries = aggregate_gebruiksdoel(features)
    if not entries:
        return None
    labels = [GEBRUIKSDOEL_LABELS.get(k, {}).get(lang if lang in ("nl", "en") else "nl", k) for (k, _) in entries]
    values = [v for (_, v) in entries]
    colors = [GEBRUIKSDOEL_COLORS.get(k, "#9ca3af") for (k, _) in entries]
    return _render_bar_chart(
        labels=labels,
        values=values,
        title=_t(lang, "chart_gebruiksdoel_title"),
        xlabel=_t(lang, "axis_count"),
        ylabel="",
        cmap_name="Set2",
        horizontal=True,
        colors=colors,
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
