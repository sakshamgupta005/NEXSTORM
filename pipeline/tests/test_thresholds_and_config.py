"""
pipeline/tests/test_thresholds_and_config.py
Tests for rainfall threshold percentiles, incomplete window handling,
canonical configuration hashing, and tamper protection.
"""

import importlib
import json
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
import sys
sys.path.insert(0, str(SCRIPTS_DIR))

thresholds_mod = importlib.import_module("05_thresholds")
utils_mod = importlib.import_module("utils")
compute_config_hash = utils_mod.compute_config_hash
verify_frozen_config = utils_mod.verify_frozen_config


def test_hand_verifiable_threshold_percentiles():
    """Verifies T1h, T3h, T24h, and T72h against fixed hand-verifiable arrays."""
    # Hand-constructed 100-hour series in June 2024
    dates = pd.date_range("2024-06-01 00:00", periods=100, freq="h")
    # Hourly values: 0, 1, 2, ..., 99
    hourly_vals = [float(i) for i in range(100)]

    res = thresholds_mod.compute_thresholds(
        [d.strftime("%Y-%m-%d %H:%M") for d in dates],
        hourly_vals,
    )

    # 1. T1h: 99th percentile of 0..99 is 98.01 or 98.02 with linear interpolation
    assert res["T1h"] == pytest.approx(np.percentile(hourly_vals, 99), abs=0.1)

    # 2. T24h: exactly fixed at 64.5 mm (IMD threshold)
    assert res["T24h"] == 64.5

    # 3. Trailing 3h: rolling sum of 3 hours
    # First 2 hours are incomplete windows (NaN/omitted by min_periods=3)
    # rolling sums for 3h from [0, 1, 2] -> 3, [1, 2, 3] -> 6, ..., [97, 98, 99] -> 294
    expected_3h_sums = [i - 2 + i - 1 + i for i in range(2, 100)]
    assert res["T3h"] == pytest.approx(np.percentile(expected_3h_sums, 99), abs=0.1)

    # 4. Trailing 72h: rolling sum of 72 hours
    # 100 hours total, min_periods=72 -> 100 - 72 + 1 = 29 valid 72h windows
    assert res["sampleCounts"]["windows72h"] == 29


def test_missing_values_and_incomplete_windows():
    """Incomplete trailing windows and NaN values must not produce corrupt thresholds."""
    # 10 hours with some NaNs
    dates = pd.date_range("2024-07-01 00:00", periods=10, freq="h")
    vals = [1.0, 2.0, np.nan, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]

    res = thresholds_mod.compute_thresholds(
        [d.strftime("%Y-%m-%d %H:%M") for d in dates],
        vals,
    )

    assert res["sampleCounts"]["validJJASHours"] == 9
    assert res["T24h"] == 64.5


def test_config_hash_stability_and_tamper_detection(tmp_path):
    """Config hash is deterministic for canonical inputs, changes on modification,
    and tampered files are rejected with error."""
    base_config = {
        "id": "amritsar",
        "name": "Amritsar",
        "weights": {"depression": 0.3, "builtUp": 0.3, "flatness": 0.1, "lowPoint": 0.15, "densityProxy": 0.15},
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

    # 1. Deterministic hash
    hash1 = compute_config_hash(base_config)
    hash2 = compute_config_hash(base_config)
    assert hash1 == hash2
    assert len(hash1) == 64

    # 2. Modifying a weight changes the hash
    modified_config = json.loads(json.dumps(base_config))
    modified_config["weights"]["depression"] = 0.25
    modified_config["weights"]["builtUp"] = 0.35
    hash_modified = compute_config_hash(modified_config)
    assert hash_modified != hash1

    # 3. Unrelated metadata does NOT change the canonical hash
    meta_config = json.loads(json.dumps(base_config))
    meta_config["version"] = "2.0.0"
    meta_config["cellCount"] = 9999
    assert compute_config_hash(meta_config) == hash1

    # 4. Tamper verification
    test_file = tmp_path / "city.config.json"
    valid_record = json.loads(json.dumps(base_config))
    valid_record["configHash"] = hash1
    with open(test_file, "w", encoding="utf-8") as f:
        json.dump(valid_record, f)

    assert verify_frozen_config(test_file) is True

    # Tamper with thresholds inside file without updating configHash
    tampered_record = json.loads(json.dumps(valid_record))
    tampered_record["thresholds"]["T24h"] = 100.0  # Unauthorized change
    with open(test_file, "w", encoding="utf-8") as f:
        json.dump(tampered_record, f)

    # verify_frozen_config must exit with error / detect tamper
    with pytest.raises(SystemExit):
        verify_frozen_config(test_file)
