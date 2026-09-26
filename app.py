#!/usr/bin/env python3
"""Building LCA — Statinio gyvavimo ciklo vertinimo sistema.

Open-source building lifecycle assessment environmental impact modelling.
Built with FastHTML + Plotly.
"""

from __future__ import annotations

import json
import os
from collections import defaultdict

from fasthtml.common import *

# ---------------------------------------------------------------------------
# Load demo data
# ---------------------------------------------------------------------------

DATA_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "demo_buildings.json")

with open(DATA_PATH, encoding="utf-8") as f:
    DEMO = json.load(f)

BUILDINGS = {b["id"]: b for b in DEMO["buildings"]}
MATERIALS = {m["id"]: m for m in DEMO["materials"]}
BUILDING_MATERIALS = DEMO["building_materials"]
LCA_INDICATORS = DEMO["lca_indicators"]

# Pre-index indicators by building
INDICATORS_BY_BUILDING: dict[int, list[dict]] = defaultdict(list)
for ind in LCA_INDICATORS:
    INDICATORS_BY_BUILDING[ind["building_id"]].append(ind)

# Pre-index building materials by building
BM_BY_BUILDING: dict[int, list[dict]] = defaultdict(list)
for bm in BUILDING_MATERIALS:
    BM_BY_BUILDING[bm["building_id"]].append(bm)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

INDICATOR_LABELS = {
    "GWP": "Visuotinio atsilimo potencialas / Global Warming Potential",
    "ODP": "Ozono sluoksnio ardymo pot. / Ozone Depletion Potential",
    "AP": "Rukstinejimo potencialas / Acidification Potential",
    "EP": "Eutrofikacijos potencialas / Eutrophication Potential",
    "PENRT": "Neatsinaujinanciu ist. energija / Primary Energy Non-Renewable",
    "PERT": "Atsinaujinanciu ist. energija / Primary Energy Renewable",
}

INDICATOR_UNITS = {
    "GWP": "kg CO2 eq.",
    "ODP": "kg CFC-11 eq.",
    "AP": "kg SO2 eq.",
    "EP": "kg PO4 eq.",
    "PENRT": "MJ",
    "PERT": "MJ",
}

INDICATOR_COLORS = {
    "GWP": "#dc2626",
    "ODP": "#7c3aed",
    "AP": "#d97706",
    "EP": "#059669",
    "PENRT": "#2563eb",
    "PERT": "#16a34a",
}

PHASE_LABELS = {
    "A1-A3": "Gamyba / Production",
    "A4-A5": "Statyba / Construction",
    "B1-B7": "Naudojimas / Use",
    "C1-C4": "Ekspl. pabaiga / End of life",
    "D": "Pakart. naudojimas / Recovery",
}

PHASE_COLORS = {
    "A1-A3": "#2563eb",
    "A4-A5": "#7c3aed",
    "B1-B7": "#d97706",
    "C1-C4": "#dc2626",
    "D": "#16a34a",
}

TYPE_LABELS = {
    "gyvenamasis": "Gyvenamasis / Residential",
    "komercinis": "Komercinis / Commercial",
    "pramoninis": "Pramoninis / Industrial",
    "viesasis": "Viesasis / Public",
    "mišrus": "Misrus / Mixed-use",
}

CATEGORY_LABELS = {
    "konstrukcinis": "Konstrukcinis / Structural",
    "izoliacija": "Izoliacija / Insulation",
    "apdaila": "Apdaila / Finishing",
    "stogo_danga": "Stogo danga / Roofing",
    "langai_durys": "Langai ir durys / Windows & doors",
    "inzinerine_sistema": "Inzinerine sistema / MEP",
    "pamatai": "Pamatai / Foundations",
    "kita": "Kita / Other",
}

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app, rt = fast_app(
    hdrs=[
        Link(rel="stylesheet", href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"),
        Script(src="https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.0/plotly.min.js"),
        Style("""
            :root { --bs-primary: #16a34a; }
            body { background: #f0fdf4; }
            .navbar { background: linear-gradient(135deg, #14532d 0%, #16a34a 100%); }
            .stat-card { border: none; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); transition: transform 0.2s; }
            .stat-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
            .stat-number { font-size: 2rem; font-weight: 700; }
            .table th { font-weight: 600; font-size: 0.85rem; text-transform: uppercase; color: #64748b; }
            .phase-badge { font-size: 0.75rem; padding: 2px 8px; border-radius: 4px; color: white; }
            .indicator-card { border-left: 4px solid; border-radius: 8px; }
            footer { color: #94a3b8; font-size: 0.85rem; }
            .plotly-chart { width: 100%; min-height: 400px; }
        """),
    ],
    live=True,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def navbar():
    return Nav(cls="navbar navbar-expand-lg navbar-dark mb-4 px-4 py-3")(
        A("Building LCA", href="/", cls="navbar-brand fw-bold fs-4"),
        Div(cls="navbar-nav ms-auto d-flex flex-row gap-3")(
            A("Suvestine", href="/", cls="nav-link text-white"),
            A("Pastatai", href="/buildings", cls="nav-link text-white"),
            A("Medziagos", href="/materials", cls="nav-link text-white"),
            A("Rodikliai", href="/indicators", cls="nav-link text-white"),
        ),
    )


def page_footer():
    return Footer(cls="text-center py-4 mt-5")(
        P("Building LCA v0.1.0 | Statinio gyvavimo ciklo vertinimo sistema | MIT licencija"),
        P("Predictive Labs"),
    )


def layout(*children, title="Building LCA"):
    return Title(title), Main(cls="container-fluid px-4")(navbar(), *children, page_footer())


def phase_badge(phase: str):
    color = PHASE_COLORS.get(phase, "#6b7280")
    return Span(phase, cls="phase-badge", style=f"background:{color}")


def fmt_number(val: float, decimals: int = 2) -> str:
    """Format a number with thousands separator."""
    if abs(val) >= 1000:
        return f"{val:,.{decimals}f}"
    return f"{val:.{decimals}f}"


def get_building_total_gwp(building_id: int) -> float:
    """Sum GWP across all phases for a building."""
    return sum(
        ind["value"]
        for ind in INDICATORS_BY_BUILDING[building_id]
        if ind["indicator_type"] == "GWP"
    )


def get_building_totals(building_id: int) -> dict[str, float]:
    """Sum all indicators across all phases for a building."""
    totals: dict[str, float] = defaultdict(float)
    for ind in INDICATORS_BY_BUILDING[building_id]:
        totals[ind["indicator_type"]] += ind["value"]
    return dict(totals)


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------


@rt("/")
def get():
    total_buildings = len(BUILDINGS)
    total_area = sum(b["area_m2"] for b in BUILDINGS.values())
    total_materials = len(MATERIALS)

    # Aggregate GWP
    total_gwp = sum(ind["value"] for ind in LCA_INDICATORS if ind["indicator_type"] == "GWP")
    avg_gwp_per_m2 = total_gwp / total_area if total_area else 0

    # Type distribution
    type_counts: dict[str, int] = defaultdict(int)
    for b in BUILDINGS.values():
        type_counts[b["building_type"]] += 1

    # GWP by building type
    gwp_by_type: dict[str, float] = defaultdict(float)
    area_by_type: dict[str, float] = defaultdict(float)
    for b in BUILDINGS.values():
        gwp_by_type[b["building_type"]] += get_building_total_gwp(b["id"])
        area_by_type[b["building_type"]] += b["area_m2"]

    gwp_per_m2_by_type = {
        t: gwp_by_type[t] / area_by_type[t] if area_by_type[t] else 0
        for t in gwp_by_type
    }

    # GWP by phase (aggregate)
    gwp_by_phase: dict[str, float] = defaultdict(float)
    for ind in LCA_INDICATORS:
        if ind["indicator_type"] == "GWP":
            gwp_by_phase[ind["lifecycle_phase"]] += ind["value"]

    # Top 5 buildings by GWP
    building_gwps = [(b["id"], b["name"], get_building_total_gwp(b["id"])) for b in BUILDINGS.values()]
    building_gwps.sort(key=lambda x: x[2], reverse=True)
    top5 = building_gwps[:5]

    # Plotly chart data: GWP by building type (bar)
    type_chart_data = json.dumps({
        "data": [{
            "x": [TYPE_LABELS.get(t, t) for t in gwp_per_m2_by_type],
            "y": [round(v, 2) for v in gwp_per_m2_by_type.values()],
            "type": "bar",
            "marker": {"color": "#16a34a"},
            "text": [f"{v:.1f}" for v in gwp_per_m2_by_type.values()],
            "textposition": "outside",
        }],
        "layout": {
            "title": "GWP pagal pastato tipa / GWP by Building Type (kg CO2 eq./m2)",
            "yaxis": {"title": "kg CO2 eq. / m2"},
            "margin": {"t": 40, "b": 80},
            "height": 400,
        },
    })

    # Plotly chart data: GWP by phase (pie)
    phase_chart_data = json.dumps({
        "data": [{
            "labels": [PHASE_LABELS.get(p, p) for p in gwp_by_phase],
            "values": [round(abs(v), 2) for v in gwp_by_phase.values()],
            "type": "pie",
            "marker": {"colors": [PHASE_COLORS.get(p, "#6b7280") for p in gwp_by_phase]},
            "textinfo": "label+percent",
            "hole": 0.4,
        }],
        "layout": {
            "title": "GWP pagal gyvavimo ciklo faze / GWP by Lifecycle Phase",
            "margin": {"t": 40, "b": 20},
            "height": 400,
        },
    })

    return layout(
        # Stat cards
        Div(cls="row g-3 mb-4")(
            Div(cls="col-md-3")(
                Div(cls="card stat-card p-3")(
                    Div("Pastatai / Buildings", cls="text-muted small"),
                    Div(str(total_buildings), cls="stat-number text-primary"),
                    Div(f"Plotas: {fmt_number(total_area, 0)} m2", cls="text-muted small"),
                )
            ),
            Div(cls="col-md-3")(
                Div(cls="card stat-card p-3")(
                    Div("Medziagos / Materials", cls="text-muted small"),
                    Div(str(total_materials), cls="stat-number text-info"),
                    Div(f"Priskyrima: {len(BUILDING_MATERIALS)}", cls="text-muted small"),
                )
            ),
            Div(cls="col-md-3")(
                Div(cls="card stat-card p-3")(
                    Div("Bendras GWP / Total GWP", cls="text-muted small"),
                    Div(f"{fmt_number(total_gwp, 0)}", cls="stat-number text-danger"),
                    Div("kg CO2 eq.", cls="text-muted small"),
                )
            ),
            Div(cls="col-md-3")(
                Div(cls="card stat-card p-3")(
                    Div("Vid. GWP/m2 / Avg GWP/m2", cls="text-muted small"),
                    Div(f"{fmt_number(avg_gwp_per_m2, 1)}", cls="stat-number text-warning"),
                    Div("kg CO2 eq. / m2", cls="text-muted small"),
                )
            ),
        ),
        # Charts row
        Div(cls="row g-3 mb-4")(
            Div(cls="col-md-6")(
                Div(cls="card p-3")(
                    Div(id="typeChart", cls="plotly-chart"),
                )
            ),
            Div(cls="col-md-6")(
                Div(cls="card p-3")(
                    Div(id="phaseChart", cls="plotly-chart"),
                )
            ),
        ),
        # Top buildings by GWP
        Div(cls="row g-3 mb-4")(
            Div(cls="col-md-8")(
                Div(cls="card p-3")(
                    H5("Didziausio poveikio pastatai / Highest Impact Buildings", cls="mb-3"),
                    Table(cls="table table-sm table-hover")(
                        Thead(Tr(Th("Pastatas / Building"), Th("Miestas"), Th("Plotas (m2)"), Th("GWP (kg CO2 eq.)"), Th("GWP/m2"))),
                        Tbody(
                            *[
                                Tr(
                                    Td(A(BUILDINGS[bid]["name"], href=f"/building/{bid}")),
                                    Td(BUILDINGS[bid]["city"]),
                                    Td(fmt_number(BUILDINGS[bid]["area_m2"], 0)),
                                    Td(fmt_number(gwp, 0), cls="text-danger fw-bold"),
                                    Td(fmt_number(gwp / BUILDINGS[bid]["area_m2"], 1)),
                                )
                                for bid, name, gwp in top5
                            ]
                        ),
                    ),
                    A("Visi pastatai / All buildings ->", href="/buildings", cls="btn btn-sm btn-outline-primary"),
                )
            ),
            Div(cls="col-md-4")(
                Div(cls="card p-3")(
                    H5("Pastatu tipai / Building Types", cls="mb-3"),
                    Table(cls="table table-sm")(
                        Thead(Tr(Th("Tipas / Type"), Th("Kiekis / Count"))),
                        Tbody(
                            *[
                                Tr(
                                    Td(TYPE_LABELS.get(t, t)),
                                    Td(str(c)),
                                )
                                for t, c in sorted(type_counts.items(), key=lambda x: -x[1])
                            ]
                        ),
                    ),
                )
            ),
        ),
        # Chart init scripts
        Script(f"""
            var typeChartData = {type_chart_data};
            var phaseChartData = {phase_chart_data};
            Plotly.newPlot('typeChart', typeChartData.data, typeChartData.layout, {{responsive: true}});
            Plotly.newPlot('phaseChart', phaseChartData.data, phaseChartData.layout, {{responsive: true}});
        """),
        title="Building LCA | Suvestine",
    )


# ---------------------------------------------------------------------------
# Buildings list
# ---------------------------------------------------------------------------


@rt("/buildings")
def get():
    buildings = sorted(BUILDINGS.values(), key=lambda b: b["name"])

    rows = []
    for b in buildings:
        gwp = get_building_total_gwp(b["id"])
        gwp_m2 = gwp / b["area_m2"] if b["area_m2"] else 0
        rows.append(
            Tr(
                Td(A(b["name"], href=f"/building/{b['id']}")),
                Td(TYPE_LABELS.get(b["building_type"], b["building_type"])),
                Td(b["city"]),
                Td(fmt_number(b["area_m2"], 0)),
                Td(str(b["floors"])),
                Td(str(b["construction_year"])),
                Td(fmt_number(gwp, 0), cls="text-danger"),
                Td(fmt_number(gwp_m2, 1)),
            )
        )

    return layout(
        H3("Pastatai / Buildings", cls="mb-3"),
        Div(cls="card p-3")(
            P(f"Is viso: {len(buildings)} pastatu / Total: {len(buildings)} buildings", cls="text-muted small mb-2"),
            Table(cls="table table-sm table-hover")(
                Thead(
                    Tr(
                        Th("Pavadinimas / Name"),
                        Th("Tipas / Type"),
                        Th("Miestas / City"),
                        Th("Plotas (m2)"),
                        Th("Aukstas / Floors"),
                        Th("Statybos metai / Year"),
                        Th("GWP (kg CO2 eq.)"),
                        Th("GWP/m2"),
                    )
                ),
                Tbody(*rows),
            ),
        ),
        title="Building LCA | Pastatai",
    )


# ---------------------------------------------------------------------------
# Building detail
# ---------------------------------------------------------------------------


@rt("/building/{building_id}")
def get(building_id: int):
    b = BUILDINGS.get(building_id)
    if not b:
        return layout(H3("Pastatas nerastas / Building not found"), title="Building LCA | Klaida")

    indicators = INDICATORS_BY_BUILDING[building_id]
    bm_list = BM_BY_BUILDING[building_id]
    totals = get_building_totals(building_id)

    # Indicators by phase for stacked bar chart
    phase_data: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for ind in indicators:
        phase_data[ind["indicator_type"]][ind["lifecycle_phase"]] = ind["value"]

    phases = ["A1-A3", "A4-A5", "B1-B7", "C1-C4", "D"]
    indicators_list = ["GWP", "ODP", "AP", "EP", "PENRT", "PERT"]

    # GWP breakdown bar chart by phase
    gwp_phases = {p: phase_data["GWP"].get(p, 0) for p in phases}

    gwp_bar_data = json.dumps({
        "data": [{
            "x": [PHASE_LABELS.get(p, p) for p in phases],
            "y": [round(gwp_phases[p], 2) for p in phases],
            "type": "bar",
            "marker": {"color": [PHASE_COLORS.get(p, "#6b7280") for p in phases]},
            "text": [f"{gwp_phases[p]:,.0f}" for p in phases],
            "textposition": "outside",
        }],
        "layout": {
            "title": "GWP pagal gyvavimo ciklo faze / GWP by Lifecycle Phase",
            "yaxis": {"title": "kg CO2 eq."},
            "margin": {"t": 40, "b": 100},
            "height": 400,
        },
    })

    # All indicators radar / comparison (normalized to percentage of total)
    all_ind_data = json.dumps({
        "data": [
            {
                "x": [ind_type for ind_type in indicators_list],
                "y": [round(totals.get(ind_type, 0) / b["area_m2"], 4) for ind_type in indicators_list],
                "type": "bar",
                "marker": {"color": [INDICATOR_COLORS.get(i, "#6b7280") for i in indicators_list]},
                "text": [f"{totals.get(i, 0) / b['area_m2']:.2f}" for i in indicators_list],
                "textposition": "outside",
            }
        ],
        "layout": {
            "title": "Visi rodikliai per m2 / All Indicators per m2",
            "yaxis": {"title": "Verte / Value per m2"},
            "margin": {"t": 40, "b": 40},
            "height": 400,
        },
    })

    return layout(
        # Breadcrumb
        Nav(Ol(cls="breadcrumb")(
            Li(cls="breadcrumb-item")(A("Pastatai", href="/buildings")),
            Li(b["name"], cls="breadcrumb-item active"),
        )),
        # Header card
        Div(cls="card p-4 mb-3")(
            Div(cls="d-flex justify-content-between align-items-start")(
                Div(
                    H3(b["name"], cls="mb-1"),
                    P(f"{b.get('address', '')} | {b['city']}", cls="text-muted mb-2"),
                ),
                Div(cls="text-end")(
                    Span(TYPE_LABELS.get(b["building_type"], b["building_type"]),
                         cls="badge bg-primary fs-6"),
                ),
            ),
            Hr(),
            Div(cls="row")(
                Div(cls="col-md-2")(Strong("Plotas: "), f"{fmt_number(b['area_m2'], 0)} m2"),
                Div(cls="col-md-2")(Strong("Aukstas: "), str(b["floors"])),
                Div(cls="col-md-2")(Strong("Metai: "), str(b["construction_year"])),
                Div(cls="col-md-3")(Strong("GWP: "), Span(f"{fmt_number(totals.get('GWP', 0), 0)} kg CO2 eq.", cls="text-danger fw-bold")),
                Div(cls="col-md-3")(Strong("GWP/m2: "), f"{fmt_number(totals.get('GWP', 0) / b['area_m2'], 1)} kg CO2 eq./m2"),
            ),
        ),
        # Indicator summary cards
        Div(cls="row g-3 mb-4")(
            *[
                Div(cls="col-md-2")(
                    Div(cls="card indicator-card p-3", style=f"border-left-color:{INDICATOR_COLORS.get(ind, '#6b7280')}")(
                        Div(ind, cls="fw-bold"),
                        Div(fmt_number(totals.get(ind, 0), 2), cls="fs-5 fw-bold"),
                        Div(INDICATOR_UNITS[ind], cls="text-muted small"),
                    )
                )
                for ind in indicators_list
            ]
        ),
        # Charts
        Div(cls="row g-3 mb-4")(
            Div(cls="col-md-6")(
                Div(cls="card p-3")(
                    Div(id="gwpPhaseChart", cls="plotly-chart"),
                )
            ),
            Div(cls="col-md-6")(
                Div(cls="card p-3")(
                    Div(id="allIndChart", cls="plotly-chart"),
                )
            ),
        ),
        # Lifecycle phase breakdown table
        Div(cls="card p-3 mb-3")(
            H5("Rodikliai pagal gyvavimo ciklo fazes / Indicators by Lifecycle Phase", cls="mb-3"),
            Table(cls="table table-sm")(
                Thead(
                    Tr(
                        Th("Rodiklis / Indicator"),
                        *[Th(phase_badge(p), " ", Span(PHASE_LABELS.get(p, p).split("/")[0].strip(), cls="small")) for p in phases],
                        Th("Viso / Total"),
                    )
                ),
                Tbody(
                    *[
                        Tr(
                            Td(Strong(ind)),
                            *[Td(fmt_number(phase_data[ind].get(p, 0), 2)) for p in phases],
                            Td(Strong(fmt_number(totals.get(ind, 0), 2))),
                        )
                        for ind in indicators_list
                    ]
                ),
            ),
        ),
        # Building materials table
        Div(cls="card p-3 mb-3")(
            H5(f"Medziagos ({len(bm_list)}) / Materials", cls="mb-3"),
            Table(cls="table table-sm table-hover")(
                Thead(Tr(Th("Medziaga / Material"), Th("Kiekis / Quantity"), Th("Vienetas / Unit"), Th("Faze / Phase"))),
                Tbody(
                    *[
                        Tr(
                            Td(bm["material_name"]),
                            Td(fmt_number(bm["quantity"], 2)),
                            Td(bm["unit"]),
                            Td(phase_badge(bm["lifecycle_phase"])),
                        )
                        for bm in bm_list
                    ]
                ),
            ),
        ),
        # Chart init
        Script(f"""
            var gwpBarData = {gwp_bar_data};
            var allIndData = {all_ind_data};
            Plotly.newPlot('gwpPhaseChart', gwpBarData.data, gwpBarData.layout, {{responsive: true}});
            Plotly.newPlot('allIndChart', allIndData.data, allIndData.layout, {{responsive: true}});
        """),
        title=f"Building LCA | {b['name']}",
    )


# ---------------------------------------------------------------------------
# Materials database
# ---------------------------------------------------------------------------


@rt("/materials")
def get():
    materials = sorted(MATERIALS.values(), key=lambda m: m["name"])

    return layout(
        H3("Medziagu duomenu baze / Materials Database", cls="mb-3"),
        Div(cls="card p-3")(
            P(f"Is viso: {len(materials)} medziagu / Total: {len(materials)} materials", cls="text-muted small mb-2"),
            Div(cls="table-responsive")(
                Table(cls="table table-sm table-hover")(
                    Thead(
                        Tr(
                            Th("Pavadinimas / Name"),
                            Th("Kategorija / Category"),
                            Th("Tankis / Density (kg/m3)"),
                            Th("GWP"),
                            Th("ODP"),
                            Th("AP"),
                            Th("EP"),
                            Th("PENRT"),
                            Th("PERT"),
                            Th("Saltinis / Source"),
                        )
                    ),
                    Tbody(
                        *[
                            Tr(
                                Td(Strong(m["name"])),
                                Td(CATEGORY_LABELS.get(m["category"], m["category"])),
                                Td(str(m["density_kg_m3"]) if m["density_kg_m3"] else "-"),
                                Td(f"{m['gwp_per_unit']:.4f}"),
                                Td(f"{m['odp_per_unit']:.2e}"),
                                Td(f"{m['ap_per_unit']:.6f}"),
                                Td(f"{m['ep_per_unit']:.6f}"),
                                Td(f"{m['penrt_per_unit']:.2f}"),
                                Td(f"{m['pert_per_unit']:.2f}"),
                                Td(Code(m["source"]), cls="small"),
                            )
                            for m in materials
                        ]
                    ),
                ),
            ),
        ),
        # Material category distribution chart
        Div(cls="card p-3 mt-3")(
            Div(id="matCategoryChart", cls="plotly-chart"),
        ),
        Script(f"var matChartData = {json.dumps(_materials_chart_data())};"),
        Script("""
            Plotly.newPlot('matCategoryChart', matChartData.data, matChartData.layout, {responsive: true});
        """),
        title="Building LCA | Medziagos",
    )


def _materials_chart_data():
    """Generate materials comparison chart data."""
    materials = sorted(MATERIALS.values(), key=lambda m: m["gwp_per_unit"], reverse=True)
    return {
        "data": [{
            "x": [m["name"] for m in materials],
            "y": [m["gwp_per_unit"] for m in materials],
            "type": "bar",
            "marker": {"color": "#dc2626"},
            "name": "GWP",
        }],
        "layout": {
            "title": "GWP koeficientai pagal medziaga / GWP Coefficients by Material (kg CO2 eq. per unit)",
            "yaxis": {"title": "kg CO2 eq. / vienetas"},
            "xaxis": {"tickangle": -45},
            "margin": {"t": 40, "b": 160},
            "height": 450,
        },
    }


# ---------------------------------------------------------------------------
# Indicator comparison charts
# ---------------------------------------------------------------------------


@rt("/indicators")
def get():
    indicators_list = ["GWP", "ODP", "AP", "EP", "PENRT", "PERT"]
    phases = ["A1-A3", "A4-A5", "B1-B7", "C1-C4", "D"]

    # Aggregate by building for comparison
    building_names = []
    building_gwp_values = []
    building_areas = []
    for b in sorted(BUILDINGS.values(), key=lambda x: x["name"]):
        building_names.append(b["name"][:30])
        total_gwp = get_building_total_gwp(b["id"])
        building_gwp_values.append(round(total_gwp / b["area_m2"], 2))
        building_areas.append(b["area_m2"])

    # Building comparison chart
    comparison_data = json.dumps({
        "data": [{
            "x": building_names,
            "y": building_gwp_values,
            "type": "bar",
            "marker": {"color": building_gwp_values, "colorscale": "RdYlGn", "reversescale": True},
            "text": [f"{v:.1f}" for v in building_gwp_values],
            "textposition": "outside",
        }],
        "layout": {
            "title": "GWP palyginimas pagal pastata / GWP Comparison by Building (kg CO2 eq./m2)",
            "yaxis": {"title": "kg CO2 eq. / m2"},
            "xaxis": {"tickangle": -45},
            "margin": {"t": 40, "b": 180},
            "height": 500,
        },
    })

    # Stacked bar: all indicators by phase (aggregate)
    traces = []
    for phase in phases:
        phase_gwps = []
        for b in sorted(BUILDINGS.values(), key=lambda x: x["name"]):
            val = sum(
                ind["value"]
                for ind in INDICATORS_BY_BUILDING[b["id"]]
                if ind["indicator_type"] == "GWP" and ind["lifecycle_phase"] == phase
            )
            phase_gwps.append(round(val / b["area_m2"], 2))
        traces.append({
            "x": building_names,
            "y": phase_gwps,
            "name": f"{phase} {PHASE_LABELS.get(phase, '').split('/')[0].strip()}",
            "type": "bar",
            "marker": {"color": PHASE_COLORS.get(phase, "#6b7280")},
        })

    stacked_data = json.dumps({
        "data": traces,
        "layout": {
            "title": "GWP pagal fazes ir pastatus / GWP by Phase and Building (kg CO2 eq./m2)",
            "barmode": "stack",
            "yaxis": {"title": "kg CO2 eq. / m2"},
            "xaxis": {"tickangle": -45},
            "margin": {"t": 40, "b": 180},
            "height": 500,
            "legend": {"orientation": "h", "y": -0.3},
        },
    })

    # Aggregate indicator totals table
    agg: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for ind in LCA_INDICATORS:
        agg[ind["indicator_type"]][ind["lifecycle_phase"]] += ind["value"]

    return layout(
        H3("Aplinkos poveikio rodikliai / Environmental Impact Indicators", cls="mb-3"),
        # Summary cards
        Div(cls="row g-3 mb-4")(
            *[
                Div(cls="col-md-2")(
                    Div(cls="card indicator-card p-3", style=f"border-left-color:{INDICATOR_COLORS.get(ind, '#6b7280')}")(
                        Div(cls="d-flex justify-content-between")(
                            Div(ind, cls="fw-bold"),
                        ),
                        Div(INDICATOR_LABELS.get(ind, ind).split("/")[0].strip(), cls="text-muted small"),
                        Div(fmt_number(sum(agg[ind].values()), 0), cls="fs-5 fw-bold mt-1"),
                        Div(INDICATOR_UNITS[ind], cls="text-muted small"),
                    )
                )
                for ind in indicators_list
            ]
        ),
        # Charts
        Div(cls="card p-3 mb-3")(
            Div(id="comparisonChart", cls="plotly-chart"),
        ),
        Div(cls="card p-3 mb-3")(
            Div(id="stackedChart", cls="plotly-chart"),
        ),
        # Aggregate table
        Div(cls="card p-3 mb-3")(
            H5("Agreguoti rodikliai pagal fazes / Aggregate Indicators by Phase", cls="mb-3"),
            Table(cls="table table-sm")(
                Thead(
                    Tr(
                        Th("Rodiklis / Indicator"),
                        Th("Vienetas / Unit"),
                        *[Th(phase_badge(p)) for p in phases],
                        Th("Viso / Total"),
                    )
                ),
                Tbody(
                    *[
                        Tr(
                            Td(Strong(ind)),
                            Td(INDICATOR_UNITS[ind]),
                            *[Td(fmt_number(agg[ind].get(p, 0), 2)) for p in phases],
                            Td(Strong(fmt_number(sum(agg[ind].values()), 2))),
                        )
                        for ind in indicators_list
                    ]
                ),
            ),
        ),
        # Chart init
        Script(f"""
            var comparisonData = {comparison_data};
            var stackedData = {stacked_data};
            Plotly.newPlot('comparisonChart', comparisonData.data, comparisonData.layout, {{responsive: true}});
            Plotly.newPlot('stackedChart', stackedData.data, stackedData.layout, {{responsive: true}});
        """),
        title="Building LCA | Rodikliai",
    )


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    serve(port=5001)
