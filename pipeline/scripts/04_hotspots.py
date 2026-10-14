"""
pipeline/scripts/04_hotspots.py
Parses, validates, deduplicates, and snaps historical waterlogging hotspot reports
to the Amritsar analysis grid cells.
"""

from datetime import datetime
import json
from pathlib import Path
import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import Point

from utils import UTM43N, WGS84, exit_with_error, get_repo_root

ROOT = get_repo_root()
INPUTS_DIR = ROOT / "pipeline" / "inputs"
PUBLIC_DATA_DIR = ROOT / "public" / "data" / "cities" / "amritsar"


def parse_and_validate_date(date_str: str | None) -> str | None:
    """Validates that dates parse correctly into ISO YYYY-MM-DD.
    Returns None if date is missing or unparseable."""
    if not date_str or pd.isna(date_str):
        return None
    date_str = str(date_str).strip()
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            dt = datetime.strptime(date_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def merge_nearby_same_date_hotspots(gdf_utm: gpd.GeoDataFrame, dist_threshold_m: float = 150.0) -> tuple[gpd.GeoDataFrame, int]:
    """Merges duplicates for the same date when within dist_threshold_m (150m).
    Preserves source attribution and evidence metadata for merged records."""
    if len(gdf_utm) <= 1:
        return gdf_utm, 0

    merged_records = []
    merged_count = 0
    visited = set()

    for i in range(len(gdf_utm)):
        if i in visited:
            continue

        row_i = gdf_utm.iloc[i]
        date_i = row_i["articleDate"]
        geom_i = row_i["geometry"]

        cluster_indices = [i]
        visited.add(i)

        for j in range(i + 1, len(gdf_utm)):
            if j in visited:
                continue
            row_j = gdf_utm.iloc[j]
            date_j = row_j["articleDate"]

            # Same date match
            if date_i == date_j:
                dist = geom_i.distance(row_j["geometry"])
                if dist <= dist_threshold_m:
                    cluster_indices.append(j)
                    visited.add(j)

        if len(cluster_indices) > 1:
            merged_count += len(cluster_indices) - 1
            # Merge records: keep first primary, aggregate sourceUrls and names
            cluster_rows = gdf_utm.iloc[cluster_indices]
            all_sources = list(dict.fromkeys(cluster_rows["sourceUrl"].dropna().tolist()))
            merged_record = row_i.to_dict()
            merged_record["sourceUrl"] = "; ".join(all_sources) if all_sources else row_i["sourceUrl"]
            merged_record["mergedCount"] = len(cluster_indices)
            merged_records.append(merged_record)
        else:
            merged_record = row_i.to_dict()
            merged_record["mergedCount"] = 1
            merged_records.append(merged_record)

    merged_gdf = gpd.GeoDataFrame(merged_records, crs=gdf_utm.crs)
    return merged_gdf, merged_count


def main():
    print("=" * 60)
    print(" NEXSTORM 04_hotspots: Waterlogging Hotspot Validation & Snapping")
    print("=" * 60)

    city_boundary_path = INPUTS_DIR / "city_boundary.geojson"
    city_grid_path = PUBLIC_DATA_DIR / "grid.geojson"
    manual_csv_path = INPUTS_DIR / "hotspots_manual.csv"
    groundsource_path = INPUTS_DIR / "groundsource.parquet"

    if not city_boundary_path.exists():
        exit_with_error(f"Missing city boundary: {city_boundary_path}")
    if not city_grid_path.exists():
        exit_with_error(f"Missing city grid: {city_grid_path}")

    boundary_gdf = gpd.read_file(city_boundary_path).to_crs(WGS84)
    boundary_geom = boundary_gdf.unary_union

    grid_gdf = gpd.read_file(city_grid_path).to_crs(WGS84)

    raw_records = []
    invalid_coord_count = 0
    missing_date_count = 0
    missing_source_count = 0

    # 1. Load manual hotspots CSV
    if manual_csv_path.exists():
        df_manual = pd.read_csv(manual_csv_path)
        print(f"[INPUT] Loaded {len(df_manual)} manual records from {manual_csv_path}")
        for idx, row in df_manual.iterrows():
            name = str(row.get("name", "")).strip()
            lat = row.get("lat")
            lon = row.get("lon")
            source_url = row.get("sourceUrl")
            raw_date = row.get("articleDate")
            precision = str(row.get("precision", "street")).strip()

            parsed_date = parse_and_validate_date(raw_date)
            if parsed_date is None:
                missing_date_count += 1
            if not source_url or pd.isna(source_url):
                missing_source_count += 1

            try:
                lat = float(lat)
                lon = float(lon)
                if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
                    invalid_coord_count += 1
                    continue
            except (ValueError, TypeError):
                invalid_coord_count += 1
                continue

            raw_records.append({
                "name": name,
                "lat": lat,
                "lon": lon,
                "sourceUrl": str(source_url) if pd.notna(source_url) else None,
                "articleDate": parsed_date,
                "evidence": "news_report",
                "precision": precision if precision in ["street", "intersection", "ward"] else "street",
                "geometry": Point(lon, lat),
            })
    else:
        print(f"[INPUT] Manual hotspots CSV not found: {manual_csv_path}")

    # 2. Load optional Groundsource Parquet
    if groundsource_path.exists():
        try:
            df_gs = pd.read_parquet(groundsource_path)
            print(f"[INPUT] Loaded {len(df_gs)} groundsource records from {groundsource_path}")
            for _, row in df_gs.iterrows():
                lat = row.get("latitude") or row.get("lat")
                lon = row.get("longitude") or row.get("lon")
                name = str(row.get("name") or row.get("location") or "Groundsource Event").strip()
                source_url = row.get("source_url") or row.get("sourceUrl") or "groundsource"
                raw_date = row.get("event_date") or row.get("date") or row.get("articleDate")
                parsed_date = parse_and_validate_date(raw_date)

                try:
                    lat = float(lat)
                    lon = float(lon)
                    if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
                        invalid_coord_count += 1
                        continue
                except (ValueError, TypeError):
                    invalid_coord_count += 1
                    continue

                raw_records.append({
                    "name": name,
                    "lat": lat,
                    "lon": lon,
                    "sourceUrl": str(source_url),
                    "articleDate": parsed_date,
                    "evidence": "groundsource",
                    "precision": "sensor",
                    "geometry": Point(lon, lat),
                })
        except Exception as e:
            print(f"[WARN] Error reading groundsource.parquet: {e}")
    else:
        print("[INPUT] Optional groundsource.parquet not supplied.")

    if not raw_records:
        exit_with_error("No hotspot records found to process.")

    gdf_raw = gpd.GeoDataFrame(raw_records, crs=WGS84)

    # 3. Spatial Boundary Validation (Filter out-of-boundary)
    in_boundary_mask = gdf_raw.geometry.within(boundary_geom)
    out_of_boundary_count = int((~in_boundary_mask).sum())
    gdf_valid = gdf_raw[in_boundary_mask].copy().reset_index(drop=True)

    print(f"[VALIDATION] In-boundary: {len(gdf_valid)}, Out-of-boundary: {out_of_boundary_count}, Invalid coords: {invalid_coord_count}")

    # 4. Same-Date Deduplication within 150m (in metric UTM Zone 43N)
    gdf_utm = gdf_valid.to_crs(UTM43N)
    gdf_dedup_utm, merged_count = merge_nearby_same_date_hotspots(gdf_utm, dist_threshold_m=150.0)
    gdf_dedup = gdf_dedup_utm.to_crs(WGS84)

    # 5. Snap to Grid Cells
    snapped_records = []
    # Spatial join with grid_gdf
    joined = gpd.sjoin(gdf_dedup, grid_gdf[["cell_id", "geometry"]], how="inner", predicate="within")

    # Deterministic sorting
    joined = joined.sort_values(by=["articleDate", "name", "lat", "lon"]).reset_index(drop=True)

    for idx, row in joined.iterrows():
        hotspot_id = f"H-{idx + 1:04d}"
        snapped_records.append({
            "id": hotspot_id,
            "name": str(row["name"]),
            "lat": round(float(row["lat"]), 6),
            "lon": round(float(row["lon"]), 6),
            "cellId": str(row["cell_id"]),
            "sourceUrl": str(row["sourceUrl"]) if pd.notna(row["sourceUrl"]) else None,
            "articleDate": str(row["articleDate"]) if pd.notna(row["articleDate"]) else None,
            "evidence": str(row["evidence"]),
            "precision": str(row["precision"]),
        })

    # Summary Statistics
    distinct_locations = len(set(r["name"] for r in snapped_records))
    dated_events = len([r for r in snapped_records if r["articleDate"] is not None])
    evidence_counts = pd.Series([r["evidence"] for r in snapped_records]).value_counts().to_dict()

    print("\n--- Hotspot Processing Summary ---")
    print(f"Total Hotspot Records Created: {len(snapped_records)}")
    print(f"Distinct Locations: {distinct_locations}")
    print(f"Dated Events: {dated_events}")
    print(f"Counts by Evidence Type: {evidence_counts}")
    print(f"Out-of-Boundary Records Rejected: {out_of_boundary_count}")
    print(f"Duplicate Records Merged (< 150m, same date): {merged_count}")
    print(f"Missing Dates: {missing_date_count} | Missing Sources: {missing_source_count}")

    if distinct_locations < 15:
        print("\nWARNING: E2 will be descriptive only")

    # 6. Export to public/data/cities/amritsar/hotspots.json
    out_hotspots_path = PUBLIC_DATA_DIR / "hotspots.json"
    with open(out_hotspots_path, "w", encoding="utf-8") as f:
        json.dump(snapped_records, f, indent=2)
    print(f"\n[EXPORT] Hotspots written to {out_hotspots_path}")

    print("\n[COMPLETE] 04_hotspots completed successfully.")


if __name__ == "__main__":
    main()
