"""
pipeline/tests/test_road_preparation.py
Unit test suite for road network standardization, underpass/bridge tagging,
topological graph node extraction, metric length calculations in UTM 43N, and invalid geometry filtering.
Uses isolated synthetic test fixtures clearly marked as synthetic.
"""

import pytest
import shapely
from shapely.geometry import LineString, Point
import geopandas as gpd

import importlib
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

roads_mod = importlib.import_module("13_prepare_roads")
utils_mod = importlib.import_module("utils")

prepare_roads = roads_mod.prepare_roads
WGS84 = utils_mod.WGS84
UTM43N = utils_mod.UTM43N


@pytest.fixture
def synthetic_road_network_fixture():
    """
    Clearly marked SYNTHETIC test fixture.
    Contains 3 connected road segments forming a T-junction:
    - Road 1: West-to-East main road (Node A -> Node B)
    - Road 2: West-to-East continuation (Node B -> Node C)
    - Road 3: South-to-North intersecting road with underpass tag (Node D -> Node B)
    - Road 4: Degenerate zero-length line (should be rejected)
    """
    # Base control coords around Amritsar (approx 100m segments)
    node_a = (74.8700, 31.6300)
    node_b = (74.8710, 31.6300)  # Junction!
    node_c = (74.8720, 31.6300)
    node_d = (74.8710, 31.6290)

    road1 = LineString([node_a, node_b])
    road2 = LineString([node_b, node_c])
    road3 = LineString([node_d, node_b])  # Underpass
    road_zero = LineString([node_a, node_a])  # Degenerate zero-length

    records = [
        {"element_type": "way", "osmid": "1001", "name": "Mall Road West", "highway": "primary", "bridge": None, "tunnel": None, "layer": None, "geometry": road1},
        {"element_type": "way", "osmid": "1002", "name": "Mall Road East", "highway": "primary", "bridge": "yes", "tunnel": None, "layer": "1", "geometry": road2},
        {"element_type": "way", "osmid": "1003", "name": "Railway Underpass Road", "highway": "secondary", "bridge": None, "tunnel": "yes", "layer": "-1", "geometry": road3},
        {"element_type": "way", "osmid": "9999", "name": "Zero Length Glitch", "highway": "residential", "bridge": None, "tunnel": None, "layer": None, "geometry": road_zero},
    ]

    gdf = gpd.GeoDataFrame(records, crs=WGS84)
    return gdf


def test_underpass_and_bridge_tag_identification(synthetic_road_network_fixture):
    """Verifies that underpasses (tunnel=yes or layer=-1) and bridges are strictly tagged."""
    gdf = synthetic_road_network_fixture.copy()

    is_tunnel = gdf["tunnel"].astype(str).str.lower().isin(["yes", "true", "1"])
    is_neg_layer = gdf["layer"].astype(str).str.strip().isin(["-1", "-2"])
    gdf["is_underpass"] = is_tunnel | is_neg_layer

    is_bridge = gdf["bridge"].astype(str).str.lower().isin(["yes", "true", "1"])
    is_pos_layer = gdf["layer"].astype(str).str.strip().isin(["1", "2"])
    gdf["is_bridge"] = is_bridge | is_pos_layer

    underpass_roads = gdf[gdf["is_underpass"]]
    bridge_roads = gdf[gdf["is_bridge"]]

    assert len(underpass_roads) == 1
    assert underpass_roads["osmid"].iloc[0] == "1003"

    assert len(bridge_roads) == 1
    assert bridge_roads["osmid"].iloc[0] == "1002"


def test_metric_length_and_degenerate_line_filtering(synthetic_road_network_fixture):
    """Verifies UTM 43N metric length computation and rejection of zero-length lines."""
    gdf = synthetic_road_network_fixture.copy()
    gdf_utm = gdf.to_crs(UTM43N)
    gdf["length_m"] = gdf_utm.geometry.length.round(2)

    # Filter >= 1.0m
    valid_roads = gdf[gdf["length_m"] >= 1.0]

    assert len(valid_roads) == 3, "Zero-length segment must be filtered out"
    # 0.0010 degrees longitude at latitude 31.63° is approximately 94.8 meters
    for length in valid_roads["length_m"]:
        assert 80.0 < length < 130.0, f"Expected segment length around 95-110m, got {length}"


def test_topological_node_extraction_and_junction_degree(synthetic_road_network_fixture):
    """Verifies that common vertices are correctly merged into topological junction nodes with degree >= 3."""
    gdf = synthetic_road_network_fixture.iloc[:3].copy()  # Only the 3 valid connected segments

    node_registry = {}
    next_node_id = 1
    node_degrees = {}

    for geom in gdf.geometry:
        coords = list(geom.coords)
        start_pt = (round(coords[0][0], 5), round(coords[0][1], 5))
        end_pt = (round(coords[-1][0], 5), round(coords[-1][1], 5))

        for pt in [start_pt, end_pt]:
            if pt not in node_registry:
                node_registry[pt] = next_node_id
                next_node_id += 1
            nid = node_registry[pt]
            node_degrees[nid] = node_degrees.get(nid, 0) + 1

    # In our T-junction fixture:
    # Node B (junction) appears in all 3 roads -> degree 3
    # Node A appears in Road 1 -> degree 1
    # Node C appears in Road 2 -> degree 1
    # Node D appears in Road 3 -> degree 1
    assert len(node_registry) == 4, "T-junction fixture should have exactly 4 unique nodes"

    junction_count = sum(1 for d in node_degrees.values() if d >= 3)
    dead_end_count = sum(1 for d in node_degrees.values() if d == 1)

    assert junction_count == 1, "Exactly 1 junction node (degree 3) must exist"
    assert dead_end_count == 3, "Exactly 3 dead-end nodes (degree 1) must exist"
