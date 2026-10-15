"""
pipeline/scripts/03_susceptibility.py
Computes relative static waterlogging susceptibility S (0-1) across Amritsar city cells
and GNDU campus sub-cells, evaluates sensitivity, and exports GeoJSON layers.
"""

import json
from pathlib import Path
import geopandas as gpd
import numpy as np
import pandas as pd

from utils import WGS84, exit_with_error, get_repo_root

ROOT = get_repo_root()
CACHE_DIR = ROOT / "pipeline" / "cache"
PUBLIC_DATA_DIR = ROOT / "public" / "data" / "cities" / "amritsar"
EVAL_DIR = ROOT / "public" / "data" / "evaluation"

DEFAULT_WEIGHTS = {
    "depression": 0.30,
    "flatness": 0.10,
    "builtUp": 0.30,
    "lowPoint": 0.15,
    "densityProxy": 0.15,
}


def rank_series(series: pd.Series) -> pd.Series:
    """Computes deterministic 0-1 relative rank within a series using average tie-breaking.
    If all values are identical, returns 0.5."""
    valid = series.dropna()
    if len(valid) <= 1 or valid.nunique() <= 1:
        return pd.Series(0.5, index=series.index)
    ranks = series.rank(method="average", ascending=True)
    return (ranks - 1.0) / (len(series) - 1.0)


def rank_against_reference(values: pd.Series, ref_values: pd.Series) -> pd.Series:
    """Computes relative rank of values against a reference distribution (e.g. campus vs city).
    rank(x) = (count(ref < x) + 0.5 * count(ref == x)) / len(ref)"""
    ref_clean = ref_values.dropna().to_numpy()
    N = len(ref_clean)
    if N == 0 or np.all(ref_clean == ref_clean[0]):
        return pd.Series(0.5, index=values.index)

    ranks = []
    for v in values:
        if pd.isna(v):
            ranks.append(0.5)
        else:
            less = np.sum(ref_clean < v)
            eq = np.sum(ref_clean == v)
            ranks.append((less + 0.5 * eq) / N)
    return pd.Series(ranks, index=values.index)


def compute_features_dict(df: pd.DataFrame, ref_df: pd.DataFrame | None = None) -> dict[str, pd.Series]:
    """Computes the 5 normalized susceptibility features [0, 1].
    If ref_df is provided, ranks are computed against ref_df."""
    is_ref = ref_df is None
    ref = df if is_ref else ref_df

    # 1. f_depression = rank(-local_depression) (lower areas relative to surroundings get higher susceptibility)
    inv_dep = -df["local_depression"]
    ref_inv_dep = -ref["local_depression"]
    f_depression = rank_series(inv_dep) if is_ref else rank_against_reference(inv_dep, ref_inv_dep)

    # 2. f_flatness = rank(flat_fraction)
    f_flatness = rank_series(df["flat_fraction"]) if is_ref else rank_against_reference(df["flat_fraction"], ref["flat_fraction"])

    # 3. f_builtUp = mean(rank(builtup_fraction), rank(building_density))
    r_builtup = rank_series(df["builtup_fraction"]) if is_ref else rank_against_reference(df["builtup_fraction"], ref["builtup_fraction"])
    r_bldg_den = rank_series(df["building_density"]) if is_ref else rank_against_reference(df["building_density"], ref["building_density"])
    f_builtUp = 0.5 * (r_builtup + r_bldg_den)

    # 4. f_lowPoint = 1 if an underpass flag exists within 200m; otherwise 0
    # Uses metric Euclidean distance in UTM Zone 43N coordinates
    ref_underpass = ref[ref["underpass_flag"] == 1]
    if len(ref_underpass) > 0:
        up_coords = ref_underpass[["centroid_x", "centroid_y"]].to_numpy()
        low_points = []
        for _, row in df.iterrows():
            if row.get("underpass_flag", 0) == 1:
                low_points.append(1.0)
            else:
                dist = np.min(np.sqrt((up_coords[:, 0] - row["centroid_x"]) ** 2 + (up_coords[:, 1] - row["centroid_y"]) ** 2))
                low_points.append(1.0 if dist <= 200.0 else 0.0)
        f_lowPoint = pd.Series(low_points, index=df.index)
    else:
        f_lowPoint = pd.Series(df.get("underpass_flag", 0).astype(float), index=df.index)

    # 5. f_density = rank(building_count_density) * (1 - rank(mean_building_area))
    # Area-aware drainage deficiency proxy: normalizes building count by cell scale (250m vs 50m)
    # 250m cell = 0.0625 km2; 50m cell = 0.0025 km2 (area ratio = 25.0)
    df_is_campus = df.get("is_campus", pd.Series(False, index=df.index))
    ref_is_campus = ref.get("is_campus", pd.Series(False, index=ref.index))
    df_scale = df_is_campus.map(lambda c: 25.0 if c else 1.0)
    ref_scale = ref_is_campus.map(lambda c: 25.0 if c else 1.0)

    bldg_count = df.get("building_count", pd.Series(0, index=df.index)) * df_scale
    ref_bldg_count = ref.get("building_count", pd.Series(0, index=ref.index)) * ref_scale
    r_count = rank_series(bldg_count) if is_ref else rank_against_reference(bldg_count, ref_bldg_count)

    mean_bldg_area = df.get("mean_building_area", pd.Series(0.0, index=df.index))
    ref_bldg_area = ref.get("mean_building_area", pd.Series(0.0, index=ref.index))
    r_area = rank_series(mean_bldg_area) if is_ref else rank_against_reference(mean_bldg_area, ref_bldg_area)

    f_density = r_count * (1.0 - r_area)

    return {
        "f_depression": f_depression,
        "f_flatness": f_flatness,
        "f_builtUp": f_builtUp,
        "f_lowPoint": f_lowPoint,
        "f_density": f_density,
    }


def determine_weights(std_depression: float) -> tuple[dict[str, float], dict]:
    """Determines weights and checks for automatic terrain override (std < 0.8m)."""
    weights = dict(DEFAULT_WEIGHTS)
    if std_depression < 0.8:
        weights["depression"] = 0.10
        weights["builtUp"] = 0.50
        override_info = {
            "applied": True,
            "reason": "std(local_depression) < 0.8m (terrain lacks sufficient variance)",
            "std": round(float(std_depression), 3),
        }
    else:
        override_info = {
            "applied": False,
            "reason": "std(local_depression) >= 0.8m (sufficient terrain variance)",
            "std": round(float(std_depression), 3),
        }
    return weights, override_info


def compute_susceptibility_scores(
    features_dict: dict[str, pd.Series],
    weights: dict[str, float],
    min_max: tuple[float, float] | None = None,
) -> tuple[pd.Series, tuple[float, float]]:
    """Calculates S as weighted sum and min-max stretches to [0, 1].
    Preserves distribution shape without artificial uniform re-ranking."""
    raw_s = (
        weights["depression"] * features_dict["f_depression"]
        + weights["flatness"] * features_dict["f_flatness"]
        + weights["builtUp"] * features_dict["f_builtUp"]
        + weights["lowPoint"] * features_dict["f_lowPoint"]
        + weights["densityProxy"] * features_dict["f_density"]
    )

    if min_max is None:
        s_min = float(raw_s.min())
        s_max = float(raw_s.max())
    else:
        s_min, s_max = min_max

    if s_max > s_min:
        s = (raw_s - s_min) / (s_max - s_min)
        s = s.clip(0.0, 1.0)
    else:
        s = pd.Series(0.5, index=raw_s.index)

    return s, (s_min, s_max)


def classify_bands(s_series: pd.Series) -> pd.Series:
    """Classifies S scores into Low (< 0.33), Mid (0.33 - 0.66), High (> 0.66)."""
    bands = []
    for val in s_series:
        if val < 0.33:
            bands.append("low")
        elif val <= 0.66:
            bands.append("mid")
        else:
            bands.append("high")
    return pd.Series(bands, index=s_series.index)


def run_sensitivity_analysis(
    city_features: dict[str, pd.Series],
    base_weights: dict[str, float],
    s_min_max: tuple[float, float],
    base_bands: pd.Series,
) -> dict:
    """Perturbs each weight by +30% and -30%, renormalizing weights to 1,
    and records the fraction of cells changing susceptibility bands."""
    results = {
        "baselineWeights": base_weights,
        "perturbationFactor": 0.30,
        "perturbations": {},
    }

    N = len(base_bands)
    for feat_name, base_w in base_weights.items():
        for direction, factor in [("plus_30", 1.30), ("minus_30", 0.70)]:
            scenario_name = f"{feat_name}_{direction}"
            perturbed_weights = dict(base_weights)
            perturbed_weights[feat_name] = base_w * factor
            total_w = sum(perturbed_weights.values())
            norm_weights = {k: v / total_w for k, v in perturbed_weights.items()}

            s_pert, _ = compute_susceptibility_scores(city_features, norm_weights, min_max=s_min_max)
            pert_bands = classify_bands(s_pert)

            band_changes = (pert_bands != base_bands).sum()
            frac_changed = round(float(band_changes) / N, 4)

            results["perturbations"][scenario_name] = {
                "feature": feat_name,
                "direction": direction,
                "weights": {k: round(v, 4) for k, v in norm_weights.items()},
                "cellsChanged": int(band_changes),
                "fractionChanged": frac_changed,
            }

    return results


def main():
    print("=" * 60)
    print(" NEXSTORM 03_susceptibility: Waterlogging Susceptibility Scoring")
    print("=" * 60)

    features_parquet = CACHE_DIR / "features.parquet"
    if not features_parquet.exists():
        exit_with_error(f"Missing {features_parquet}. Run 02_features.py first.")

    features_df = pd.read_parquet(features_parquet)
    city_df = features_df[~features_df["is_campus"]].copy().reset_index(drop=True)
    campus_df = features_df[features_df["is_campus"]].copy().reset_index(drop=True)

    city_grid_path = ROOT / "public" / "data" / "cities" / "amritsar" / "grid.geojson"
    campus_grid_path = ROOT / "public" / "data" / "cities" / "amritsar" / "campus.geojson"

    if not city_grid_path.exists():
        exit_with_error(f"Missing city grid: {city_grid_path}")

    # 1. Automatic Terrain Override Check
    std_dep = float(city_df["local_depression"].std())
    weights, override_info = determine_weights(std_dep)
    print(f"[TERRAIN] local_depression std: {std_dep:.3f} m")
    print(f"[TERRAIN OVERRIDE] Applied: {override_info['applied']} ({override_info['reason']})")
    print(f"[WEIGHTS] Final weights: {weights}")

    # 2. Compute City Features & Susceptibility
    city_features = compute_features_dict(city_df)
    city_s, s_min_max = compute_susceptibility_scores(city_features, weights)
    city_bands = classify_bands(city_s)

    city_df["s"] = city_s
    for k, v in city_features.items():
        city_df[k] = v

    # Band statistics
    low_pct = (city_bands == "low").mean() * 100
    mid_pct = (city_bands == "mid").mean() * 100
    high_pct = (city_bands == "high").mean() * 100

    print("\n--- Amritsar City Susceptibility Distribution (250m Cells) ---")
    print(f"Total Cells: {len(city_df)}")
    print(f"Mean S: {city_s.mean():.4f} | Std S: {city_s.std():.4f} | Min: {city_s.min():.4f} | Max: {city_s.max():.4f}")
    print(f"Low Band  (S < 0.33):    {low_pct:.1f}% ({(city_bands == 'low').sum()} cells)")
    print(f"Mid Band  (0.33 <= S <= 0.66): {mid_pct:.1f}% ({(city_bands == 'mid').sum()} cells)")
    print(f"High Band (S > 0.66):   {high_pct:.1f}% ({(city_bands == 'high').sum()} cells)")

    # 3. Export City Susceptibility GeoJSON
    city_grid_gdf = gpd.read_file(city_grid_path)
    city_export_gdf = city_grid_gdf.merge(
        city_df[["cell_id", "s", "f_depression", "f_flatness", "f_builtUp", "f_lowPoint", "f_density", "nearest_named_road"]],
        on="cell_id",
    )

    # Format properties as strictly required by prompt
    features = []
    for _, row in city_export_gdf.iterrows():
        geom_json = json.loads(gpd.GeoSeries([row["geometry"]]).to_json())["features"][0]["geometry"]
        features.append({
            "type": "Feature",
            "geometry": geom_json,
            "properties": {
                "id": str(row["cell_id"]),
                "s": round(float(row["s"]), 4),
                "f_depression": round(float(row["f_depression"]), 4),
                "f_flatness": round(float(row["f_flatness"]), 4),
                "f_builtUp": round(float(row["f_builtUp"]), 4),
                "f_lowPoint": int(round(float(row["f_lowPoint"]))),
                "f_density": round(float(row["f_density"]), 4),
                "nearestRoad": str(row["nearest_named_road"]) if pd.notna(row["nearest_named_road"]) else None,
                "synthetic": False,
                "version": "1.0.0",
            },
        })

    city_geojson = {
        "type": "FeatureCollection",
        "name": "amritsar_susceptibility",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features,
    }

    out_city_path = PUBLIC_DATA_DIR / "susceptibility.geojson"
    out_city_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_city_path, "w", encoding="utf-8") as f:
        json.dump(city_geojson, f, indent=2)
    print(f"[EXPORT] City susceptibility exported: {out_city_path} ({len(features)} cells)")

    # 4. Campus Sub-Grid Susceptibility (if campus exists)
    if len(campus_df) > 0 and campus_grid_path.exists():
        campus_features = compute_features_dict(campus_df, ref_df=city_df)
        campus_s, _ = compute_susceptibility_scores(campus_features, weights, min_max=s_min_max)
        campus_df["s"] = campus_s
        for k, v in campus_features.items():
            campus_df[k] = v

        campus_grid_gdf = gpd.read_file(campus_grid_path)
        campus_export_gdf = campus_grid_gdf.merge(
            campus_df[["cell_id", "s", "f_depression", "f_flatness", "f_builtUp", "f_lowPoint", "f_density", "nearest_named_road"]],
            on="cell_id",
        )

        campus_features_list = []
        for _, row in campus_export_gdf.iterrows():
            geom_json = json.loads(gpd.GeoSeries([row["geometry"]]).to_json())["features"][0]["geometry"]
            campus_features_list.append({
                "type": "Feature",
                "geometry": geom_json,
                "properties": {
                    "id": str(row["cell_id"]),
                    "s": round(float(row["s"]), 4),
                    "f_depression": round(float(row["f_depression"]), 4),
                    "f_flatness": round(float(row["f_flatness"]), 4),
                    "f_builtUp": round(float(row["f_builtUp"]), 4),
                    "f_lowPoint": int(round(float(row["f_lowPoint"]))),
                    "f_density": round(float(row["f_density"]), 4),
                    "nearestRoad": str(row["nearest_named_road"]) if pd.notna(row["nearest_named_road"]) else None,
                    "synthetic": False,
                    "version": "1.0.0",
                },
            })

        campus_geojson = {
            "type": "FeatureCollection",
            "name": "gndu_campus_susceptibility",
            "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
            "features": campus_features_list,
        }

        out_campus_path = PUBLIC_DATA_DIR / "campus_susceptibility.geojson"
        with open(out_campus_path, "w", encoding="utf-8") as f:
            json.dump(campus_geojson, f, indent=2)
        print(f"[EXPORT] Campus susceptibility exported: {out_campus_path} ({len(campus_features_list)} cells)")

    # 5. Sensitivity Analysis
    EVAL_DIR.mkdir(parents=True, exist_ok=True)
    sens_results = run_sensitivity_analysis(city_features, weights, s_min_max, city_bands)
    sens_results["terrainOverride"] = override_info
    out_sens_path = EVAL_DIR / "e2_sensitivity.json"
    with open(out_sens_path, "w", encoding="utf-8") as f:
        json.dump(sens_results, f, indent=2)
    print(f"[EXPORT] Sensitivity analysis exported: {out_sens_path}")

    # Cache terrain override for 06_freeze_config.py
    with open(CACHE_DIR / "terrain_override.json", "w", encoding="utf-8") as f:
        json.dump({"weights": weights, "override": override_info}, f, indent=2)

    print("\n[COMPLETE] 03_susceptibility completed successfully.")


if __name__ == "__main__":
    main()
