"""
pipeline/scripts/13_prepare_roads.py
Road network preparation and topological graph extraction for Amritsar.
Extracts 14,855 road segments from OSM GeoPackage, computes metric lengths in UTM 43N,
preserves classification and elevation/underpass tags, maps segments to 250m susceptibility cells,
extracts topological intersection nodes, and produces clean graph artifacts for future flood-aware routing.
"""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import shapely
from shapely.geometry import Point, LineString, MultiLineString

# Add parent directory to sys.path to import utils
sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import WGS84, UTM43N, get_repo_root, exit_with_error


def prepare_roads(source_gpkg: str = None) -> dict:
    start_time = time.time()
    repo_root = get_repo_root()
    inputs_dir = repo_root / "pipeline" / "inputs"
    outputs_dir = repo_root / "pipeline" / "outputs"
    public_amritsar_dir = repo_root / "public" / "data" / "cities" / "amritsar"
    public_roads_dir = public_amritsar_dir / "roads"

    outputs_dir.mkdir(parents=True, exist_ok=True)
    public_roads_dir.mkdir(parents=True, exist_ok=True)

    actual_source = source_gpkg or str(inputs_dir / "osm_features.gpkg")
    if not Path(actual_source).exists():
        exit_with_error(f"OSM road source not found at {actual_source}")

    print(f"[ROADS] Loading road segments from {actual_source} (layer: roads)...")
    try:
        raw_gdf = gpd.read_file(actual_source, layer="roads")
    except Exception as e:
        exit_with_error(f"Failed to read roads layer from {actual_source}: {e}")

    total_input = len(raw_gdf)
    print(f"[ROADS] Raw segments loaded: {total_input}")

    # 1. Clean geometries: ensure LineString and valid
    valid_mask = raw_gdf.geometry.notnull() & (~raw_gdf.geometry.is_empty)
    gdf = raw_gdf[valid_mask].copy()

    # Explode any MultiLineStrings into individual LineStrings
    if (gdf.geometry.geom_type == "MultiLineString").any():
        gdf = gdf.explode(index_parts=False).reset_index(drop=True)

    # Filter to only LineStrings
    gdf = gdf[gdf.geometry.geom_type == "LineString"].copy()

    # Compute metric length in UTM Zone 43N
    print("[ROADS] Computing metric segment lengths in UTM Zone 43N (EPSG:32643)...")
    gdf_utm = gdf.to_crs(UTM43N)
    gdf["length_m"] = gdf_utm.geometry.length.round(2)

    # Filter out degenerate zero-length segments (< 1 meter)
    initial_len = len(gdf)
    gdf = gdf[gdf["length_m"] >= 1.0].copy()
    dropped_zero_len = initial_len - len(gdf)
    if dropped_zero_len > 0:
        print(f"[ROADS] Dropped {dropped_zero_len} degenerate zero-length segments.")

    # 2. Attribute Preservation & Underpass Tagging
    # OpenStreetMap attributes
    gdf["osmid"] = gdf["osmid"].astype(str)
    gdf["name"] = gdf["name"].fillna("Unnamed Road")
    gdf["highway"] = gdf["highway"].fillna("unclassified")

    # Tag underpasses: tunnel == 'yes' or layer in ['-1', -1]
    is_tunnel = gdf["tunnel"].astype(str).str.lower().isin(["yes", "true", "1"])
    is_neg_layer = gdf["layer"].astype(str).str.strip().isin(["-1", "-2"])
    gdf["is_underpass"] = is_tunnel | is_neg_layer

    # Tag bridges
    is_bridge = gdf["bridge"].astype(str).str.lower().isin(["yes", "true", "1"])
    is_pos_layer = gdf["layer"].astype(str).str.strip().isin(["1", "2"])
    gdf["is_bridge"] = is_bridge | is_pos_layer

    underpass_count = int(gdf["is_underpass"].sum())
    bridge_count = int(gdf["is_bridge"].sum())
    print(f"[ROADS] Identified {underpass_count} underpass segments and {bridge_count} bridge segments.")

    # 3. Deterministic Segment ID
    gdf["segmentId"] = [f"AMR-ROAD-{osmid}-{i}" for i, osmid in enumerate(gdf["osmid"])]

    # 4. Topological Node Extraction (Endpoints rounding to 5 decimal places ~1m)
    print("[ROADS] Extracting topological nodes and junction connectivity...")
    node_registry = {}  # (round_lng, round_lat) -> node_id
    next_node_id = 1

    from_nodes = []
    to_nodes = []
    node_degree = {}

    for geom in gdf.geometry:
        coords = list(geom.coords)
        start_pt = (round(coords[0][0], 5), round(coords[0][1], 5))
        end_pt = (round(coords[-1][0], 5), round(coords[-1][1], 5))

        if start_pt not in node_registry:
            node_registry[start_pt] = next_node_id
            next_node_id += 1
        from_id = node_registry[start_pt]
        from_nodes.append(from_id)
        node_degree[from_id] = node_degree.get(from_id, 0) + 1

        if end_pt not in node_registry:
            node_registry[end_pt] = next_node_id
            next_node_id += 1
        to_id = node_registry[end_pt]
        to_nodes.append(to_id)
        node_degree[to_id] = node_degree.get(to_id, 0) + 1

    gdf["from_node"] = from_nodes
    gdf["to_node"] = to_nodes

    total_unique_nodes = len(node_registry)
    junction_nodes = sum(1 for d in node_degree.values() if d >= 3)
    dead_end_nodes = sum(1 for d in node_degree.values() if d == 1)
    print(f"[ROADS] Topological Graph: {total_unique_nodes} nodes ({junction_nodes} junctions, {dead_end_nodes} dead ends).")

    # 5. Spatial Join with Susceptibility Grid
    grid_path = public_amritsar_dir / "susceptibility.geojson"
    if grid_path.exists():
        print("[ROADS] Intersecting road segments with 250m susceptibility grid cells...")
        grid_gdf = gpd.read_file(grid_path)
        if "cellId" not in grid_gdf.columns and "id" in grid_gdf.columns:
            grid_gdf["cellId"] = grid_gdf["id"]
        if "susceptibilityScore" not in grid_gdf.columns and "s" in grid_gdf.columns:
            grid_gdf["susceptibilityScore"] = grid_gdf["s"]

        # Midpoint for primary cell assignment
        midpoints = [geom.interpolate(0.5, normalized=True) for geom in gdf.geometry]
        midpoint_gdf = gpd.GeoDataFrame(
            {"segmentId": gdf["segmentId"]},
            geometry=midpoints,
            crs=WGS84,
        )

        mid_join = gpd.sjoin(
            midpoint_gdf,
            grid_gdf[["cellId", "susceptibilityScore", "geometry"]],
            how="left",
            predicate="within",
        ).drop_duplicates(subset=["segmentId"])

        gdf = gdf.merge(
            mid_join[["segmentId", "cellId", "susceptibilityScore"]],
            on="segmentId",
            how="left",
        )
        gdf["primaryCellId"] = gdf["cellId"].fillna("OUTSIDE_GRID")
        gdf["cellSusceptibility"] = gdf["susceptibilityScore"].fillna(0.0)
        gdf.drop(columns=["cellId", "susceptibilityScore"], inplace=True)
    else:
        gdf["primaryCellId"] = "UNKNOWN"
        gdf["cellSusceptibility"] = 0.0

    # Modeled corridor risk class
    def get_corridor_risk(score: float, is_underpass: bool) -> str:
        if is_underpass or score >= 0.66:
            return "high"
        if score >= 0.33:
            return "moderate"
        return "low"

    gdf["modeledRiskClass"] = [
        get_corridor_risk(score, up)
        for score, up in zip(gdf["cellSusceptibility"], gdf["is_underpass"])
    ]

    gdf["scientificCaveat"] = "Modeled catchment exposure; does NOT guarantee road is impassable unless verified observation exists."

    # 6. Save Outputs
    # Save canonical Parquet
    parquet_out = outputs_dir / "amritsar_roads_prepared.parquet"
    parquet_tmp = outputs_dir / "amritsar_roads_prepared.parquet.tmp"
    save_cols = [
        "segmentId", "osmid", "name", "highway", "length_m",
        "is_underpass", "is_bridge", "from_node", "to_node",
        "primaryCellId", "cellSusceptibility", "modeledRiskClass",
        "scientificCaveat", "geometry"
    ]
    gdf[save_cols].to_parquet(parquet_tmp, compression="snappy")
    if parquet_out.exists():
        parquet_out.unlink()
    parquet_tmp.rename(parquet_out)

    # Save summary JSON for frontend and routing architecture
    highway_dist = gdf["highway"].value_counts().to_dict()
    risk_dist = gdf["modeledRiskClass"].value_counts().to_dict()

    summary = {
        "status": "success",
        "source": "OpenStreetMap contributors (via Overpass/GPKG)",
        "license": "ODbL 1.0",
        "totalInputSegments": total_input,
        "validPreparedSegments": len(gdf),
        "totalLengthKm": round(float(gdf["length_m"].sum()) / 1000.0, 2),
        "totalTopologicalNodes": total_unique_nodes,
        "junctionNodesCount": junction_nodes,
        "deadEndNodesCount": dead_end_nodes,
        "underpassCount": underpass_count,
        "bridgeCount": bridge_count,
        "highwayClassificationCounts": highway_dist,
        "modeledRiskDistribution": risk_dist,
        "canonicalParquetPath": str(parquet_out),
        "processingDurationSeconds": round(time.time() - start_time, 2),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    summary_out = public_roads_dir / "road_network_topology.json"
    with open(summary_out, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    pipeline_summary = outputs_dir / "road_preparation_summary.json"
    with open(pipeline_summary, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"[ROADS] Road network preparation completed in {summary['processingDurationSeconds']}s! Wrote {summary_out}")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare and standardize road network for Amritsar.")
    parser.add_argument("--source", type=str, default=None, help="Path to input osm_features.gpkg.")
    args = parser.parse_args()

    prepare_roads(source_gpkg=args.source)
