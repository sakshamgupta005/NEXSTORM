"""
pipeline/scripts/12_ingest_buildings.py
Ingestion and preprocessing pipeline for building footprints in Amritsar.
Ingests Google Open Buildings V3 via cloud-native FlatGeobuf streaming (or local cached Parquet/FGB),
validates geometries, computes metric area in UTM 43N, matches footprints to NEXSTORM's 250m grid cells,
and generates scalable, cell-partitioned spatial artifacts for the frontend.
"""

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import shapely
from shapely.geometry import Point, Polygon, MultiPolygon, shape

# Add parent directory to sys.path to import utils
sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import WGS84, UTM43N, get_repo_root, exit_with_error

# Canonical remote endpoint (Source Cooperative cloud-native mirror of Google Open Buildings V3 S2 cell 391)
CANONICAL_FGB_URL = "/vsicurl/https://data.source.coop/cholmes/google-open-buildings/fgb-s2/391_buildings.fgb"

# Amritsar target bounding box (South: 31.55, West: 74.75, North: 31.75, East: 75.00)
DEFAULT_BBOX = (74.75, 31.55, 75.00, 31.75)


def generate_stable_building_id(plus_code: str, geom: shapely.Geometry) -> str:
    """Generates a deterministic, stable building identifier from Plus Code and WKT geometry."""
    raw = f"{plus_code}_{geom.wkt[:100]}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]
    return f"GOB-391-{digest}"


def ingest_buildings(
    source_path: str = None,
    bbox: tuple = DEFAULT_BBOX,
    min_confidence: float = 0.65,
    max_records: int = None,
    offline_mode: bool = False,
) -> dict:
    start_time = time.time()
    repo_root = get_repo_root()
    inputs_dir = repo_root / "pipeline" / "inputs"
    outputs_dir = repo_root / "pipeline" / "outputs"
    public_amritsar_dir = repo_root / "public" / "data" / "cities" / "amritsar"
    public_buildings_dir = public_amritsar_dir / "buildings"
    public_gndu_dir = public_amritsar_dir / "gndu"

    outputs_dir.mkdir(parents=True, exist_ok=True)
    public_buildings_dir.mkdir(parents=True, exist_ok=True)
    public_gndu_dir.mkdir(parents=True, exist_ok=True)

    local_cache_parquet = inputs_dir / "google_open_buildings_amritsar.parquet"
    local_cache_fgb = inputs_dir / "google_open_buildings_amritsar.fgb"

    # 1. Determine source
    actual_source = source_path
    if not actual_source:
        if local_cache_fgb.exists():
            actual_source = str(local_cache_fgb)
            print(f"[BUILDINGS] Using local cached FGB: {actual_source}")
        elif local_cache_parquet.exists():
            actual_source = str(local_cache_parquet)
            print(f"[BUILDINGS] Using local cached Parquet: {actual_source}")
        elif offline_mode:
            exit_with_error(
                "Offline mode specified, but local Google Open Buildings cache does not exist at "
                f"{local_cache_parquet} or {local_cache_fgb}."
            )
        else:
            actual_source = CANONICAL_FGB_URL
            print(f"[BUILDINGS] Streaming from canonical cloud-native FlatGeobuf: {actual_source}")

    # 2. Read spatial subset using bounding box
    print(f"[BUILDINGS] Querying bounding box: {bbox}")
    try:
        if actual_source.endswith(".parquet"):
            raw_gdf = gpd.read_parquet(actual_source)
            raw_gdf = raw_gdf.cx[bbox[0]:bbox[2], bbox[1]:bbox[3]]
        else:
            raw_gdf = gpd.read_file(actual_source, bbox=bbox)
    except Exception as e:
        exit_with_error(f"Failed to query building footprints from {actual_source}: {e}")

    total_input = len(raw_gdf)
    print(f"[BUILDINGS] Raw features retrieved: {total_input}")

    if total_input == 0:
        exit_with_error(f"No building footprints found in bounding box {bbox}.")

    if max_records and total_input > max_records:
        raw_gdf = raw_gdf.iloc[:max_records].copy()
        print(f"[BUILDINGS] Limited to {max_records} records for testing.")

    # 3. Geometry Validation and Cleaning
    print("[BUILDINGS] Validating and cleaning geometries...")
    valid_mask = raw_gdf.geometry.notnull() & (~raw_gdf.geometry.is_empty)
    gdf = raw_gdf[valid_mask].copy()

    # Apply make_valid to repair self-intersections or bowtie polygons
    gdf["geometry"] = gdf["geometry"].apply(lambda g: shapely.make_valid(g) if not g.is_valid else g)

    # Filter to only Polygon or MultiPolygon
    polygon_mask = gdf.geometry.apply(lambda g: isinstance(g, (Polygon, MultiPolygon)))
    gdf = gdf[polygon_mask].copy()

    # Filter by confidence threshold
    if "confidence" in gdf.columns:
        gdf = gdf[gdf["confidence"] >= min_confidence].copy()

    # 4. Generate stable IDs and remove duplicates
    print("[BUILDINGS] Generating deterministic stable identifiers...")
    plus_codes = gdf["full_plus_code"].fillna("UNKNOWN") if "full_plus_code" in gdf.columns else ["NOCODE"] * len(gdf)
    stable_ids = [generate_stable_building_id(pc, geom) for pc, geom in zip(plus_codes, gdf.geometry)]
    gdf["buildingId"] = stable_ids

    # Deduplicate
    initial_count = len(gdf)
    gdf = gdf.drop_duplicates(subset=["buildingId"]).copy()
    duplicates_dropped = initial_count - len(gdf)
    if duplicates_dropped > 0:
        print(f"[BUILDINGS] Dropped {duplicates_dropped} duplicate footprint(s).")

    # 5. Metric area calculation in UTM Zone 43N
    print("[BUILDINGS] Computing metric areas in UTM Zone 43N (EPSG:32643)...")
    gdf_utm = gdf.to_crs(UTM43N)
    gdf["area_m2"] = gdf_utm.geometry.area.round(2)

    # Compute centroids in metric UTM first, then reproject to WGS84 to avoid geographic distortion
    centroids_wgs84 = gdf_utm.geometry.centroid.to_crs(WGS84)
    gdf["centroid_lng"] = centroids_wgs84.x.round(6)
    gdf["centroid_lat"] = centroids_wgs84.y.round(6)

    # 6. Intersect with NEXSTORM 250m Susceptibility Grid
    grid_path = public_amritsar_dir / "susceptibility.geojson"
    if not grid_path.exists():
        exit_with_error(f"Susceptibility grid not found at {grid_path}")

    print("[BUILDINGS] Matching centroids to 250m susceptibility grid cells...")
    grid_gdf = gpd.read_file(grid_path)
    if "cellId" not in grid_gdf.columns and "id" in grid_gdf.columns:
        grid_gdf["cellId"] = grid_gdf["id"]
    if "susceptibilityScore" not in grid_gdf.columns and "s" in grid_gdf.columns:
        grid_gdf["susceptibilityScore"] = grid_gdf["s"]

    # Point GeoDataFrame of centroids for spatial join
    centroid_points = [Point(xy) for xy in zip(gdf["centroid_lng"], gdf["centroid_lat"])]
    centroids_gdf = gpd.GeoDataFrame(
        {"buildingId": gdf["buildingId"]},
        geometry=centroid_points,
        crs=WGS84,
    )

    joined = gpd.sjoin(
        centroids_gdf,
        grid_gdf[["cellId", "susceptibilityScore", "geometry"]],
        how="left",
        predicate="within",
    )
    # Deduplicate in case a point lies precisely on cell boundary
    joined = joined.drop_duplicates(subset=["buildingId"])

    # Merge join results back
    gdf = gdf.merge(
        joined[["buildingId", "cellId", "susceptibilityScore"]],
        on="buildingId",
        how="left",
    )
    gdf["cellId"] = gdf["cellId"].fillna("UNMATCHED")
    gdf["susceptibilityScore"] = gdf["susceptibilityScore"].fillna(0.0)

    # Assign Exposure Category (strictly separate from physical building vulnerability)
    def categorize_exposure(score: float, matched: bool) -> str:
        if not matched:
            return "unmatched"
        if score >= 0.66:
            return "high_catchment"
        if score >= 0.33:
            return "moderate_catchment"
        return "minimal"

    gdf["exposureCategory"] = [
        categorize_exposure(score, cid != "UNMATCHED")
        for score, cid in zip(gdf["susceptibilityScore"], gdf["cellId"])
    ]

    # Scientific guardrail disclaimer
    gdf["caveat"] = "Macro-catchment exposure only; does NOT predict indoor water depth or structural safety."

    # 7. Extract GNDU Campus Footprints
    gndu_campus_path = inputs_dir / "gndu_campus.geojson"
    gndu_count = 0
    gndu_out_path = public_gndu_dir / "buildings.geojson"
    gndu_temp = public_gndu_dir / "buildings.geojson.tmp"
    if gndu_campus_path.exists():
        print("[BUILDINGS] Extracting footprints strictly inside GNDU campus...")
        gndu_boundary = gpd.read_file(gndu_campus_path)
        gndu_poly = gndu_boundary.geometry.iloc[0]
        gndu_buildings = gdf[gdf.geometry.intersects(gndu_poly)].copy()
        gndu_count = len(gndu_buildings)

        # Export compact GNDU GeoJSON
        if gndu_count > 0:
            gndu_export_cols = ["buildingId", "area_in_meters", "area_m2", "confidence", "exposureCategory", "geometry"]
            available_gndu_cols = [c for c in gndu_export_cols if c in gndu_buildings.columns]
            gndu_buildings[available_gndu_cols].to_file(gndu_temp, driver="GeoJSON")
            if gndu_out_path.exists():
                gndu_out_path.unlink()
            gndu_temp.rename(gndu_out_path)
            print(f"[BUILDINGS] Wrote {gndu_count} GNDU campus building footprints to {gndu_out_path}")
        else:
            with open(gndu_out_path, "w", encoding="utf-8") as f:
                json.dump({"type": "FeatureCollection", "features": []}, f)

    # 8. Extract Hotspots Cluster Footprints (300m buffer around 15 verified hotspots)
    hotspots_path = public_amritsar_dir / "hotspots.json"
    hotspots_count = 0
    hotspots_out_path = public_buildings_dir / "hotspot_buildings.geojson"
    hotspots_temp = public_buildings_dir / "hotspot_buildings.geojson.tmp"
    if hotspots_path.exists():
        print("[BUILDINGS] Extracting footprints within 300m buffer of historical hotspots...")
        with open(hotspots_path, "r", encoding="utf-8") as f:
            hotspots_data = json.load(f)
        
        hotspot_pts = [
            Point(h.get("lon", h.get("lng")), h["lat"])
            for h in hotspots_data
            if "lat" in h and ("lon" in h or "lng" in h)
        ]
        if len(hotspot_pts) > 0:
            hotspots_gdf = gpd.GeoDataFrame(geometry=hotspot_pts, crs=WGS84).to_crs(UTM43N)
            hotspot_buffers = shapely.unary_union(hotspots_gdf.geometry.buffer(300))
            
            # Intersect with UTM buildings
            hotspot_buildings_utm = gdf_utm[gdf_utm.geometry.intersects(hotspot_buffers)]
            hotspot_buildings = gdf.loc[hotspot_buildings_utm.index].copy()
            hotspots_count = len(hotspot_buildings)

            # Export compact Hotspot buildings GeoJSON
            if hotspots_count > 0:
                hotspot_export_cols = [
                    "buildingId", "area_m2", "confidence", "cellId", "susceptibilityScore", "exposureCategory", "geometry"
                ]
                available_hotspot_cols = [c for c in hotspot_export_cols if c in hotspot_buildings.columns]
                hotspot_buildings[available_hotspot_cols].to_file(hotspots_temp, driver="GeoJSON")
                if hotspots_out_path.exists():
                    hotspots_out_path.unlink()
                hotspots_temp.rename(hotspots_out_path)
                print(f"[BUILDINGS] Wrote {hotspots_count} hotspot cluster footprints to {hotspots_out_path}")
            else:
                with open(hotspots_out_path, "w", encoding="utf-8") as f:
                    json.dump({"type": "FeatureCollection", "features": []}, f)

    # 9. Build Aggregated Cell Exposure Index (`cell_index.json`)
    print("[BUILDINGS] Building aggregated cell exposure index...")
    matched_gdf = gdf[gdf["cellId"] != "UNMATCHED"]
    cell_groups = matched_gdf.groupby("cellId")

    cell_index = {}
    for cell_id, group in cell_groups:
        b_count = len(group)
        total_area = float(group["area_m2"].sum().round(2))
        mean_area = float(group["area_m2"].mean().round(2))
        high_conf = int((group["confidence"] >= 0.75).sum()) if "confidence" in group.columns else b_count
        mean_conf = float(group["confidence"].mean().round(3)) if "confidence" in group.columns else 1.0
        exp_cat = group["exposureCategory"].iloc[0]

        cell_index[cell_id] = {
            "buildingCount": b_count,
            "totalFootprintAreaM2": total_area,
            "meanFootprintAreaM2": mean_area,
            "highConfidenceCount": high_conf,
            "meanConfidence": mean_conf,
            "exposureCategory": exp_cat,
        }

    cell_index_out = public_buildings_dir / "cell_index.json"
    cell_index_tmp = public_buildings_dir / "cell_index.json.tmp"
    with open(cell_index_tmp, "w", encoding="utf-8") as f:
        json.dump(
            {
                "version": "1.0.0",
                "city": "amritsar",
                "source": "Google Open Buildings V3",
                "license": "CC-BY-4.0",
                "attribution": "Google Research (Open Buildings V3)",
                "totalIndexedBuildings": len(matched_gdf),
                "matchedCellCount": len(cell_index),
                "cells": cell_index,
            },
            f,
            indent=2,
        )
    if cell_index_out.exists():
        cell_index_out.unlink()
    cell_index_tmp.rename(cell_index_out)
    print(f"[BUILDINGS] Wrote cell index ({len(cell_index)} cells) to {cell_index_out}")

    # 10. Save Canonical Parquet Dataset
    print("[BUILDINGS] Saving canonical Parquet dataset...")
    parquet_out = outputs_dir / "amritsar_buildings.parquet"
    parquet_tmp = outputs_dir / "amritsar_buildings.parquet.tmp"
    
    # Keep essential columns for compact storage
    save_cols = [
        "buildingId", "area_m2", "confidence", "centroid_lng", "centroid_lat",
        "cellId", "susceptibilityScore", "exposureCategory", "caveat", "geometry"
    ]
    available_save_cols = [c for c in save_cols if c in gdf.columns]
    gdf[available_save_cols].to_parquet(parquet_tmp, compression="snappy")
    if parquet_out.exists():
        parquet_out.unlink()
    parquet_tmp.rename(parquet_out)
    parquet_size_mb = parquet_out.stat().st_size / (1024 * 1024)
    print(f"[BUILDINGS] Wrote canonical Parquet ({len(gdf)} footprints, {parquet_size_mb:.2f} MB) to {parquet_out}")

    # Also save as local cached input for offline runs
    if not local_cache_parquet.exists():
        gdf[available_save_cols].to_parquet(local_cache_parquet, compression="snappy")
        print(f"[BUILDINGS] Cached local copy to {local_cache_parquet} for offline mode.")

    duration = round(time.time() - start_time, 2)
    summary = {
        "status": "success",
        "source": "Google Open Buildings V3",
        "license": "CC-BY-4.0",
        "attribution": "Google Research (Open Buildings V3)",
        "retrievalUrl": CANONICAL_FGB_URL,
        "boundingBox": list(bbox),
        "totalInputFeatures": total_input,
        "validBuildingsRetained": len(gdf),
        "duplicatesRemoved": duplicates_dropped,
        "matchedToGridCount": len(matched_gdf),
        "unmatchedOutsideGrid": int((gdf["cellId"] == "UNMATCHED").sum()),
        "gnduCampusBuildings": gndu_count,
        "hotspotClusterBuildings": hotspots_count,
        "cellsWithBuildings": len(cell_index),
        "canonicalParquetSizeMb": round(parquet_size_mb, 2),
        "processingDurationSeconds": duration,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    summary_path = outputs_dir / "building_ingestion_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(f"[BUILDINGS] Ingestion complete in {duration}s! Summary written to {summary_path}")

    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest and preprocess building footprints for Amritsar.")
    parser.add_argument("--source", type=str, default=None, help="Local file path or URL.")
    parser.add_argument("--bbox", type=float, nargs=4, default=None, help="Bounding box: minx miny maxx maxy.")
    parser.add_argument("--min-confidence", type=float, default=0.65, help="Confidence threshold (0.65 to 1.0).")
    parser.add_argument("--max-records", type=int, default=None, help="Cap records for fast testing.")
    parser.add_argument("--offline", action="store_true", help="Fail if local cache not present.")
    args = parser.parse_args()

    bbox_tuple = tuple(args.bbox) if args.bbox else DEFAULT_BBOX

    ingest_buildings(
        source_path=args.source,
        bbox=bbox_tuple,
        min_confidence=args.min_confidence,
        max_records=args.max_records,
        offline_mode=args.offline,
    )
