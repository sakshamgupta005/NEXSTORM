"""
pipeline/scripts/13_prepare_roads.py
Road network preparation and topological graph extraction for Amritsar.
Extracts 14,855 road segments from OSM GeoPackage, computes metric lengths in UTM 43N,
preserves classification and elevation/underpass tags, maps segments to 250m susceptibility cells
with exact line-in-polygon multi-cell intersection, extracts topological intersection nodes,
and produces clean graph artifacts for future flood-aware routing.
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


def prepare_roads(source_gpkg: str = None, city: str = "amritsar") -> dict:
    start_time = time.time()
    city_id = city.lower()
    city_prefix = "JAL" if city_id == "jalandhar" else "AMR"
    repo_root = get_repo_root()
    inputs_dir = repo_root / "pipeline" / "inputs"
    outputs_dir = repo_root / "pipeline" / "outputs"
    public_city_dir = repo_root / "public" / "data" / "cities" / city_id
    public_roads_dir = public_city_dir / "roads"

    outputs_dir.mkdir(parents=True, exist_ok=True)
    public_roads_dir.mkdir(parents=True, exist_ok=True)

    default_city_source = inputs_dir / city_id / "osm_features.gpkg"
    default_root_source = inputs_dir / "osm_features.gpkg"
    actual_source = source_gpkg or (str(default_city_source) if default_city_source.exists() else str(default_root_source))
    if not Path(actual_source).exists():
        exit_with_error(f"OSM road source not found at {actual_source}")

    print(f"[ROADS] Loading road segments for {city_id} from {actual_source} (layer: roads)...")
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
    gdf["segmentId"] = [f"{city_prefix}-ROAD-{osmid}-{i}" for i, osmid in enumerate(gdf["osmid"])]

    # 4. Topological Node Extraction (Endpoints rounding to 5 decimal places ~1m)
    print("[ROADS] Extracting topological nodes and junction connectivity...")
    node_registry = {}  # (round_lng, round_lat) -> node_id
    node_coords = {}    # node_id -> [lng, lat]
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
            node_coords[next_node_id] = [start_pt[0], start_pt[1]]
            next_node_id += 1
        from_id = node_registry[start_pt]
        from_nodes.append(from_id)
        node_degree[from_id] = node_degree.get(from_id, 0) + 1

        if end_pt not in node_registry:
            node_registry[end_pt] = next_node_id
            node_coords[next_node_id] = [end_pt[0], end_pt[1]]
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

    # 5. Exact Multi-Cell Spatial Intersections with 250m Susceptibility Grid
    grid_path = public_city_dir / "susceptibility.geojson"
    intersections_by_segment = {}

    if grid_path.exists():
        print("[ROADS] Computing exact line-in-polygon multi-cell intersections...")
        grid_gdf = gpd.read_file(grid_path)
        if "cellId" not in grid_gdf.columns and "id" in grid_gdf.columns:
            grid_gdf["cellId"] = grid_gdf["id"]
        if "susceptibilityScore" not in grid_gdf.columns and "s" in grid_gdf.columns:
            grid_gdf["susceptibilityScore"] = grid_gdf["s"]

        sjoin_df = gpd.sjoin(
            gdf[["segmentId", "length_m", "geometry"]],
            grid_gdf[["cellId", "susceptibilityScore", "geometry"]],
            how="inner",
            predicate="intersects",
        )

        road_geom_map = gdf.set_index("segmentId")["geometry"].to_dict()
        grid_geom_map = grid_gdf.set_index("cellId")["geometry"].to_dict()

        inter_geoms = [
            shapely.intersection(road_geom_map[s], grid_geom_map[c])
            for s, c in zip(sjoin_df["segmentId"], sjoin_df["cellId"])
        ]

        inter_gdf = gpd.GeoDataFrame(geometry=inter_geoms, crs=WGS84).to_crs(UTM43N)
        sjoin_df["inter_length_m"] = inter_gdf.geometry.length.round(2)

        for row in sjoin_df.itertuples():
            if row.inter_length_m < 0.5:
                continue
            seg_id = row.segmentId
            if seg_id not in intersections_by_segment:
                intersections_by_segment[seg_id] = []
            intersections_by_segment[seg_id].append({
                "cellId": str(row.cellId),
                "s": round(float(row.susceptibilityScore), 4),
                "lengthM": round(float(row.inter_length_m), 2),
                "fraction": round(float(row.inter_length_m) / max(float(row.length_m), 1.0), 3),
            })

    # Build multi-cell spatial attributes per segment
    primary_cells = []
    max_scores = []
    weighted_scores = []
    unmatched_fractions = []
    cell_ids_list = []
    cells_json_list = []

    for seg_id, tot_len in zip(gdf["segmentId"], gdf["length_m"]):
        cell_items = intersections_by_segment.get(seg_id, [])
        if not cell_items:
            primary_cells.append("OUTSIDE_GRID")
            max_scores.append(0.0)
            weighted_scores.append(0.0)
            unmatched_fractions.append(1.0)
            cell_ids_list.append([])
            cells_json_list.append("[]")
        else:
            cell_items.sort(key=lambda x: x["lengthM"], reverse=True)
            primary_cells.append(cell_items[0]["cellId"])
            max_s = max(c["s"] for c in cell_items)
            tot_inter_m = sum(c["lengthM"] for c in cell_items)
            # Normalize fractions so boundary double-counting cannot cause sum(fractions) > 1.0
            norm_factor = max(tot_inter_m, tot_len, 1.0)
            for c in cell_items:
                c["fraction"] = round(c["lengthM"] / norm_factor, 3)

            w_s = sum(c["s"] * (c["lengthM"] / max(tot_inter_m, 1.0)) for c in cell_items)
            unmatched_frac = max(0.0, round(1.0 - min(1.0, tot_inter_m / max(tot_len, 1.0)), 3))

            max_scores.append(round(max_s, 4))
            weighted_scores.append(round(w_s, 4))
            unmatched_fractions.append(unmatched_frac)
            cell_ids_list.append([c["cellId"] for c in cell_items])
            cells_json_list.append(json.dumps(cell_items))

    gdf["primaryCellId"] = primary_cells
    gdf["cellSusceptibility"] = max_scores
    gdf["maxCellSusceptibility"] = max_scores
    gdf["weightedCellSusceptibility"] = weighted_scores
    gdf["unmatchedFraction"] = unmatched_fractions
    gdf["intersectingCellIds"] = cell_ids_list
    gdf["intersectingCellsJson"] = cells_json_list

    # Modeled corridor risk class
    def get_corridor_risk(score: float, is_underpass: bool) -> str:
        if is_underpass or score >= 0.66:
            return "high"
        if score >= 0.33:
            return "moderate"
        return "low"

    gdf["modeledRiskClass"] = [
        get_corridor_risk(score, up)
        for score, up in zip(gdf["maxCellSusceptibility"], gdf["is_underpass"])
    ]

    gdf["scientificCaveat"] = (
        "Modeled catchment exposure; does NOT guarantee road is impassable unless verified observation exists."
    )

    # 6. Save Canonical Parquet
    parquet_out = outputs_dir / f"{city_id}_roads_prepared.parquet"
    parquet_tmp = outputs_dir / f"{city_id}_roads_prepared.parquet.tmp"
    save_cols = [
        "segmentId", "osmid", "name", "highway", "length_m",
        "is_underpass", "is_bridge", "from_node", "to_node",
        "primaryCellId", "cellSusceptibility", "maxCellSusceptibility",
        "weightedCellSusceptibility", "unmatchedFraction", "modeledRiskClass",
        "intersectingCellsJson", "scientificCaveat", "geometry"
    ]
    gdf[save_cols].to_parquet(parquet_tmp, compression="snappy")
    if parquet_out.exists():
        parquet_out.unlink()
    parquet_tmp.rename(parquet_out)

    # 7. Export Major Corridors GeoJSON for Interactive Map
    major_mask = (
        gdf["highway"].isin([
            "primary", "trunk", "secondary", "tertiary",
            "primary_link", "trunk_link", "secondary_link", "tertiary_link"
        ])
        | (gdf["is_underpass"] == True)
    )
    major_gdf = gdf[major_mask].copy()
    major_geojson_path = public_roads_dir / "major_corridors.geojson"
    major_gdf[[
        "segmentId", "name", "highway", "length_m", "is_underpass", "is_bridge",
        "primaryCellId", "maxCellSusceptibility", "weightedCellSusceptibility",
        "modeledRiskClass", "geometry"
    ]].to_file(major_geojson_path, driver="GeoJSON")
    print(f"[ROADS] Exported {len(major_gdf)} major corridors to {major_geojson_path}")

    # 8. Export Lightweight Road Segments Index
    segments_index = {}
    for row in gdf.itertuples():
        coords = list(row.geometry.coords)
        segments_index[row.segmentId] = {
            "segmentId": row.segmentId,
            "osmid": row.osmid,
            "name": row.name,
            "highway": row.highway,
            "lengthM": float(row.length_m),
            "isUnderpass": bool(row.is_underpass),
            "isBridge": bool(row.is_bridge),
            "fromNode": int(row.from_node),
            "toNode": int(row.to_node),
            "primaryCellId": row.primaryCellId,
            "maxCellSusceptibility": float(row.maxCellSusceptibility),
            "weightedCellSusceptibility": float(row.weightedCellSusceptibility),
            "unmatchedFraction": float(row.unmatchedFraction),
            "modeledRiskClass": row.modeledRiskClass,
            "intersectingCells": intersections_by_segment.get(row.segmentId, []),
            "startCoord": {"lng": round(coords[0][0], 5), "lat": round(coords[0][1], 5)},
            "endCoord": {"lng": round(coords[-1][0], 5), "lat": round(coords[-1][1], 5)},
        }

    index_out = public_roads_dir / "road_segments_index.json"
    with open(index_out, "w", encoding="utf-8") as f:
        json.dump(segments_index, f)
    print(f"[ROADS] Exported {len(segments_index)} segments index to {index_out}")

    # 9. Export Topological Road Graph
    graph_edges = []
    for row in gdf.itertuples():
        graph_edges.append({
            "segmentId": row.segmentId,
            "fromNode": int(row.from_node),
            "toNode": int(row.to_node),
            "lengthM": float(row.length_m),
            "highway": row.highway,
            "isUnderpass": bool(row.is_underpass),
            "isBridge": bool(row.is_bridge),
            "maxS": float(row.maxCellSusceptibility),
            "riskClass": row.modeledRiskClass,
        })

    road_graph = {
        "status": "success",
        "cityId": city_id,
        "totalNodes": total_unique_nodes,
        "totalEdges": len(graph_edges),
        "junctionNodesCount": junction_nodes,
        "edges": graph_edges,
        "nodes": node_coords,
    }

    graph_out = public_roads_dir / "road_graph.json"
    with open(graph_out, "w", encoding="utf-8") as f:
        json.dump(road_graph, f)
    print(f"[ROADS] Exported road network graph to {graph_out}")

    # 9b. Export Routing Graph for A* / Dijkstra path calculation
    routing_node_reg = {}
    routing_nodes = []
    routing_edges = []

    for row in gdf.itertuples():
        coords = list(row.geometry.coords)
        for j in range(len(coords) - 1):
            pt1 = (round(coords[j][0], 5), round(coords[j][1], 5))
            pt2 = (round(coords[j + 1][0], 5), round(coords[j + 1][1], 5))
            if pt1 not in routing_node_reg:
                routing_node_reg[pt1] = len(routing_nodes)
                routing_nodes.append([pt1[0], pt1[1]])
            if pt2 not in routing_node_reg:
                routing_node_reg[pt2] = len(routing_nodes)
                routing_nodes.append([pt2[0], pt2[1]])
            u = routing_node_reg[pt1]
            v = routing_node_reg[pt2]

            d_lng = (pt2[0] - pt1[0]) * 111320.0 * np.cos(np.radians(pt1[1]))
            d_lat = (pt2[1] - pt1[1]) * 110540.0
            sub_len_m = round(float(np.hypot(d_lng, d_lat)), 1)
            if sub_len_m < 0.1:
                sub_len_m = 0.5

            routing_edges.append({
                "from": u,
                "to": v,
                "lengthM": sub_len_m,
                "segmentId": row.segmentId,
                "maxS": float(row.maxCellSusceptibility),
                "isUnderpass": bool(row.is_underpass),
                "highway": row.highway,
            })

    routing_graph = {
        "cityId": city_id,
        "totalNodes": len(routing_nodes),
        "totalEdges": len(routing_edges),
        "nodes": routing_nodes,
        "edges": routing_edges,
    }
    routing_out = public_roads_dir / "routing_graph.json"
    with open(routing_out, "w", encoding="utf-8") as f:
        json.dump(routing_graph, f)
    print(f"[ROADS] Exported routing graph ({len(routing_nodes)} nodes, {len(routing_edges)} edges) to {routing_out}")

    # 10. Save summary JSON
    highway_dist = gdf["highway"].value_counts().to_dict()
    risk_dist = gdf["modeledRiskClass"].value_counts().to_dict()
    multi_cell_count = sum(1 for cells in intersections_by_segment.values() if len(cells) > 1)

    summary = {
        "status": "success",
        "cityId": city_id,
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
        "multiCellSegmentsCount": multi_cell_count,
        "majorCorridorsCount": len(major_gdf),
        "highwayClassificationCounts": highway_dist,
        "modeledRiskDistribution": risk_dist,
        "canonicalParquetPath": str(parquet_out),
        "processingDurationSeconds": round(time.time() - start_time, 2),
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    summary_out = public_roads_dir / "road_network_topology.json"
    with open(summary_out, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    pipeline_summary = outputs_dir / f"{city_id}_road_preparation_summary.json"
    with open(pipeline_summary, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"[ROADS] Road network preparation completed in {summary['processingDurationSeconds']}s! Wrote {summary_out}")
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Prepare and standardize road network.")
    parser.add_argument("--source", type=str, default=None, help="Path to input osm_features.gpkg.")
    parser.add_argument("--city", type=str, default="amritsar", help="Target city ID (amritsar or jalandhar).")
    args = parser.parse_args()

    prepare_roads(source_gpkg=args.source, city=args.city)
