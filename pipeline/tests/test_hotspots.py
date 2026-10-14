"""
pipeline/tests/test_hotspots.py
Tests for hotspot validation, date parsing, 150m same-date deduplication,
boundary filtering, and grid cell snapping.
"""

import importlib
from pathlib import Path
import geopandas as gpd
from shapely.geometry import Point, box
import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
import sys
sys.path.insert(0, str(SCRIPTS_DIR))

hotspots_mod = importlib.import_module("04_hotspots")
merge_nearby_same_date_hotspots = hotspots_mod.merge_nearby_same_date_hotspots
parse_and_validate_date = hotspots_mod.parse_and_validate_date


def test_date_parsing_and_validation():
    """Verifies ISO conversion and rejection of invalid date strings."""
    assert parse_and_validate_date("2024-08-11") == "2024-08-11"
    assert parse_and_validate_date("11-08-2024") == "2024-08-11"
    assert parse_and_validate_date("2024/08/11") == "2024-08-11"
    assert parse_and_validate_date("invalid-date") is None
    assert parse_and_validate_date(None) is None


def test_same_date_150m_deduplication():
    """Merges same-date hotspots within 150m and keeps distant or different-date ones separate."""
    # Synthetic metric coordinates (EPSG:32643)
    p1 = Point(1000.0, 1000.0)
    p2 = Point(1080.0, 1000.0)  # 80m from p1 (within 150m)
    p3 = Point(1250.0, 1000.0)  # 250m from p1 (outside 150m)
    p4 = Point(1050.0, 1000.0)  # 50m from p1, but different date

    records = [
        {"name": "Spot 1", "articleDate": "2024-08-11", "sourceUrl": "http://a.com", "geometry": p1},
        {"name": "Spot 2", "articleDate": "2024-08-11", "sourceUrl": "http://b.com", "geometry": p2},
        {"name": "Spot 3", "articleDate": "2024-08-11", "sourceUrl": "http://c.com", "geometry": p3},
        {"name": "Spot 4", "articleDate": "2024-08-12", "sourceUrl": "http://d.com", "geometry": p4},
    ]

    gdf = gpd.GeoDataFrame(records, crs="EPSG:32643")
    merged_gdf, merged_count = merge_nearby_same_date_hotspots(gdf, dist_threshold_m=150.0)

    # p1 and p2 should be merged into 1; p3 is too far; p4 has a different date
    assert merged_count == 1
    assert len(merged_gdf) == 3
    # Check that merged sources are combined
    merged_row = merged_gdf[merged_gdf["name"] == "Spot 1"].iloc[0]
    assert "http://a.com" in merged_row["sourceUrl"] and "http://b.com" in merged_row["sourceUrl"]


def test_boundary_filtering_and_cell_snapping():
    """Verifies that out-of-boundary points are rejected and valid points snap to correct grid cells."""
    # 1. Boundary box: [0, 0] to [1000, 1000]
    boundary_geom = box(0.0, 0.0, 1000.0, 1000.0)

    # 2. Grid cells: 4 cells
    cell_a = box(0.0, 0.0, 500.0, 500.0)
    cell_b = box(500.0, 0.0, 1000.0, 500.0)
    grid_gdf = gpd.GeoDataFrame([
        {"cell_id": "A-0001", "geometry": cell_a},
        {"cell_id": "A-0002", "geometry": cell_b},
    ], crs="EPSG:32643")

    # 3. Points
    pt_inside_a = Point(250.0, 250.0)
    pt_inside_b = Point(750.0, 250.0)
    pt_outside = Point(1500.0, 1500.0)  # Outside boundary

    points_gdf = gpd.GeoDataFrame([
        {"name": "Inside A", "articleDate": "2024-08-11", "geometry": pt_inside_a},
        {"name": "Inside B", "articleDate": "2024-08-11", "geometry": pt_inside_b},
        {"name": "Outside", "articleDate": "2024-08-11", "geometry": pt_outside},
    ], crs="EPSG:32643")

    # Filter by boundary
    in_boundary = points_gdf[points_gdf.geometry.within(boundary_geom)]
    assert len(in_boundary) == 2
    assert "Outside" not in in_boundary["name"].values

    # Snap to grid
    snapped = gpd.sjoin(in_boundary, grid_gdf, how="inner", predicate="within")
    assert len(snapped) == 2
    row_a = snapped[snapped["name"] == "Inside A"].iloc[0]
    row_b = snapped[snapped["name"] == "Inside B"].iloc[0]
    assert row_a["cell_id"] == "A-0001"
    assert row_b["cell_id"] == "A-0002"
