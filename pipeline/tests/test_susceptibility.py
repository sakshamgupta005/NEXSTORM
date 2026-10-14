"""
pipeline/tests/test_susceptibility.py
Tests for susceptibility scoring, ranking directions, terrain override,
and sensitivity analysis against synthetic fixtures.
"""

import importlib
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
import sys
sys.path.insert(0, str(SCRIPTS_DIR))

susc_mod = importlib.import_module("03_susceptibility")


def test_rank_direction_lower_terrain_higher_susceptibility():
    """Lower areas relative to surroundings must receive HIGHER f_depression."""
    df = pd.DataFrame({
        "cell_id": ["C1", "C2", "C3"],
        "local_depression": [-3.0, 0.0, 3.0],  # C1 is a pit (-3m), C3 is a peak (+3m)
        "flat_fraction": [0.5, 0.5, 0.5],
        "builtup_fraction": [0.5, 0.5, 0.5],
        "building_density": [0.1, 0.1, 0.1],
        "building_count": [5, 5, 5],
        "mean_building_area": [100.0, 100.0, 100.0],
        "centroid_x": [1000.0, 1500.0, 2000.0],
        "centroid_y": [1000.0, 1500.0, 2000.0],
        "underpass_flag": [0, 0, 0],
    })

    features = susc_mod.compute_features_dict(df)
    f_dep = features["f_depression"]

    # C1 (-3m depression) must have higher susceptibility rank than C3 (+3m peak)
    assert f_dep.iloc[0] > f_dep.iloc[2], f"Pit C1 ({f_dep.iloc[0]}) must have higher rank than peak C3 ({f_dep.iloc[2]})"
    assert f_dep.iloc[0] == 1.0
    assert f_dep.iloc[2] == 0.0


def test_terrain_override_trigger_and_weights():
    """Override triggers when std < 0.8m, does not trigger when std >= 0.8m, preserves sum of 1."""
    # Case A: Low terrain variance (std = 0.5m) -> Override triggers
    weights_low, override_low = susc_mod.determine_weights(std_depression=0.5)
    assert override_low["applied"] is True
    assert weights_low["depression"] == 0.10
    assert weights_low["builtUp"] == 0.50
    assert weights_low["flatness"] == 0.10
    assert weights_low["lowPoint"] == 0.15
    assert weights_low["densityProxy"] == 0.15
    assert sum(weights_low.values()) == pytest.approx(1.0)

    # Case B: Sufficient terrain variance (std = 1.5m) -> Override does not trigger
    weights_high, override_high = susc_mod.determine_weights(std_depression=1.5)
    assert override_high["applied"] is False
    assert weights_high["depression"] == 0.30
    assert weights_high["builtUp"] == 0.30
    assert sum(weights_high.values()) == pytest.approx(1.0)


def test_susceptibility_score_bounds_and_zero_range():
    """S remains in [0, 1] and zero-range cases behave deterministically (returning 0.5)."""
    # Constant features case (zero variance)
    features_constant = {
        "f_depression": pd.Series([0.5, 0.5, 0.5]),
        "f_flatness": pd.Series([0.5, 0.5, 0.5]),
        "f_builtUp": pd.Series([0.5, 0.5, 0.5]),
        "f_lowPoint": pd.Series([0.0, 0.0, 0.0]),
        "f_density": pd.Series([0.2, 0.2, 0.2]),
    }
    weights, _ = susc_mod.determine_weights(1.5)
    s, (s_min, s_max) = susc_mod.compute_susceptibility_scores(features_constant, weights)

    assert (s == 0.5).all(), "Zero-range case must return deterministic 0.5"
    assert (s >= 0.0).all() and (s <= 1.0).all()

    # Varied features case
    features_varied = {
        "f_depression": pd.Series([0.0, 0.5, 1.0]),
        "f_flatness": pd.Series([0.2, 0.8, 0.4]),
        "f_builtUp": pd.Series([0.1, 0.3, 0.9]),
        "f_lowPoint": pd.Series([0.0, 1.0, 1.0]),
        "f_density": pd.Series([0.0, 0.4, 0.8]),
    }
    s_varied, (min_v, max_v) = susc_mod.compute_susceptibility_scores(features_varied, weights)
    assert s_varied.min() == pytest.approx(0.0)
    assert s_varied.max() == pytest.approx(1.0)
    assert (s_varied >= 0.0).all() and (s_varied <= 1.0).all()


def test_susceptibility_band_boundaries():
    """Verifies band classifications at 0.33 and 0.66 cutoffs."""
    test_scores = pd.Series([0.0, 0.3299, 0.33, 0.50, 0.66, 0.6601, 1.0])
    bands = susc_mod.classify_bands(test_scores)
    expected = ["low", "low", "mid", "mid", "mid", "high", "high"]
    assert bands.tolist() == expected


def test_sensitivity_analysis_structure():
    """Sensitivity analysis contains expected perturbations and valid fraction changed."""
    features = {
        "f_depression": pd.Series([0.1, 0.4, 0.9, 0.2, 0.8]),
        "f_flatness": pd.Series([0.2, 0.5, 0.7, 0.3, 0.6]),
        "f_builtUp": pd.Series([0.3, 0.8, 0.4, 0.9, 0.1]),
        "f_lowPoint": pd.Series([0.0, 1.0, 0.0, 1.0, 0.0]),
        "f_density": pd.Series([0.1, 0.2, 0.8, 0.5, 0.4]),
    }
    weights, _ = susc_mod.determine_weights(1.5)
    s_base, s_min_max = susc_mod.compute_susceptibility_scores(features, weights)
    base_bands = susc_mod.classify_bands(s_base)

    results = susc_mod.run_sensitivity_analysis(features, weights, s_min_max, base_bands)

    assert "perturbations" in results
    assert len(results["perturbations"]) == 10  # 5 features * 2 directions (+30%, -30%)
    for p_name, p_data in results["perturbations"].items():
        assert 0.0 <= p_data["fractionChanged"] <= 1.0
        assert sum(p_data["weights"].values()) == pytest.approx(1.0, abs=1e-3)
