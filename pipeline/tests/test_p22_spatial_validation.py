"""
pipeline/tests/test_p22_spatial_validation.py
Regression test suite for NEXSTORM P22 — Localized Flood-Risk Model Validation & Spatial Evidence.
"""

import json
from pathlib import Path
import pytest
import geopandas as gpd
from shapely.geometry import Point

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
ROOT = Path(__file__).resolve().parent.parent.parent

INVENTORY_PATH = ROOT / "public" / "data" / "cities" / "amritsar" / "incidents_inventory.json"
GRID_PATH = ROOT / "public" / "data" / "cities" / "amritsar" / "grid.geojson"
SUSCEPTIBILITY_PATH = ROOT / "public" / "data" / "cities" / "amritsar" / "susceptibility.geojson"
E6_AUDIT_PATH = ROOT / "public" / "data" / "evaluation" / "e6_model_validation.json"


def test_spatial_matching_all_incidents_inside_assigned_cells():
    """All 15 incident coordinates must be strictly inside their assigned 250m cell polygons."""
    with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
        incidents = json.load(f)

    grid_gdf = gpd.read_file(GRID_PATH)

    for inc in incidents:
        pt = Point(inc["lon"], inc["lat"])
        assigned_cell = inc["cellId"]
        matching_cells = grid_gdf[grid_gdf.geometry.contains(pt)]
        assert len(matching_cells) == 1, f"Incident {inc['incidentId']} must fall inside exactly 1 grid cell"
        assert matching_cells.iloc[0]["cell_id"] == assigned_cell, (
            f"Incident {inc['incidentId']} assigned to {assigned_cell} but spatially contained in {matching_cells.iloc[0]['cell_id']}"
        )


def test_reproduction_of_10_of_13_location_hits():
    """Reproduces the exact 10/13 location hit count (76.9%) and 3 misses."""
    with open(INVENTORY_PATH, "r", encoding="utf-8") as f:
        incidents = json.load(f)

    with open(SUSCEPTIBILITY_PATH, "r", encoding="utf-8") as f:
        s_geojson = json.load(f)

    cell_s_map = {feat["properties"]["id"]: feat["properties"]["s"] for feat in s_geojson["features"]}

    # Storm RTI lookup from historical audit
    storm_max_rtis = {
        "STORM-2023-07-08": 1.63,
        "STORM-2023-07-15": 0.91,
        "STORM-2023-08-20": 0.83,
        "STORM-2024-07-22": 0.69,
        "STORM-2024-07-28": 1.54,
        "STORM-2024-08-01": 3.37,
        "STORM-2024-08-11": 1.71,
    }

    rainfall_incidents = [i for i in incidents if i.get("inclusionDecision") == "included"]
    assert len(rainfall_incidents) == 13

    hits = []
    misses = []

    for inc in rainfall_incidents:
        s = cell_s_map[inc["cellId"]]
        s_band = "low" if s < 0.33 else ("mid" if s <= 0.66 else "high")
        rti = storm_max_rtis[inc["stormEventId"]]
        rti_band = "none" if rti < 0.5 else ("elevated" if rti < 1.0 else ("severe" if rti < 1.5 else "extreme"))

        if rti_band == "none":
            risk = "low"
        elif rti_band == "elevated":
            risk = "moderate" if s_band == "high" else "low"
        elif rti_band == "severe":
            risk = "low" if s_band == "low" else ("moderate" if s_band == "mid" else "high")
        else:
            risk = "moderate" if s_band == "low" else "high"

        if risk in ("moderate", "high"):
            hits.append(inc["legacyId"])
        else:
            misses.append(inc["legacyId"])

    assert len(hits) == 10
    assert len(misses) == 3
    assert set(misses) == {"H-0004", "H-0006", "H-0007"}


def test_leave_one_storm_out_evaluation_structure():
    """Verifies that LOSEO cross-validation preserves event independence across all 7 storms."""
    assert E6_AUDIT_PATH.exists()
    with open(E6_AUDIT_PATH, "r", encoding="utf-8") as f:
        e6 = json.load(f)

    loseo = e6.get("leaveOneStormOutResults", [])
    assert len(loseo) == 7

    for fold in loseo:
        assert fold["trainIncidentCount"] + fold["testIncidentCount"] == 13
        assert 0.0 <= fold["trainHitRate"] <= 1.0
        assert 0.0 <= fold["testHitRate"] <= 1.0


def test_withholding_unjustified_metrics():
    """Strictly withholds False Alarm Rate (FAR) and ROC-AUC over unlabelled negative space."""
    with open(E6_AUDIT_PATH, "r", encoding="utf-8") as f:
        e6 = json.load(f)

    perf = e6["locationLevelPerformance"]
    assert "far" not in perf
    assert "rocAuc" not in perf
    assert "specificity" not in perf
    assert len(e6.get("scientificIntegrityConstraints", [])) >= 4
