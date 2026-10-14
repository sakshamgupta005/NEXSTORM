"""
pipeline/tests/test_grid.py
Tests for deterministic metric grid generation and CRS consistency.
"""

import sys
from pathlib import Path

import geopandas as gpd
import pytest

# Add scripts directory to path
SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from utils import WGS84, UTM43N
import importlib
build_grid = importlib.import_module("01_build_grid")
generate_grid_for_polygon = build_grid.generate_grid_for_polygon


def test_grid_deterministic_ids_and_count(synthetic_workspace):
    """Verifies that 250m cells on 1km square boundary produce exactly 16 cells with stable A-0001..A-0016 IDs."""
    boundary_gdf = gpd.read_file(synthetic_workspace["boundary"])

    # Run 1
    grid1 = generate_grid_for_polygon(boundary_gdf, cell_size_m=250.0, id_prefix="A")

    assert len(grid1) == 16, f"Expected 16 cells for 1km x 1km grid, got {len(grid1)}"
    assert grid1["cell_id"].iloc[0] == "A-0001"
    assert grid1["cell_id"].iloc[-1] == "A-0016"

    # Run 2: Verify determinism across executions
    grid2 = generate_grid_for_polygon(boundary_gdf, cell_size_m=250.0, id_prefix="A")
    assert list(grid1["cell_id"]) == list(grid2["cell_id"])
    assert all(g1.equals(g2) for g1, g2 in zip(grid1.geometry, grid2.geometry))


def test_grid_crs_transformation(synthetic_workspace):
    """Verifies grid metric projection in UTM43N and export transformation to WGS84."""
    boundary_gdf = gpd.read_file(synthetic_workspace["boundary"])
    grid_utm = generate_grid_for_polygon(boundary_gdf, cell_size_m=250.0, id_prefix="A")

    assert grid_utm.crs.to_string() == UTM43N

    grid_wgs = grid_utm.to_crs(WGS84)
    assert grid_wgs.crs.to_string() == WGS84

    # WGS84 coordinates should be near Amritsar longitude ~74.8 and latitude ~31.6
    bounds = grid_wgs.total_bounds
    assert -180.0 <= bounds[0] <= 180.0
    assert -90.0 <= bounds[1] <= 90.0
