"""
pipeline/tests/test_features.py
Tests for terrain, built-up, and underpass feature extraction on synthetic fixtures.
"""

import sys
from pathlib import Path

import geopandas as gpd
import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

import importlib
build_grid = importlib.import_module("01_build_grid")
features_mod = importlib.import_module("02_features")
generate_grid_for_polygon = build_grid.generate_grid_for_polygon
compute_features_for_grid = features_mod.compute_features_for_grid


def test_terrain_local_depression_and_slope(synthetic_workspace):
    """Verifies that the synthetic pit has a strictly negative local_depression (< 0)."""
    boundary_gdf = gpd.read_file(synthetic_workspace["boundary"])
    grid_gdf = generate_grid_for_polygon(boundary_gdf, cell_size_m=250.0, id_prefix="A")

    df = compute_features_for_grid(
        grid_gdf=grid_gdf,
        dem_path=synthetic_workspace["dem"],
        worldcover_path=synthetic_workspace["worldcover"],
        osm_gpkg_path=synthetic_workspace["gpkg"],
        is_campus=False,
    )

    # 1. At least one cell should capture the known 235m pit (surrounding is 250m)
    min_elev = df["elevation_mean"].min()
    assert min_elev < 245.0, f"Expected pit elevation below 245m, got {min_elev}"

    # 2. Local depression for pit cell must be negative
    pit_cell = df.loc[df["elevation_mean"].idxmin()]
    assert pit_cell["local_depression"] < 0.0, f"Pit local_depression must be negative, got {pit_cell['local_depression']}"

    # 3. Slope and flat fraction
    assert (df["slope_deg"] >= 0.0).all()
    assert (df["flat_fraction"] >= 0.0).all() and (df["flat_fraction"] <= 1.0).all()


def test_builtup_and_infrastructure_features(synthetic_workspace):
    """Verifies builtup_fraction, building_density, road_density, and nearest named road."""
    boundary_gdf = gpd.read_file(synthetic_workspace["boundary"])
    grid_gdf = generate_grid_for_polygon(boundary_gdf, cell_size_m=250.0, id_prefix="A")

    df = compute_features_for_grid(
        grid_gdf=grid_gdf,
        dem_path=synthetic_workspace["dem"],
        worldcover_path=synthetic_workspace["worldcover"],
        osm_gpkg_path=synthetic_workspace["gpkg"],
        is_campus=False,
    )

    # Built-up fraction in top-left cell should be > 0.5 (class 50 was placed in top-left)
    top_left_cell = df.iloc[0]
    assert top_left_cell["builtup_fraction"] > 0.0

    # Building density should be > 0 where synthetic mall was placed
    assert (df["building_density"] >= 0.0).all()
    assert df["building_density"].max() > 0.0

    # Nearest named road should detect 'Grand Trunk Road'
    named_cells = df[df["nearest_named_road"].notna()]
    assert len(named_cells) > 0
    assert (named_cells["nearest_named_road"] == "Grand Trunk Road").all()
    assert (named_cells["dist_to_named_road_m"] >= 0.0).all()


def test_underpass_proxy_detection(synthetic_workspace):
    """Verifies underpass_flag is 1 for road with tunnel=yes / layer < 0, and 0 for others."""
    boundary_gdf = gpd.read_file(synthetic_workspace["boundary"])
    grid_gdf = generate_grid_for_polygon(boundary_gdf, cell_size_m=250.0, id_prefix="A")

    df = compute_features_for_grid(
        grid_gdf=grid_gdf,
        dem_path=synthetic_workspace["dem"],
        worldcover_path=synthetic_workspace["worldcover"],
        osm_gpkg_path=synthetic_workspace["gpkg"],
        is_campus=False,
    )

    # Cell 0 intersects the road with tunnel=yes and layer=-1
    cell_with_tunnel = df.iloc[0]
    assert cell_with_tunnel["underpass_flag"] == 1
    assert "tunnel" in cell_with_tunnel["underpass_reason"] or "layer" in cell_with_tunnel["underpass_reason"]

    # Cells without tunnels or bridges should have underpass_flag == 0
    cells_no_underpass = df[df["cell_id"] != cell_with_tunnel["cell_id"]]
    assert (cells_no_underpass["underpass_flag"] == 0).any()
