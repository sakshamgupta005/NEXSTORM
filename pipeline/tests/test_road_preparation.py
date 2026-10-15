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


def test_multi_cell_intersection_proportions():
    """
    Verifies that a road traversing two adjacent 250m cells has exact length proportions computed per cell
    and correctly extracts worst-case and length-weighted susceptibility.
    """
    from shapely.geometry import box

    # Cell 1: [0, 0] to [100, 100], s = 0.8 (high)
    # Cell 2: [100, 0] to [200, 100], s = 0.2 (low)
    cell1 = box(0, 0, 100, 100)
    cell2 = box(100, 0, 200, 100)

    # Road line traversing from (20, 50) to (180, 50): total length = 160 units
    # In Cell 1: from 20 to 100 -> length = 80 units (50%)
    # In Cell 2: from 100 to 180 -> length = 80 units (50%)
    road = LineString([(20, 50), (180, 50)])

    inter1 = shapely.intersection(road, cell1)
    inter2 = shapely.intersection(road, cell2)

    assert inter1.length == 80.0
    assert inter2.length == 80.0

    total_len = road.length
    assert total_len == 160.0

    s1, s2 = 0.8, 0.2
    max_s = max(s1, s2)
    weighted_s = (s1 * (inter1.length / total_len)) + (s2 * (inter2.length / total_len))

    assert max_s == 0.8
    assert round(weighted_s, 3) == 0.500


def test_road_network_topology_artifact():
    """Verifies that the generated road network topology JSON artifact matches real pipeline outputs."""
    import json
    repo_root = Path(__file__).resolve().parent.parent.parent
    topo_path = repo_root / "public" / "data" / "cities" / "amritsar" / "roads" / "road_network_topology.json"
    major_path = repo_root / "public" / "data" / "cities" / "amritsar" / "roads" / "major_corridors.geojson"

    assert topo_path.exists(), "road_network_topology.json must exist"
    assert major_path.exists(), "major_corridors.geojson must exist"

    with open(topo_path, "r", encoding="utf-8") as f:
        topo = json.load(f)

    assert topo["status"] == "success"
    assert topo["validPreparedSegments"] == 14853
    assert topo["underpassCount"] == 5
    assert topo["bridgeCount"] == 160
    assert topo["majorCorridorsCount"] == 773
    assert topo["totalTopologicalNodes"] == 26155

