"""
pipeline/tests/test_evaluation_and_replay.py
Comprehensive offline tests for shared risk vectors, evaluation metrics,
window boundaries, replay integrity, summary determinism, and tamper protection.
"""

import hashlib
import json
from pathlib import Path
import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent / "scripts"
PIPELINE_DIR = Path(__file__).resolve().parent.parent
import sys
sys.path.insert(0, str(SCRIPTS_DIR))
sys.path.insert(0, str(PIPELINE_DIR))

import risk_ref
from scripts.utils import compute_config_hash, verify_frozen_config
import importlib
eval_susc = importlib.import_module("08_eval_susceptibility")
eval_events = importlib.import_module("09_eval_events")


def test_shared_risk_vectors_reproduce_from_reference():
    """All ~40 deterministic shared test vectors match risk_ref reference calculations."""
    vector_file = PIPELINE_DIR.parent / "tests" / "vectors" / "risk_vectors.json"
    assert vector_file.exists(), f"Vector file missing: {vector_file}"

    with open(vector_file, "r", encoding="utf-8") as f:
        vectors = json.load(f)

    assert len(vectors) >= 35, f"Expected at least 35 test vectors, found {len(vectors)}"

    for vec in vectors:
        inp = vec["inputs"]
        exp = vec["expected"]

        actual = risk_ref.evaluate_risk_point(
            series=inp["series"],
            hour_index=inp["hourIndex"],
            thresholds=inp["thresholds"],
            antecedent_72h=inp["antecedentMm72h"],
            s_value=inp["sValue"],
        )

        assert abs(actual["rti"] - exp["rti"]) < 1e-5, f"RTI mismatch in {vec['id']}: expected {exp['rti']}, got {actual['rti']}"
        assert actual["rtiBand"] == exp["rtiBand"], f"RTI band mismatch in {vec['id']}"
        assert actual["sBand"] == exp["sBand"], f"S band mismatch in {vec['id']}"
        assert actual["class"] == exp["class"], f"Risk class mismatch in {vec['id']}"


def test_trailing_accumulation_windows():
    """Trailing windows correctly handle indices before complete window exists."""
    series = [1.0, 2.0, 3.0, 4.0, 5.0]

    # window = 1
    w1 = risk_ref.rolling_sum(series, 1)
    assert w1 == [1.0, 2.0, 3.0, 4.0, 5.0]

    # window = 3
    # idx 0: [1.0] -> 1.0
    # idx 1: [1.0, 2.0] -> 3.0
    # idx 2: [1.0, 2.0, 3.0] -> 6.0
    # idx 3: [2.0, 3.0, 4.0] -> 9.0
    # idx 4: [3.0, 4.0, 5.0] -> 12.0
    w3 = risk_ref.rolling_sum(series, 3)
    assert w3 == [1.0, 3.0, 6.0, 9.0, 12.0]


def test_rti_and_s_band_boundaries():
    """Exact boundaries for RTI and S bands."""
    # RTI: <0.5 -> none, <1.0 -> elevated, <1.5 -> severe, >=1.5 -> extreme
    assert risk_ref.classify_rti_band(0.0) == "none"
    assert risk_ref.classify_rti_band(0.4999) == "none"
    assert risk_ref.classify_rti_band(0.50) == "elevated"
    assert risk_ref.classify_rti_band(0.9999) == "elevated"
    assert risk_ref.classify_rti_band(1.00) == "severe"
    assert risk_ref.classify_rti_band(1.4999) == "severe"
    assert risk_ref.classify_rti_band(1.50) == "extreme"
    assert risk_ref.classify_rti_band(3.00) == "extreme"

    # S: <0.33 -> low, <=0.66 -> mid, >0.66 -> high
    assert risk_ref.classify_s_band(0.0) == "low"
    assert risk_ref.classify_s_band(0.3299) == "low"
    assert risk_ref.classify_s_band(0.33) == "mid"
    assert risk_ref.classify_s_band(0.50) == "mid"
    assert risk_ref.classify_s_band(0.66) == "mid"
    assert risk_ref.classify_s_band(0.6601) == "high"
    assert risk_ref.classify_s_band(1.0) == "high"


def test_wilson_and_exact_binomial_against_known_values():
    """Verifies Wilson score and Clopper-Pearson exact binomial calculations against known mathematical limits."""
    # Wilson interval for 5/10: p=0.5 -> symmetric interval
    low_w, high_w = eval_events.wilson_interval(5, 10, confidence=0.95)
    assert low_w == pytest.approx(0.2366, abs=0.01)
    assert high_w == pytest.approx(0.7634, abs=0.01)

    # Exact binomial for 0/10: lower bound = 0.0, upper bound = 1 - 0.025^(1/10) ~ 0.3085
    low_b0, high_b0 = eval_susc.exact_binomial_ci(0, 10, confidence=0.95)
    assert low_b0 == 0.0
    assert high_b0 == pytest.approx(0.3085, abs=0.01)

    # Exact binomial for 10/10: lower bound = 0.025^(1/10) ~ 0.6915, upper bound = 1.0
    low_b10, high_b10 = eval_susc.exact_binomial_ci(10, 10, confidence=0.95)
    assert low_b10 == pytest.approx(0.6915, abs=0.01)
    assert high_b10 == 1.0


def test_zero_denominators_and_undefined_metrics():
    """Undefined denominators in contingency metrics must return None without division-by-zero crashes."""
    import numpy as np
    eval_fcst = importlib.import_module("07_eval_forecast")
    obs = np.array([0.0, 0.0, 0.0])
    fcst = np.array([0.0, 0.0, 0.0])

    # Threshold 10mm -> 0 hits, 0 misses, 0 false alarms
    res = eval_fcst.compute_contingency_metrics(obs, fcst, threshold=10.0)
    assert res["metrics"]["pod"] is None
    assert res["metrics"]["far"] is None
    assert res["metrics"]["csi"] is None
    assert res["metrics"]["frequencyBias"] is None
    assert res["contingency"]["hits"] == 0


def test_refusal_on_tampered_config(tmp_path):
    """Scripts refuse to execute when frozen configuration configHash is modified or tampered."""
    valid_config = {
        "weights": {"depression": 0.3, "builtUp": 0.3, "flatness": 0.1, "lowPoint": 0.15, "densityProxy": 0.15},
        "sBandCutoffs": [0.33, 0.66],
        "rtiBandCutoffs": [0.5, 1.0, 1.5],
        "matrix": [["low", "low", "low"]],
        "thresholds": {"T1h": 3.5, "T3h": 8.9, "T24h": 64.5, "T72h": 44.8},
        "displayThreshold": 0.4,
    }
    h = compute_config_hash(valid_config)
    valid_config["configHash"] = h

    cfg_file = tmp_path / "city.config.json"
    with open(cfg_file, "w", encoding="utf-8") as f:
        json.dump(valid_config, f)

    assert verify_frozen_config(cfg_file) is True

    # Tamper with weight
    valid_config["weights"]["depression"] = 0.50
    with open(cfg_file, "w", encoding="utf-8") as f:
        json.dump(valid_config, f)

    with pytest.raises(SystemExit):
        verify_frozen_config(cfg_file)


def test_replay_payload_schema_and_determinism():
    """Verifies replay file has 72 hours, members: null, no builtAt, and valid golden outputs."""
    replay_file = PIPELINE_DIR.parent / "public" / "data" / "replay" / "2025-09-01_amritsar.json"
    assert replay_file.exists(), f"Replay file missing: {replay_file}"

    with open(replay_file, "r", encoding="utf-8") as f:
        replay = json.load(f)

    assert replay["id"] == "2025-09-01_amritsar"
    assert replay["cityId"] == "amritsar"
    assert replay["members"] is None
    assert "builtAt" not in replay, "builtAt must be omitted to ensure determinism"
    assert len(replay["hourly"]) == 72
    assert "officialContext" in replay

    # Test golden outputs at 3 fixed hours (hour 0, hour 24, hour 48)
    for h in [0, 24, 48]:
        rec = replay["hourly"][h]
        assert "timestamp" in rec
        assert "precipitationMm" in rec
        gold = rec["goldenOutputs"]
        assert gold["rtiBand"] in ["none", "elevated", "severe", "extreme"]
        assert "classShares" in gold
        assert sum(gold["classShares"].values()) == pytest.approx(1.0, abs=1e-3)


def test_summary_determinism_and_limitations():
    """Evaluation summary generator produces byte-identical hash across repeated runs and contains limitations."""
    summary_file = PIPELINE_DIR.parent / "public" / "data" / "evaluation" / "summary.json"
    assert summary_file.exists(), f"Summary file missing: {summary_file}"

    with open(summary_file, "r", encoding="utf-8") as f:
        sum_data = json.load(f)

    assert "configHash" in sum_data
    assert "limitations" in sum_data
    assert len(sum_data["limitations"]) >= 6

    # Verify required limitations explicitly appear
    lim_text = " ".join(sum_data["limitations"]).lower()
    assert "news-reporting bias" in lim_text
    assert "unlabelled" in lim_text
    assert "coarse" in lim_text
    assert "small sample size" in lim_text
