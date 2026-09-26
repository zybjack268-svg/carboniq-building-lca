#!/usr/bin/env python3
"""Generate ~20 demo buildings with materials and LCA indicators.

Naudojimas / Usage:
    python data/generate_demo.py

Generates demo_buildings.json with synthetic building LCA data.
"""

from __future__ import annotations

import json
import os
import random
from datetime import date, timedelta

random.seed(42)

# ---------------------------------------------------------------------------
# Reference data
# ---------------------------------------------------------------------------

BUILDING_TYPES = ["gyvenamasis", "komercinis", "pramoninis", "viesasis", "mišrus"]

CITIES = [
    "Vilnius", "Kaunas", "Klaipeda", "Siauliai", "Panevezys",
    "Alytus", "Marijampole", "Utena", "Kedainiai", "Telsiai",
]

BUILDING_NAMES = [
    ("Zalgirio g. 90 daugiabutis", "gyvenamasis", "Vilnius", 4200, 9, 2024),
    ("Konstitucijos pr. 7 biuru centras", "komercinis", "Vilnius", 12500, 15, 2023),
    ("Taikos pr. 88 prekybos centras", "komercinis", "Klaipeda", 8500, 3, 2022),
    ("Laisves al. 40 visuomeninis pastatas", "viesasis", "Kaunas", 3200, 4, 2025),
    ("Pramonininku g. 12 sandelis", "pramoninis", "Siauliai", 6000, 1, 2021),
    ("Savanoriu pr. 180 gyvenamasis kompleksas", "gyvenamasis", "Vilnius", 7800, 12, 2024),
    ("Nemuno g. 5 mokykla", "viesasis", "Panevezys", 2800, 3, 2020),
    ("Vytauto g. 22 mišrios paskirties pastatas", "mišrus", "Kaunas", 5400, 6, 2023),
    ("Klaipedos g. 15 ligonine", "viesasis", "Siauliai", 9200, 5, 2019),
    ("Gedimino pr. 1 biuru pastatas", "komercinis", "Vilnius", 4800, 8, 2025),
    ("Draugystes g. 19 sporto hale", "viesasis", "Kaunas", 3600, 2, 2024),
    ("Baltijos pr. 120 logistikos centras", "pramoninis", "Klaipeda", 15000, 2, 2022),
    ("Ukmerges g. 280 daugiabutis", "gyvenamasis", "Vilnius", 5600, 16, 2026),
    ("Tilzes g. 44 kulturos centras", "viesasis", "Siauliai", 2100, 2, 2023),
    ("Jonavos g. 60 gamybos cechas", "pramoninis", "Kaunas", 4500, 1, 2021),
    ("Sodu g. 8 individualus namas", "gyvenamasis", "Alytus", 180, 2, 2025),
    ("Vilniaus g. 33 viešbutis", "komercinis", "Marijampole", 3400, 5, 2024),
    ("Ezero g. 10 vaikų darzelis", "viesasis", "Utena", 1200, 1, 2023),
    ("Respublikos g. 55 gyvenamasis namas", "gyvenamasis", "Panevezys", 320, 2, 2022),
    ("Pergales g. 7 administracinis pastatas", "komercinis", "Kedainiai", 2200, 3, 2024),
]

MATERIALS = [
    # (name, category, density, unit, gwp, odp, ap, ep, penrt, pert, source)
    ("Betonas C30/37", "pamatai", 2400, "kg", 0.132, 5.2e-9, 0.000345, 0.0000456, 1.05, 0.082, "EPD-BET-2024"),
    ("Armatūrinis plienas B500B", "konstrukcinis", 7850, "kg", 1.99, 1.4e-8, 0.00623, 0.000512, 22.5, 0.78, "EPD-STL-2024"),
    ("Klijuota mediena (CLT)", "konstrukcinis", 470, "kg", -0.72, 2.1e-9, 0.000189, 0.0000312, 3.42, 7.85, "EPD-CLT-2024"),
    ("Mineraline vata (100mm)", "izoliacija", 30, "kg", 1.28, 8.3e-9, 0.00412, 0.000234, 16.8, 1.23, "EPD-MW-2024"),
    ("EPS polistirenas (150mm)", "izoliacija", 20, "kg", 3.45, 1.2e-7, 0.00189, 0.000089, 85.6, 0.34, "EPD-EPS-2024"),
    ("Keramines plytos", "apdaila", 1800, "kg", 0.271, 4.1e-9, 0.000567, 0.0000678, 3.12, 0.15, "EPD-BRK-2024"),
    ("Gipskartonis (12.5mm)", "apdaila", 680, "kg", 0.39, 3.5e-9, 0.00156, 0.000145, 4.56, 0.28, "EPD-GYP-2024"),
    ("PVC langai (dvigubas stikl.)", "langai_durys", None, "m2", 42.5, 3.8e-6, 0.0856, 0.00456, 820, 12.5, "EPD-WIN-2024"),
    ("Aliuminio fasadas", "apdaila", 2700, "kg", 8.24, 4.5e-7, 0.0445, 0.00234, 112, 8.9, "EPD-ALU-2024"),
    ("Bituminė stogo danga", "stogo_danga", 1100, "kg", 0.48, 6.7e-9, 0.00234, 0.000123, 12.3, 0.45, "EPD-BIT-2024"),
    ("EPDM stogo membrana", "stogo_danga", 1150, "kg", 2.85, 1.5e-8, 0.00567, 0.000345, 45.6, 1.23, "EPD-EPDM-2024"),
    ("Grindų plytelės (keramika)", "apdaila", 2000, "kg", 0.78, 5.6e-9, 0.00345, 0.000234, 8.9, 0.56, "EPD-TIL-2024"),
    ("Vario vamzdžiai", "inzinerine_sistema", 8940, "kg", 3.56, 2.3e-7, 0.0234, 0.00123, 56.7, 3.45, "EPD-COP-2024"),
    ("PE-X vamzdžiai", "inzinerine_sistema", 940, "kg", 2.12, 1.8e-8, 0.00456, 0.000234, 78.9, 0.89, "EPD-PEX-2024"),
    ("Betoniniai blokeles", "konstrukcinis", 2000, "kg", 0.089, 3.8e-9, 0.000234, 0.0000345, 0.78, 0.056, "EPD-BLK-2024"),
]

LIFECYCLE_PHASES = ["A1-A3", "A4-A5", "B1-B7", "C1-C4", "D"]
INDICATOR_TYPES = ["GWP", "ODP", "AP", "EP", "PENRT", "PERT"]
INDICATOR_UNITS = {
    "GWP": "kg CO2 eq.",
    "ODP": "kg CFC-11 eq.",
    "AP": "kg SO2 eq.",
    "EP": "kg PO4 eq.",
    "PENRT": "MJ",
    "PERT": "MJ",
}

# Phase distribution factors (how much of total impact falls in each phase)
PHASE_FACTORS = {
    "A1-A3": 0.45,
    "A4-A5": 0.10,
    "B1-B7": 0.30,
    "C1-C4": 0.12,
    "D": 0.03,
}


def generate_building_materials(building_id: int, area_m2: float, building_type: str) -> list[dict]:
    """Generate realistic material quantities for a building."""
    result = []
    # Select 5-10 materials per building
    n_materials = random.randint(5, min(10, len(MATERIALS)))
    selected = random.sample(MATERIALS, n_materials)

    for mat_idx, mat in enumerate(selected):
        mat_name, cat, density, unit, *_ = mat
        # Scale quantity by building area
        base_qty = area_m2 * random.uniform(0.5, 25.0)
        if cat == "pamatai":
            base_qty = area_m2 * random.uniform(15, 40)
        elif cat == "konstrukcinis":
            base_qty = area_m2 * random.uniform(8, 30)
        elif cat == "izoliacija":
            base_qty = area_m2 * random.uniform(1.5, 6)
        elif cat == "langai_durys":
            base_qty = area_m2 * random.uniform(0.1, 0.3)
            unit = "m2"

        quantity = round(base_qty * random.uniform(0.8, 1.2), 2)
        phase = random.choice(["A1-A3", "A4-A5"])

        result.append({
            "building_id": building_id,
            "material_id": mat_idx + 1,
            "material_name": mat_name,
            "quantity": quantity,
            "unit": unit,
            "lifecycle_phase": phase,
        })

    return result


def generate_lca_indicators(building_id: int, area_m2: float, building_type: str) -> list[dict]:
    """Generate LCA indicators for all phases."""
    result = []

    # Base values per m2 vary by building type
    type_multiplier = {
        "gyvenamasis": 1.0,
        "komercinis": 1.3,
        "pramoninis": 1.5,
        "viesasis": 1.1,
        "mišrus": 1.15,
    }
    mult = type_multiplier.get(building_type, 1.0)

    # Base impact per m2 (approximate realistic values)
    base_per_m2 = {
        "GWP": 350 * mult,       # kg CO2 eq. / m2
        "ODP": 0.000025 * mult,  # kg CFC-11 eq. / m2
        "AP": 0.85 * mult,       # kg SO2 eq. / m2
        "EP": 0.12 * mult,       # kg PO4 eq. / m2
        "PENRT": 3500 * mult,    # MJ / m2
        "PERT": 450 * mult,      # MJ / m2
    }

    calc_date = date(2026, 1, 1) + timedelta(days=random.randint(0, 150))

    for indicator in INDICATOR_TYPES:
        total = base_per_m2[indicator] * area_m2 * random.uniform(0.7, 1.3)

        for phase, factor in PHASE_FACTORS.items():
            value = total * factor * random.uniform(0.8, 1.2)
            # Phase D can be negative (benefits)
            if phase == "D":
                value = -abs(value) * random.uniform(0.5, 1.5)

            result.append({
                "building_id": building_id,
                "indicator_type": indicator,
                "lifecycle_phase": phase,
                "value": round(value, 6),
                "unit": INDICATOR_UNITS[indicator],
                "calculation_date": str(calc_date),
                "methodology": "EN 15978",
            })

    return result


def main():
    buildings = []
    all_materials_data = []
    all_building_materials = []
    all_lca_indicators = []

    # Generate materials list
    materials_list = []
    for i, mat in enumerate(MATERIALS):
        name, cat, density, unit, gwp, odp, ap, ep, penrt, pert, source = mat
        materials_list.append({
            "id": i + 1,
            "name": name,
            "category": cat,
            "density_kg_m3": density,
            "unit": unit,
            "gwp_per_unit": gwp,
            "odp_per_unit": odp,
            "ap_per_unit": ap,
            "ep_per_unit": ep,
            "penrt_per_unit": penrt,
            "pert_per_unit": pert,
            "source": source,
        })

    # Generate buildings
    for i, (name, btype, city, area, floors, year) in enumerate(BUILDING_NAMES):
        building_id = i + 1
        building = {
            "id": building_id,
            "name": name,
            "building_type": btype,
            "address": f"{name.split()[0]} g. {random.randint(1,200)}",
            "city": city,
            "area_m2": area,
            "floors": floors,
            "construction_year": year,
            "description": f"{name} - {btype} pastatas, {city}",
        }
        buildings.append(building)

        bm = generate_building_materials(building_id, area, btype)
        all_building_materials.extend(bm)

        indicators = generate_lca_indicators(building_id, area, btype)
        all_lca_indicators.extend(indicators)

    data = {
        "buildings": buildings,
        "materials": materials_list,
        "building_materials": all_building_materials,
        "lca_indicators": all_lca_indicators,
    }

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_buildings.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Generated {len(buildings)} buildings, {len(materials_list)} materials, "
          f"{len(all_building_materials)} building-material links, "
          f"{len(all_lca_indicators)} LCA indicators")
    print(f"Output: {out_path}")


if __name__ == "__main__":
    main()
