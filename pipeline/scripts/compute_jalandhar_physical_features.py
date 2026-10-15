"""
pipeline/scripts/compute_jalandhar_physical_features.py
NEXSTORM P25: Physical Feature Extraction & Susceptibility Generation for Jalandhar.

Replaces analytical coordinate-decay formulas with real feature extraction from:
- Copernicus DEM GLO-30 30m raster (pipeline/cache/jalandhar/dem.tif)
- ESA WorldCover 2021 10m raster (pipeline/cache/jalandhar/worldcover.tif)
- OpenStreetMap road network & waterways (pipeline/cache/jalandhar/osm_features.gpkg)

Outputs:
- public/data/cities/jalandhar/susceptibility.geojson
- pipeline/cache/jalandhar/features.parquet
"""

import json
from pathlib import Path
import sys

import geopandas as gpd
import numpy as np
import pandas as pd
import rasterio
from rasterio.transform import rowcol
from shapely.geometry import box

sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils import WGS84, UTM43N, get_repo_root, compute_sha256

ROOT = get_repo_root()
JALANDHAR_DIR = ROOT / "public" / "data" / "cities" / "jalandhar"
CACHE_DIR = ROOT / "pipeline" / "cache" / "jalandhar"

GRID_PATH = JALANDHAR_DIR / "grid.geojson"
DEM_PATH = CACHE_DIR / "dem.tif"
WC_PATH = CACHE_DIR / "worldcover.tif"
OSM_PATH = CACHE_DIR / "osm_features.gpkg"
SUSC_OUT = JALANDHAR_DIR / "susceptibility.geojson"
FEATURES_PARQUET = CACHE_DIR / "features.parquet"


def compute_raster_slope(dem_array: np.ndarray, res_y_m: float, res_x_m: float) -> np.ndarray:
    """Computes slope in degrees using 2D finite difference gradients."""
    gy, gx = np.gradient(dem_array, res_y_m, res_x_m)
    slope_rad = np.arctan(np.sqrt(gx**2 + gy**2))
    return np.degrees(slope_rad)


def rank_series(series: pd.Series) -> pd.Series:
    """Deterministic 0-1 relative rank within a series using average tie-breaking."""
    valid = series.dropna()
    if len(valid) <= 1 or valid.nunique() <= 1:
        return pd.Series(0.5, index=series.index)
    ranks = series.rank(method="average", ascending=True)
    return (ranks - 1.0) / (len(series) - 1.0)


def extract_physical_features():
    print("=== NEXSTORM P25: Extracting Real Physical Features for Jalandhar ===")
    
    # 1. Load Grid
    print(f"[GRID] Loading analysis grid from {GRID_PATH}...")
    grid_wgs = gpd.read_file(GRID_PATH)
    grid_utm = grid_wgs.to_crs(UTM43N)
    n_cells = len(grid_utm)
    print(f"[GRID] Total cells: {n_cells}")

    # 2. Load DEM Raster
    print(f"[DEM] Loading Copernicus DEM from {DEM_PATH}...")
    with rasterio.open(DEM_PATH) as dem_src:
        dem_data = dem_src.read(1).astype(np.float64)
        dem_nodata = dem_src.nodata
        dem_transform = dem_src.transform
        if dem_nodata is not None:
            dem_data[dem_data == dem_nodata] = np.nan

    # Slope map in degrees (~30.8m Y, ~26.3m X at 31.3°N)
    slope_map = compute_raster_slope(dem_data, 30.8, 26.3)
    H, W = dem_data.shape

    # 3. Load WorldCover Raster
    print(f"[WORLDCOVER] Loading ESA WorldCover from {WC_PATH}...")
    with rasterio.open(WC_PATH) as wc_src:
        wc_data = wc_src.read(1)
        wc_transform = wc_src.transform
    wc_H, wc_W = wc_data.shape

    # 4. Load OSM Vectors
    print(f"[OSM] Loading OSM features from {OSM_PATH}...")
    roads_gdf = gpd.read_file(OSM_PATH, layer="roads").to_crs(UTM43N)
    roads_sindex = roads_gdf.sindex
    print(f"[OSM] Roads loaded: {len(roads_gdf)}")

    # Centroids in WGS84 for raster rowcol lookups
    centroids_wgs = grid_utm.geometry.centroid.to_crs(WGS84)
    wgs_cx = centroids_wgs.x.values
    wgs_cy = centroids_wgs.y.values

    dem_rows, dem_cols = rowcol(dem_transform, wgs_cx, wgs_cy)
    wc_rows, wc_cols = rowcol(wc_transform, wgs_cx, wgs_cy)

    # 750m neighborhood radius in DEM pixels
    rad_y = 25  # ~750m / 30.8m
    rad_x = 29  # ~750m / 26.3m

    cell_elevations = []
    local_depressions = []
    mean_slopes = []
    flat_fractions = []
    builtup_fractions = []
    road_lengths_m = []
    underpass_flags = []

    print("[PROCESSING] Computing per-cell topographic, land-cover, and network metrics...")
    for idx, row in grid_utm.iterrows():
        geom = row["geometry"]
        r, c = dem_rows[idx], dem_cols[idx]

        # Elevation at cell centroid
        if 0 <= r < H and 0 <= c < W:
            elev = dem_data[r, c]
        else:
            elev = np.nan
        cell_elevations.append(float(elev) if not np.isnan(elev) else 230.0)

        # Local Depression (750m focal window)
        if not np.isnan(elev) and 0 <= r < H and 0 <= c < W:
            r_min, r_max = max(0, r - rad_y), min(H, r + rad_y + 1)
            c_min, c_max = max(0, c - rad_x), min(W, c + rad_x + 1)
            sub_dem = dem_data[r_min:r_max, c_min:c_max]
            grid_y, grid_x = np.ogrid[r_min - r : r_max - r, c_min - c : c_max - c]
            dist_sq = (grid_y * 30.8)**2 + (grid_x * 26.3)**2
            mask = dist_sq <= (750.0**2)
            valid_vals = sub_dem[mask]
            if len(valid_vals) > 0 and not np.all(np.isnan(valid_vals)):
                local_dep = elev - np.nanmean(valid_vals)
            else:
                local_dep = 0.0
        else:
            local_dep = 0.0
        local_depressions.append(float(local_dep))

        # Slope & flat fraction (250m cell = ~8x8 DEM pixels)
        r_hw, c_hw = 4, 4
        sub_slope = slope_map[max(0, r - r_hw) : min(H, r + r_hw + 1), max(0, c - c_hw) : min(W, c + c_hw + 1)]
        if sub_slope.size > 0:
            mean_slopes.append(float(np.nanmean(sub_slope)))
            flat_fractions.append(float(np.mean(sub_slope < 0.5)))
        else:
            mean_slopes.append(0.5)
            flat_fractions.append(0.5)

        # Land Cover: Built-up fraction (Class 50 in ESA WorldCover, 10m pixels -> ~25x25 window)
        wc_r, wc_c = wc_rows[idx], wc_cols[idx]
        wc_hw = 12
        sub_wc = wc_data[max(0, wc_r - wc_hw) : min(wc_H, wc_r + wc_hw + 1), max(0, wc_c - wc_hw) : min(wc_W, wc_c + wc_hw + 1)]
        if sub_wc.size > 0:
            builtup_fractions.append(float(np.mean(sub_wc == 50)))
        else:
            builtup_fractions.append(0.0)

        # Roads: Length in cell
        road_matches = list(roads_sindex.intersection(geom.bounds))
        cell_road_m = 0.0
        has_underpass = 0
        if road_matches:
            subset_roads = roads_gdf.iloc[road_matches]
            inter = subset_roads.intersection(geom)
            valid_inter = inter[~inter.is_empty]
            cell_road_m = float(valid_inter.length.sum())

            # Check underpass / tunnel tags
            for r_idx in subset_roads.index:
                r_item = subset_roads.loc[r_idx]
                tunnel_val = str(r_item.get("tunnel", "")).lower()
                layer_val = str(r_item.get("layer", "0"))
                bridge_val = str(r_item.get("bridge", "")).lower()
                name_val = str(r_item.get("name", "")).lower()

                if (
                    tunnel_val in ["yes", "building_passage"]
                    or layer_val in ["-1", "-2"]
                    or "underpass" in name_val
                    or "underbridge" in name_val
                    or "damoria" in name_val
                ):
                    has_underpass = 1
                    break

        road_lengths_m.append(cell_road_m)
        underpass_flags.append(has_underpass)

    # Convert to DataFrame
    df_raw = pd.DataFrame({
        "cell_id": grid_wgs["cell_id"],
        "elevation_m": np.round(cell_elevations, 2),
        "local_depression_m": np.round(local_depressions, 3),
        "slope_deg": np.round(mean_slopes, 3),
        "flat_fraction": np.round(flat_fractions, 3),
        "builtup_fraction": np.round(builtup_fractions, 3),
        "road_length_m": np.round(road_lengths_m, 1),
        "underpass_flag": underpass_flags,
    })

    # Save raw features parquet
    df_raw.to_parquet(FEATURES_PARQUET)
    print(f"[CACHE] Saved raw physical features to {FEATURES_PARQUET}")

    # 5. Compute Normalized Features [0, 1]
    print("[NORMALIZATION] Deriving normalized susceptibility feature indicators...")

    # 1. f_depression = rank(-local_depression)
    # Low local elevations relative to 750m neighborhood receive highest rank
    f_depression = rank_series(-df_raw["local_depression_m"])

    # 2. f_flatness = rank(flat_fraction)
    f_flatness = rank_series(df_raw["flat_fraction"])

    # 3. f_builtUp = rank(builtup_fraction) from ESA WorldCover 10m pixels
    f_builtUp = rank_series(df_raw["builtup_fraction"])

    # 4. f_lowPoint:
    # 1.0 if underpass flag or cell depression in lowest 10% (< -0.7m relative relief)
    # otherwise distance decay or 0
    dep_cutoff = np.percentile(df_raw["local_depression_m"], 12.0)
    low_point_mask = (df_raw["underpass_flag"] == 1) | (df_raw["local_depression_m"] <= dep_cutoff)
    f_lowPoint = low_point_mask.astype(float)

    # 5. f_density:
    # Road length density modulated by built-up fraction
    road_density = df_raw["road_length_m"] / 62500.0  # m / m2
    density_raw = road_density * (0.3 + 0.7 * df_raw["builtup_fraction"])
    f_density = rank_series(density_raw)

    df_feats = pd.DataFrame({
        "id": grid_wgs["cell_id"],
        "f_depression": np.round(f_depression, 4),
        "f_flatness": np.round(f_flatness, 4),
        "f_builtUp": np.round(f_builtUp, 4),
        "f_lowPoint": np.round(f_lowPoint, 4),
        "f_density": np.round(f_density, 4),
    })

    # 6. Composite Susceptibility Score
    weights = {
        "depression": 0.30,
        "flatness": 0.10,
        "builtUp": 0.30,
        "lowPoint": 0.15,
        "densityProxy": 0.15,
    }

    s_scores = (
        weights["depression"] * df_feats["f_depression"]
        + weights["flatness"] * df_feats["f_flatness"]
        + weights["builtUp"] * df_feats["f_builtUp"]
        + weights["lowPoint"] * df_feats["f_lowPoint"]
        + weights["densityProxy"] * df_feats["f_density"]
    )
    s_scores = np.round(np.clip(s_scores, 0.0, 1.0), 4)

    # Susceptibility Band Classification
    bands = pd.cut(
        s_scores,
        bins=[-0.001, 0.33, 0.66, 1.001],
        labels=["low", "mid", "high"],
    ).astype(str)

    # Build GeoJSON features
    features = []
    for i, row in grid_wgs.iterrows():
        cell_id = row["cell_id"]
        feat = {
            "type": "Feature",
            "id": cell_id,
            "geometry": row["geometry"].__geo_interface__,
            "properties": {
                "id": cell_id,
                "s": float(s_scores.iloc[i]),
                "band": str(bands.iloc[i]),
                "f_depression": float(df_feats["f_depression"].iloc[i]),
                "f_flatness": float(df_feats["f_flatness"].iloc[i]),
                "f_builtUp": float(df_feats["f_builtUp"].iloc[i]),
                "f_lowPoint": float(df_feats["f_lowPoint"].iloc[i]),
                "f_density": float(df_feats["f_density"].iloc[i]),
                "elevation_m": float(df_raw["elevation_m"].iloc[i]),
                "slope_deg": float(df_raw["slope_deg"].iloc[i]),
                "builtup_fraction": float(df_raw["builtup_fraction"].iloc[i]),
                "road_length_m": float(df_raw["road_length_m"].iloc[i]),
            },
        }
        features.append(feat)

    geojson_out = {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
    }

    with open(SUSC_OUT, "w", encoding="utf-8") as f:
        json.dump(geojson_out, f, separators=(",", ":"))

    s_std = float(s_scores.std())
    low_pct = float(np.mean(bands == "low") * 100.0)
    mid_pct = float(np.mean(bands == "mid") * 100.0)
    high_pct = float(np.mean(bands == "high") * 100.0)

    print(f"\n[SUSCEPTIBILITY STATS] Range: [{s_scores.min():.4f}, {s_scores.max():.4f}], Mean: {s_scores.mean():.4f}, Std: {s_std:.4f}")
    print(f"[BAND DISTRIBUTION] Low: {low_pct:.1f}% | Mid: {mid_pct:.1f}% | High: {high_pct:.1f}%")
    print(f"[LOW POINT AUDIT] Mean f_lowPoint: {df_feats['f_lowPoint'].mean():.4f} (Calibrated expectation: 10-20%)")
    print(f"[SUCCESS] Wrote physically generated susceptibility layer to {SUSC_OUT}")


if __name__ == "__main__":
    extract_physical_features()
