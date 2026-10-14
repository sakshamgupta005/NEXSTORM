"""
pipeline/scripts/06_freeze_config.py
Generates, freezes, and hashes the canonical configuration for Amritsar
(public/data/cities/amritsar/city.config.json), with strict tamper verification.
"""

import json
from pathlib import Path
import geopandas as gpd

from utils import (
    WGS84,
    compute_config_hash,
    exit_with_error,
    get_repo_root,
    verify_frozen_config,
)

ROOT = get_repo_root()
CACHE_DIR = ROOT / "pipeline" / "cache"
PUBLIC_DATA_DIR = ROOT / "public" / "data" / "cities" / "amritsar"
CONFIG_FILE = PUBLIC_DATA_DIR / "city.config.json"


def build_canonical_config() -> dict:
    """Builds the canonical configuration dictionary from pipeline outputs."""
    boundary_path = ROOT / "pipeline" / "inputs" / "city_boundary.geojson"
    grid_path = PUBLIC_DATA_DIR / "grid.geojson"
    terrain_override_path = CACHE_DIR / "terrain_override.json"
    thresholds_path = CACHE_DIR / "thresholds.json"

    for req in [boundary_path, grid_path, terrain_override_path, thresholds_path]:
        if not req.exists():
            exit_with_error(f"Missing prerequisite for config freezing: {req}")

    # Bounding box
    b_gdf = gpd.read_file(boundary_path).to_crs(WGS84)
    minx, miny, maxx, maxy = b_gdf.total_bounds
    bbox = [round(float(minx), 4), round(float(miny), 4), round(float(maxx), 4), round(float(maxy), 4)]

    # Cell count
    grid_gdf = gpd.read_file(grid_path)
    cell_count = len(grid_gdf)

    # Weights and terrain override
    with open(terrain_override_path, "r", encoding="utf-8") as f:
        override_data = json.load(f)
    weights = override_data["weights"]
    terrain_override = override_data["override"]

    # Thresholds
    with open(thresholds_path, "r", encoding="utf-8") as f:
        t_data = json.load(f)
    thresholds = {
        "T1h": t_data["T1h"],
        "T3h": t_data["T3h"],
        "T24h": t_data["T24h"],
        "T72h": t_data["T72h"],
        "provisional": t_data["provisional"],
        "derivedFrom": t_data["derivedFrom"],
        "span": t_data["span"],
    }

    # Classification Matrix:
    # Rows: RTI bands [none, elevated, severe, extreme]
    # Cols: S bands [low, mid, high]
    matrix = [
        ["low", "low", "low"],        # none
        ["low", "low", "moderate"],   # elevated
        ["low", "moderate", "high"],  # severe
        ["moderate", "high", "high"], # extreme
    ]

    s_band_cutoffs = [0.33, 0.66]
    rti_band_cutoffs = [0.5, 1.0, 1.5]
    display_threshold = 0.4
    confidence_cutoffs = [0.8, 0.5]

    config_data = {
        "id": "amritsar",
        "name": "Amritsar",
        "bbox": bbox,
        "gridSizeM": 250,
        "cellCount": cell_count,
        "weights": weights,
        "terrainOverride": terrain_override,
        "sBandCutoffs": s_band_cutoffs,
        "rtiBandCutoffs": rti_band_cutoffs,
        "matrix": matrix,
        "thresholds": thresholds,
        "displayThreshold": display_threshold,
        "confidenceCutoffs": confidence_cutoffs,
        "sources": [
            "OpenStreetMap (ODbL 1.0)",
            "Copernicus DEM GLO-30 (Copernicus Open Access)",
            "ESA WorldCover 2021 (CC BY 4.0)",
            "Open-Meteo ERA5-Land Reanalysis Archive (CC BY 4.0)",
        ],
        "version": "1.0.0",
    }

    # Compute deterministic canonical hash over the frozen subset:
    # {weights, sBandCutoffs, rtiBandCutoffs, matrix, thresholds, displayThreshold}
    config_hash = compute_config_hash(config_data)
    config_data["configHash"] = config_hash

    return config_data


def main():
    print("=" * 60)
    print(" NEXSTORM 06_freeze_config: City Configuration Freezing")
    print("=" * 60)

    config_data = build_canonical_config()
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config_data, f, indent=2)

    print(f"[FREEZE] Wrote canonical configuration to {CONFIG_FILE}")
    print(f"[HASH] Canonical configHash (SHA-256): {config_data['configHash']}")

    # Verify frozen configuration immediately
    verify_frozen_config(CONFIG_FILE)
    print("[VERIFY] Frozen configuration verified: SHA-256 match confirmed.")

    print("\n[COMPLETE] 06_freeze_config completed successfully.")


if __name__ == "__main__":
    main()
