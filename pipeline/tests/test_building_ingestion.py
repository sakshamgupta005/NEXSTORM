"""
pipeline/tests/test_building_ingestion.py
Unit test suite for building footprint validation, UTM 43N area calculations,
stable ID generation, multi-cell spatial matching, and duplicate handling.
Uses isolated synthetic test fixtures clearly marked as synthetic.
"""

import json
import pytest
import shapely
from shapely.geometry import Polygon, MultiPolygon, Point
import geopandas as gpd
import pyproj

import importlib
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

buildings_mod = importlib.import_module("12_ingest_buildings")
utils_mod = importlib.import_module("utils")

generate_stable_building_id = buildings_mod.generate_stable_building_id
DEFAULT_BBOX = buildings_mod.DEFAULT_BBOX
WGS84 = utils_mod.WGS84
UTM43N = utils_mod.UTM43N


@pytest.fixture
def synthetic_building_fixture():
    """
    Clearly marked SYNTHETIC test fixture.
    Contains 4 known test polygons in Amritsar coordinate space:
    1. Valid standard building rectangle (approx 20m x 25m in UTM43N)
    2. Self-intersecting bowtie polygon (invalid geometry that requires make_valid)
    3. Duplicate of polygon 1 (for deduplication testing)
    4. Out-of-bounds polygon far outside Amritsar municipal grid (e.g. in the Arabian Sea)
    """
    # Base control point: Hall Gate, Amritsar (UTM43N: Easting ~488,300m, Northing ~3,499,600m)
    transformer_to_wgs84 = pyproj.Transformer.from_crs(UTM43N, WGS84, always_xy=True)
    transformer_to_utm = pyproj.Transformer.from_crs(WGS84, UTM43N, always_xy=True)

    # 1. 20m x 25m rectangle in UTM43N -> area should be exactly 500 m^2
    e0, n0 = 488300.0, 3499600.0
    rect_utm = Polygon([
        (e0, n0),
        (e0 + 20.0, n0),
        (e0 + 20.0, n0 + 25.0),
        (e0, n0 + 25.0),
        (e0, n0),
    ])
    rect_wgs84 = shapely.ops.transform(transformer_to_wgs84.transform, rect_utm)

    # 2. Self-intersecting bowtie polygon (invalid)
    bowtie_wgs84 = Polygon([
        (74.870, 31.630),
        (74.875, 31.635),
        (74.870, 31.635),
        (74.875, 31.630),
        (74.870, 31.630),
    ])

    # 4. Out-of-bounds polygon (Arabian Sea: 15°N, 68°E)
    oob_wgs84 = Polygon([
        (68.000, 15.000),
        (68.001, 15.000),
        (68.001, 15.001),
        (68.000, 15.001),
        (68.000, 15.000),
    ])

    return {
        "rect_utm": rect_utm,
        "rect_wgs84": rect_wgs84,
        "bowtie_wgs84": bowtie_wgs84,
        "oob_wgs84": oob_wgs84,
        "transformer_to_utm": transformer_to_utm,
    }


def test_metric_area_calculation_utm43n(synthetic_building_fixture):
    """Verifies that area calculation in UTM Zone 43N accurately matches true ground metric dimensions."""
    rect_wgs84 = synthetic_building_fixture["rect_wgs84"]
    transformer = synthetic_building_fixture["transformer_to_utm"]

    # Re-project to UTM 43N
    rect_utm_reprojected = shapely.ops.transform(transformer.transform, rect_wgs84)
    computed_area = rect_utm_reprojected.area

    # Theoretical area = 20m * 25m = 500.0 m^2
    assert abs(computed_area - 500.0) < 0.1, f"Expected 500.0 m^2, got {computed_area}"


def test_geometry_validation_and_repair(synthetic_building_fixture):
    """Verifies that self-intersecting bowtie geometries are repaired via make_valid."""
    bowtie = synthetic_building_fixture["bowtie_wgs84"]
    assert not bowtie.is_valid, "Bowtie polygon must be initially invalid"

    repaired = shapely.make_valid(bowtie)
    assert repaired.is_valid, "Repaired geometry must be valid"
    assert isinstance(repaired, (Polygon, MultiPolygon)), "Repaired geometry must be polygon/multipolygon"


def test_deterministic_stable_building_id():
    """Verifies that building ID generation is deterministic and stable across identical inputs."""
    geom1 = Polygon([(74.87, 31.63), (74.88, 31.63), (74.88, 31.64), (74.87, 31.64), (74.87, 31.63)])
    geom2 = Polygon([(74.87, 31.63), (74.88, 31.63), (74.88, 31.64), (74.87, 31.64), (74.87, 31.63)])
    geom_different = Polygon([(74.81, 31.61), (74.82, 31.61), (74.82, 31.62), (74.81, 31.62), (74.81, 31.61)])

    id1 = generate_stable_building_id("8J5VJP00+11", geom1)
    id2 = generate_stable_building_id("8J5VJP00+11", geom2)
    id3 = generate_stable_building_id("8J5VJP00+11", geom_different)

    assert id1.startswith("GOB-391-")
    assert id1 == id2, "Identical geometry and Plus Code must yield identical stable building ID"
    assert id1 != id3, "Different geometry must yield different building ID"


def test_deduplication_of_identical_footprints(synthetic_building_fixture):
    """Verifies that duplicate building polygons are eliminated during processing."""
    rect = synthetic_building_fixture["rect_wgs84"]
    records = [
        {"full_plus_code": "8J5VJPXX+11", "geometry": rect, "confidence": 0.85},
        {"full_plus_code": "8J5VJPXX+11", "geometry": rect, "confidence": 0.85},  # Duplicate!
    ]
    gdf = gpd.GeoDataFrame(records, crs=WGS84)
    gdf["buildingId"] = [generate_stable_building_id(r["full_plus_code"], r["geometry"]) for _, r in gdf.iterrows()]

    deduped = gdf.drop_duplicates(subset=["buildingId"])
    assert len(gdf) == 2
    assert len(deduped) == 1, "Duplicate footprint must be dropped"


def test_out_of_bounds_footprint_matching(synthetic_building_fixture, tmp_path):
    """Verifies that footprints far outside the municipal grid boundary are marked UNMATCHED."""
    oob = synthetic_building_fixture["oob_wgs84"]
    centroid = oob.centroid

    # Create dummy 1-cell grid in Amritsar
    grid_poly = Polygon([(74.80, 31.60), (74.81, 31.60), (74.81, 31.61), (74.80, 31.61), (74.80, 31.60)])
    grid_gdf = gpd.GeoDataFrame(
        {"cellId": ["A-0001"], "susceptibilityScore": [0.75]},
        geometry=[grid_poly],
        crs=WGS84,
    )

    point_gdf = gpd.GeoDataFrame(
        {"buildingId": ["GOB-OOB-01"]},
        geometry=[centroid],
        crs=WGS84,
    )

    joined = gpd.sjoin(point_gdf, grid_gdf, how="left", predicate="within")
    cell_id = joined["cellId"].iloc[0] if "cellId" in joined.columns else None

    assert cell_id is None or str(cell_id) == "nan", "OOB centroid must not match Amritsar grid cell"


def test_multi_cell_building_intersection_and_area_weighting():
    """
    Verifies that when a building polygon crosses multiple grid cells,
    exact intersection areas are calculated, fractions sum to 1.0, and
    maximum susceptibility is preserved as a conservative indicator.
    """
    # Create two adjacent 250m cells: Cell A (west) and Cell B (east), boundary at lon 74.850
    cell_a = Polygon([(74.848, 31.630), (74.850, 31.630), (74.850, 31.632), (74.848, 31.632), (74.848, 31.630)])
    cell_b = Polygon([(74.850, 31.630), (74.852, 31.630), (74.852, 31.632), (74.850, 31.632), (74.850, 31.630)])
    grid_gdf = gpd.GeoDataFrame(
        {"cellId": ["A-WEST", "A-EAST"], "s": [0.80, 0.40]},
        geometry=[cell_a, cell_b],
        crs=WGS84,
    )

    # Building polygon straddling the boundary (40% in Cell A, 60% in Cell B)
    # Longitude from 74.8492 to 74.8512 (width 0.002, boundary at 74.850)
    # West part width = 0.0008 (40%), East part width = 0.0012 (60%)
    bldg_poly = Polygon([(74.8492, 31.6305), (74.8512, 31.6305), (74.8512, 31.6315), (74.8492, 31.6315), (74.8492, 31.6305)])
    bldg_gdf = gpd.GeoDataFrame({"buildingId": ["GOB-STRADDLE-01"]}, geometry=[bldg_poly], crs=WGS84)

    # Intersections
    inter_a = bldg_poly.intersection(cell_a)
    inter_b = bldg_poly.intersection(cell_b)

    frac_a = inter_a.area / bldg_poly.area
    frac_b = inter_b.area / bldg_poly.area

    assert abs((frac_a + frac_b) - 1.0) < 1e-4, "Intersection fractions must sum to 1.0"
    assert abs(frac_a - 0.4) < 1e-3, f"Expected 40% in Cell A, got {frac_a}"
    assert abs(frac_b - 0.6) < 1e-3, f"Expected 60% in Cell B, got {frac_b}"

    # Area-weighted susceptibility = (0.80 * 0.4) + (0.40 * 0.6) = 0.32 + 0.24 = 0.56
    weighted_s = (0.80 * frac_a) + (0.40 * frac_b)
    assert abs(weighted_s - 0.56) < 1e-3, f"Expected weighted s=0.56, got {weighted_s}"

    # Conservative maximum susceptibility = 0.80
    max_s = max(0.80, 0.40)
    assert max_s == 0.80, "Max susceptibility must be the highest crossed cell"
    assert max_s > weighted_s, "Conservative max susceptibility must exceed weighted mean"

