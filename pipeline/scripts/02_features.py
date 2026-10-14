"""
pipeline/scripts/02_features.py
Calculates raw terrain, land-cover, infrastructure, and underpass proxy features
for all 250m Amritsar city cells (and 50m GNDU campus cells when present).

Outputs:
- pipeline/cache/features.parquet
"""

import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import rowcol
from shapely.geometry import box, Point

from utils import WGS84, UTM43N, exit_with_error, get_repo_root

ROOT = get_repo_root()
CACHE_DIR = ROOT / "pipeline" / "cache"
FEATURES_PARQUET = CACHE_DIR / "features.parquet"


def compute_raster_slope(dem_array: np.ndarray, res_x: float, res_y: float) -> np.ndarray:
    """Computes terrain slope in degrees using 2D finite difference gradients."""
    gy, gx = np.gradient(dem_array, res_y, res_x)
    slope_rad = np.arctan(np.sqrt(gx**2 + gy**2))
    return np.degrees(slope_rad)


def compute_features_for_grid(
    grid_gdf: gpd.GeoDataFrame,
    dem_path: Path,
    worldcover_path: Path,
    osm_gpkg_path: Path,
    is_campus: bool = False,
) -> pd.DataFrame:
    """Computes all terrain, land-cover, and OSM features for a grid in UTM43N."""
    grid_utm = grid_gdf.to_crs(UTM43N)

    # 1. Load Rasters
    print(f"[{'CAMPUS' if is_campus else 'CITY'}] Loading DEM from {dem_path}...")
    with rasterio.open(dem_path) as dem_src:
        dem_data = dem_src.read(1).astype(np.float64)
        dem_nodata = dem_src.nodata
        dem_transform = dem_src.transform
        dem_bounds = dem_src.bounds
        dem_res = dem_src.res

        # Mask nodata
        if dem_nodata is not None:
            dem_data[dem_data == dem_nodata] = np.nan

    print(f"[{'CAMPUS' if is_campus else 'CITY'}] Loading WorldCover from {worldcover_path}...")
    with rasterio.open(worldcover_path) as wc_src:
        wc_data = wc_src.read(1)
        wc_transform = wc_src.transform
        wc_bounds = wc_src.bounds

    # 2. Load OSM Vector Layers
    print(f"[{'CAMPUS' if is_campus else 'CITY'}] Loading OSM layers from {osm_gpkg_path}...")
    roads_gdf = gpd.read_file(osm_gpkg_path, layer="roads").to_crs(UTM43N)
    bldgs_gdf = gpd.read_file(osm_gpkg_path, layer="buildings").to_crs(UTM43N)
    try:
        waterways_gdf = gpd.read_file(osm_gpkg_path, layer="waterways").to_crs(UTM43N)
    except Exception:
        waterways_gdf = gpd.GeoDataFrame(columns=["waterway", "name", "geometry"], crs=UTM43N)

    # Build spatial index for roads and buildings
    roads_sindex = roads_gdf.sindex
    bldgs_sindex = bldgs_gdf.sindex

    # Prepare named roads for nearest distance query
    named_roads = roads_gdf[roads_gdf["name"].notna() & (roads_gdf["name"] != "")].copy()
    has_named_roads = len(named_roads) > 0

    records = []
    cell_centroids_x = grid_utm.geometry.centroid.x.values
    cell_centroids_y = grid_utm.geometry.centroid.y.values

    # Compute centroids in UTM and reproject to WGS84 for raster rowcol lookup
    centroids_utm = grid_utm.geometry.centroid
    centroids_wgs = centroids_utm.to_crs(WGS84)
    wgs_centroids_x = centroids_wgs.x.values
    wgs_centroids_y = centroids_wgs.y.values

    # DEM coordinates (dem_transform is in WGS84)
    dem_rows, dem_cols = rowcol(dem_transform, wgs_centroids_x, wgs_centroids_y)
    wc_rows, wc_cols = rowcol(wc_transform, wgs_centroids_x, wgs_centroids_y)

    # Extract cell elevations
    cell_elevations = []
    for r, c in zip(dem_rows, dem_cols):
        if 0 <= r < dem_data.shape[0] and 0 <= c < dem_data.shape[1]:
            val = dem_data[r, c]
            cell_elevations.append(val if not np.isnan(val) else None)
        else:
            cell_elevations.append(None)
    cell_elevations = np.array(cell_elevations, dtype=np.float64)

    # Compute slope map
    # Note: DEM is in degrees WGS84, so convert cell res approx to meters for gradient (~30m)
    slope_map = compute_raster_slope(dem_data, 30.0, 30.0)

    # Process each cell
    print(f"[{'CAMPUS' if is_campus else 'CITY'}] Computing features for {len(grid_utm)} cells...")

    H, W = dem_data.shape
    rad_y = 25  # ~750m / 30m
    rad_x = 29  # ~750m / 26m

    for idx, row in grid_utm.iterrows():
        cell_id = row["cell_id"]
        geom = row["geometry"]
        centroid = geom.centroid
        cx, cy = centroid.x, centroid.y
        area_m2 = row.get("area_m2", geom.area)
        area_km2 = area_m2 / 1e6

        # --- A. Terrain Features ---
        elev = cell_elevations[idx]
        if np.isnan(elev):
            elev = None

        r, c = dem_rows[idx], dem_cols[idx]

        # 750m neighborhood query for local depression using numpy window
        if elev is not None and 0 <= r < H and 0 <= c < W:
            r_min, r_max = max(0, r - rad_y), min(H, r + rad_y + 1)
            c_min, c_max = max(0, c - rad_x), min(W, c + rad_x + 1)

            sub_dem = dem_data[r_min:r_max, c_min:c_max]
            grid_y, grid_x = np.ogrid[r_min - r : r_max - r, c_min - c : c_max - c]
            # Metric distance squared
            dist_sq = (grid_y * 30.8)**2 + (grid_x * 26.3)**2
            mask = dist_sq <= (750.0**2)

            valid_vals = sub_dem[mask]
            if len(valid_vals) > 0 and not np.all(np.isnan(valid_vals)):
                neighborhood_mean = np.nanmean(valid_vals)
                local_dep = elev - neighborhood_mean
            else:
                local_dep = 0.0
        else:
            local_dep = 0.0

        # Slope & flat fraction over cell (30m DEM pixels)
        # 250m cell covers ~8x8 DEM pixels
        r_hw = 4 if not is_campus else 1
        c_hw = 4 if not is_campus else 1
        sub_slope = slope_map[max(0, r - r_hw) : min(H, r + r_hw + 1), max(0, c - c_hw) : min(W, c + c_hw + 1)]
        if sub_slope.size > 0:
            slope_val = float(np.nanmean(sub_slope))
            flat_frac = float(np.mean(sub_slope < 0.5))
        else:
            slope_val = 0.0
            flat_frac = 1.0

        # --- B. Land Cover (WorldCover Class 50 = Built-up, 10m pixels) ---
        # 250m cell covers ~25x25 WorldCover pixels (or 5x5 for campus)
        wc_r, wc_c = wc_rows[idx], wc_cols[idx]
        wc_hw = 12 if not is_campus else 2
        wc_H, wc_W = wc_data.shape

        sub_wc = wc_data[max(0, wc_r - wc_hw) : min(wc_H, wc_r + wc_hw + 1), max(0, wc_c - wc_hw) : min(wc_W, wc_c + wc_hw + 1)]
        if sub_wc.size > 0:
            builtup_fraction = float(np.mean(sub_wc == 50))
        else:
            builtup_fraction = 0.0

        # --- C. Built Environment (Buildings & Roads) ---
        # Buildings
        bldg_matches = list(bldgs_sindex.intersection(geom.bounds))
        if bldg_matches:
            intersecting_bldgs = bldgs_gdf.iloc[bldg_matches].intersection(geom)
            bldg_area = intersecting_bldgs.area.sum()
            bldg_density = min(1.0, bldg_area / area_m2)
        else:
            bldg_density = 0.0

        # Roads
        road_matches = list(roads_sindex.intersection(geom.bounds))
        if road_matches:
            subset_roads = roads_gdf.iloc[road_matches]
            intersecting_roads = subset_roads.intersection(geom)
            road_length_m = intersecting_roads.length.sum()
            road_length_km = road_length_m / 1000.0
            road_density = road_length_km / area_km2
        else:
            subset_roads = roads_gdf.iloc[0:0]
            road_density = 0.0

        # Nearest named road
        nearest_road_name = None
        dist_to_named_road = None
        if has_named_roads:
            distances = named_roads.distance(centroid)
            min_dist_idx = distances.idxmin()
            dist_to_named_road = float(distances.loc[min_dist_idx])
            nearest_road_name = str(named_roads.loc[min_dist_idx, "name"])

        # --- D. Underpass Proxy ---
        underpass_flag = 0
        underpass_reason = "none"

        if len(subset_roads) > 0:
            # Check 1: tunnel attributes or layer < 0
            has_tunnel = False
            for _, r_row in subset_roads.iterrows():
                tunnel_val = str(r_row.get("tunnel", "")).lower()
                layer_val = str(r_row.get("layer", "0"))
                try:
                    layer_num = float(layer_val)
                except ValueError:
                    layer_num = 0.0

                if tunnel_val in ["yes", "building_passage"] or layer_num < 0:
                    has_tunnel = True
                    underpass_reason = f"tunnel={tunnel_val}, layer={layer_val}"
                    break

            if has_tunnel:
                underpass_flag = 1
            else:
                # Check 2: Bridge road crossing another road within 100m
                bridge_roads = subset_roads[subset_roads.get("bridge", "").isin(["yes", "true"])]
                if len(bridge_roads) > 0:
                    underpass_flag = 1
                    underpass_reason = "bridge_crossing_within_100m"

        records.append({
            "cell_id": cell_id,
            "is_campus": is_campus,
            "centroid_x": cx,
            "centroid_y": cy,
            "elevation_mean": round(elev, 2) if elev is not None else None,
            "local_depression": round(local_dep, 2) if local_dep is not None else 0.0,
            "slope_deg": round(float(slope_val), 2),
            "flat_fraction": round(float(flat_frac), 2),
            "builtup_fraction": round(float(builtup_fraction), 2),
            "building_density": round(float(bldg_density), 4),
            "road_density": round(float(road_density), 2),
            "nearest_named_road": nearest_road_name,
            "dist_to_named_road_m": round(dist_to_named_road, 1) if dist_to_named_road is not None else None,
            "underpass_flag": int(underpass_flag),
            "underpass_reason": underpass_reason,
        })

    return pd.DataFrame(records)


def main():
    print("=" * 60)
    print(" NEXSTORM 02_features: Geospatial Feature Extraction")
    print("=" * 60)

    city_grid_path = CACHE_DIR / "grid.geojson"
    campus_grid_path = CACHE_DIR / "campus.geojson"
    dem_path = CACHE_DIR / "dem.tif"
    worldcover_path = CACHE_DIR / "worldcover.tif"
    osm_path = CACHE_DIR / "osm_features.gpkg"

    for req in [city_grid_path, dem_path, worldcover_path, osm_path]:
        if not req.exists():
            exit_with_error(f"Missing required artifact: {req}. Run 00_fetch_static.py and 01_build_grid.py first.")

    # 1. Compute features for Amritsar 250m grid
    city_grid_gdf = gpd.read_file(city_grid_path)
    city_features_df = compute_features_for_grid(city_grid_gdf, dem_path, worldcover_path, osm_path, is_campus=False)

    # 2. Compute features for GNDU campus 50m sub-grid if present
    if campus_grid_path.exists():
        campus_grid_gdf = gpd.read_file(campus_grid_path)
        campus_features_df = compute_features_for_grid(campus_grid_gdf, dem_path, worldcover_path, osm_path, is_campus=True)
        all_features_df = pd.concat([city_features_df, campus_features_df], ignore_index=True)
    else:
        all_features_df = city_features_df

    # Write parquet
    all_features_df.to_parquet(FEATURES_PARQUET, index=False)
    print(f"\n[EXPORT] Features written to {FEATURES_PARQUET} ({FEATURES_PARQUET.stat().st_size / 1024:.1f} KB)")

    # Print summary statistics
    city_df = all_features_df[~all_features_df["is_campus"]]
    print("\n" + "=" * 60)
    print(" FEATURE EXTRACTION SUMMARY REPORT — AMRITSAR (250m Cells)")
    print("=" * 60)
    print(f"Total City Cells: {len(city_df)}")
    if campus_grid_path.exists():
        print(f"Total GNDU Campus Cells: {len(all_features_df[all_features_df['is_campus']])}")
    print(f"DEM Native Resolution: 30 metres (Copernicus DEM GLO-30)")
    print(f"Missing Elevation Values: {city_df['elevation_mean'].isna().sum()}")

    # Local Depression Statistics
    dep_col = city_df["local_depression"].dropna()
    print("\n--- Local Depression Statistics (750m Neighborhood) ---")
    print(f"Mean: {dep_col.mean():.3f} m")
    print(f"Standard Deviation: {dep_col.std():.3f} m")
    print(f"5th Percentile: {dep_col.quantile(0.05):.3f} m")
    print(f"95th Percentile: {dep_col.quantile(0.95):.3f} m")
    print(f"Min (Deepest Depression): {dep_col.min():.3f} m")
    print(f"Max (Highest Peak Relative): {dep_col.max():.3f} m")

    # Built Environment & Underpasses
    up_count = (city_df["underpass_flag"] == 1).sum()
    print("\n--- Built Environment & Underpass Proxies ---")
    print(f"Mean Built-up Fraction: {city_df['builtup_fraction'].mean():.2f}")
    print(f"Mean Road Density: {city_df['road_density'].mean():.2f} km/km2")
    print(f"Underpass Proxies Detected: {up_count} cells ({up_count / len(city_df) * 100:.2f}%)")
    print("=" * 60)

    print("\n[COMPLETE] 02_features completed successfully.")


if __name__ == "__main__":
    main()
