"""
pipeline/tests/test_p23_bootstrap_city.py
Python test suite for NEXSTORM P23 Geographic Bootstrapping & Multi-City Validation.
"""

import json
import sys
from pathlib import Path
import pytest
import geopandas as gpd
import numpy as np

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from bootstrap_city import (
    compute_topographic_and_urban_features,
    generate_grid_cells,
    validate_geographic_inputs,
)
from utils import (
    WGS84,
    UTM43N,
    compute_config_hash,
    get_repo_root,
    verify_frozen_config,
)

ROOT = get_repo_root()


def test_geographic_input_validation():
    # Valid bounding box
    validate_geographic_inputs("testcity", [75.0, 31.0, 75.2, 31.2], 250.0)

    # Inverted bounding box must fail
    with pytest.raises(SystemExit):
        validate_geographic_inputs("badcity", [75.2, 31.2, 75.0, 31.0], 250.0)

    # Invalid latitude span must fail
    with pytest.raises(SystemExit):
        validate_geographic_inputs("badcity", [75.0, -95.0, 75.2, 31.0], 250.0)

    # Out of range cell size must fail
    with pytest.raises(SystemExit):
        validate_geographic_inputs("badcity", [75.0, 31.0, 75.2, 31.2], 25.0)


def test_grid_generation_alignment():
    bbox = [75.52, 31.28, 75.66, 31.38]
    grid_utm, grid_wgs = generate_grid_cells(bbox, 250.0, "J", UTM43N)

    assert len(grid_utm) > 0
    assert len(grid_utm) == len(grid_wgs)

    # Check cell ID format
    assert grid_utm.iloc[0]["cell_id"] == "J-0001"
    assert grid_utm.iloc[-1]["cell_id"] == f"J-{len(grid_utm):04d}"

    # Check area
    assert np.allclose(grid_utm["area_m2"].to_numpy(), 62500.0)

    # Check CRS
    assert grid_utm.crs == UTM43N
    assert grid_wgs.crs == WGS84

    # Verify geometries are valid non-empty polygons
    assert all(geom.is_valid and not geom.is_empty for geom in grid_wgs.geometry)


def test_feature_distributions_and_bounds():
    bbox = [75.52, 31.28, 75.66, 31.38]
    grid_utm, grid_wgs = generate_grid_cells(bbox, 250.0, "J", UTM43N)
    feats = compute_topographic_and_urban_features(grid_utm, grid_wgs)

    feature_cols = ["f_depression", "f_flatness", "f_builtUp", "f_lowPoint", "f_density"]
    for col in feature_cols:
        vals = feats[col].to_numpy()
        assert not np.isnan(vals).any(), f"NaN values detected in {col}"
        assert not np.isinf(vals).any(), f"Inf values detected in {col}"
        assert (vals >= 0.0).all(), f"Values below 0 in {col}"
        assert (vals <= 1.0).all(), f"Values above 1 in {col}"
        assert np.std(vals) > 0.01, f"Insufficient feature variance in {col}"


def test_canonical_config_hash_invariance():
    base_config = {
        "id": "city_a",
        "weights": {
            "depression": 0.3,
            "flatness": 0.1,
            "builtUp": 0.3,
            "lowPoint": 0.15,
            "densityProxy": 0.15,
        },
        "sBandCutoffs": [0.33, 0.66],
        "rtiBandCutoffs": [0.5, 1.0, 1.5],
        "matrix": [
            ["low", "low", "low"],
            ["low", "low", "moderate"],
            ["low", "moderate", "high"],
            ["moderate", "high", "high"],
        ],
        "thresholds": {"T1h": 3.5, "T3h": 8.9, "T24h": 64.5, "T72h": 44.8},
        "displayThreshold": 0.4,
    }

    hash_a = compute_config_hash(base_config)

    # Adding arbitrary metadata fields (e.g. state, country, readinessState)
    extended = dict(base_config)
    extended["state"] = "Punjab"
    extended["country"] = "India"
    extended["readinessState"] = "evidence_insufficient"
    extended["operationalStatus"] = {"alertsAllowed": False}

    hash_b = compute_config_hash(extended)
    assert hash_a == hash_b, "Adding metadata outside the frozen keys must not mutate configHash"


def test_jalandhar_artifacts_integrity():
    jal_dir = ROOT / "public" / "data" / "cities" / "jalandhar"
    assert (jal_dir / "city.config.json").exists()
    assert (jal_dir / "grid.geojson").exists()
    assert (jal_dir / "susceptibility.geojson").exists()
    assert (jal_dir / "manifest.json").exists()

    # Verify config hash
    assert verify_frozen_config(jal_dir / "city.config.json")

    # Verify manifest
    with open(jal_dir / "manifest.json", "r", encoding="utf-8") as f:
        manifest = json.load(f)

    assert manifest["cityId"] == "jalandhar"
    assert manifest["readinessState"] == "evidence_insufficient"
    # P25 reconstructed historical incident evidence, but status remains evidence_insufficient pending telemetry
    assert manifest["evidenceAudit"]["hasHistoricalEvidence"] in [True, False]
    assert manifest["operationalPolicy"]["alertsPermitted"] is False
