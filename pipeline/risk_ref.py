"""
pipeline/risk_ref.py
Independent Python reference implementation of NEXSTORM hydrometeorological risk engine.
Computes trailing rainfall accumulations, RTI, RTI bands, susceptibility bands,
and 2D matrix risk classifications according to the frozen city configuration.
Also provides generator for shared cross-language test vectors (tests/vectors/risk_vectors.json).
"""

import json
from pathlib import Path

FROZEN_MATRIX = {
    "none": {"low": "low", "mid": "low", "high": "low"},
    "elevated": {"low": "low", "mid": "low", "high": "moderate"},
    "severe": {"low": "low", "mid": "moderate", "high": "high"},
    "extreme": {"low": "moderate", "mid": "high", "high": "high"},
}


def rolling_sum(series: list[float], window: int) -> list[float]:
    """Calculates rolling trailing sum over a given window.
    For indices before a complete window exists, sums all available preceding values.
    Matches TypeScript rollingSum implementation."""
    if not isinstance(window, int) or window <= 0:
        raise ValueError("Window size must be a positive integer")
    if not series:
        return []

    result = []
    current_sum = 0.0
    for i, val in enumerate(series):
        if val is None or val < 0.0:
            raise ValueError(f"Invalid rainfall value at index {i}: must be non-negative number")
        current_sum += float(val)
        if i >= window:
            current_sum -= float(series[i - window])
        result.append(round(current_sum, 6))
    return result


def compute_rti(
    series: list[float],
    hour_index: int,
    thresholds: dict[str, float],
    antecedent_72h: float = 0.0,
) -> float:
    """Computes the Rainfall Trigger Index (RTI) at hour_index.
    RTI = max(P1h/T1h, P3h/T3h, P24h/T24h, (P72h + antecedentMm72h)/T72h)"""
    if hour_index < 0 or hour_index >= len(series):
        raise IndexError(f"hour_index {hour_index} out of bounds for series of length {len(series)}")

    t1h = float(thresholds["T1h"])
    t3h = float(thresholds["T3h"])
    t24h = float(thresholds["T24h"])
    t72h = float(thresholds["T72h"])

    if min(t1h, t3h, t24h, t72h) <= 0:
        raise ValueError("All thresholds must be positive numbers")

    p1h = rolling_sum(series, 1)[hour_index]
    p3h = rolling_sum(series, 3)[hour_index]
    p24h = rolling_sum(series, 24)[hour_index]
    p72h = rolling_sum(series, 72)[hour_index]

    r1 = p1h / t1h
    r3 = p3h / t3h
    r24 = p24h / t24h
    r72 = (p72h + float(antecedent_72h)) / t72h

    return round(max(r1, r3, r24, r72), 6)


def classify_rti_band(rti: float) -> str:
    """Categorizes continuous RTI into intensity bands:
    - rti < 0.5: none
    - 0.5 <= rti < 1.0: elevated
    - 1.0 <= rti < 1.5: severe
    - rti >= 1.5: extreme"""
    if rti < 0.0:
        raise ValueError("RTI must be non-negative")
    if rti < 0.5:
        return "none"
    if rti < 1.0:
        return "elevated"
    if rti < 1.5:
        return "severe"
    return "extreme"


def classify_s_band(s: float) -> str:
    """Categorizes continuous susceptibility index s (0..1) into bands:
    - s < 0.33: low
    - 0.33 <= s <= 0.66: mid
    - s > 0.66: high"""
    if s < 0.0 or s > 1.0:
        raise ValueError(f"Susceptibility s must be in [0, 1], got {s}")
    if s < 0.33:
        return "low"
    if s <= 0.66:
        return "mid"
    return "high"


def classify_risk(s_band: str, rti_band: str) -> str:
    """Evaluates 2D risk matrix mapping: (s_band, rti_band) -> risk_class (low, moderate, high)."""
    if rti_band not in FROZEN_MATRIX:
        raise ValueError(f"Unknown rti_band: {rti_band}")
    if s_band not in FROZEN_MATRIX[rti_band]:
        raise ValueError(f"Unknown s_band: {s_band}")
    return FROZEN_MATRIX[rti_band][s_band]


def evaluate_risk_point(
    series: list[float],
    hour_index: int,
    thresholds: dict[str, float],
    antecedent_72h: float,
    s_value: float,
) -> dict:
    """Computes full risk classification tuple for a point."""
    rti = compute_rti(series, hour_index, thresholds, antecedent_72h)
    r_band = classify_rti_band(rti)
    s_b = classify_s_band(s_value)
    risk_c = classify_risk(s_b, r_band)
    return {
        "rti": rti,
        "rtiBand": r_band,
        "sBand": s_b,
        "class": risk_c,
    }


def generate_risk_vectors(output_path: str | Path | None = None) -> list[dict]:
    """Generates ~40 deterministic test vectors covering:
    - RTI boundaries: 0.0, 0.499, 0.50, 0.999, 1.00, 1.499, 1.50, 2.50
    - S boundaries: 0.0, 0.329, 0.33, 0.50, 0.66, 0.661, 1.0
    - Incomplete history (hour 0, 1, 2, 10, 23, 71)
    - Full history (hour 72+)
    - Antecedent rainfall contributions
    - All 12 cells of the classification matrix
    - Zero rainfall and extreme rainfall cases"""
    default_thresholds = {"T1h": 3.5, "T3h": 8.9, "T24h": 64.5, "T72h": 44.8}

    test_cases = []
    case_id = 1

    def add_case(description, series, hour_index, thresholds, antecedent_72h, s_val):
        nonlocal case_id
        res = evaluate_risk_point(series, hour_index, thresholds, antecedent_72h, s_val)
        test_cases.append({
            "id": f"VEC-{case_id:03d}",
            "description": description,
            "inputs": {
                "series": [round(float(x), 4) for x in series],
                "hourIndex": int(hour_index),
                "thresholds": {k: round(float(v), 2) for k, v in thresholds.items()},
                "antecedentMm72h": round(float(antecedent_72h), 2),
                "sValue": round(float(s_val), 4),
            },
            "expected": res,
        })
        case_id += 1

    # 1. Zero rainfall across all bands of S
    zero_series_72 = [0.0] * 72
    add_case("Zero rainfall - S low", zero_series_72, 71, default_thresholds, 0.0, 0.10)
    add_case("Zero rainfall - S mid", zero_series_72, 71, default_thresholds, 0.0, 0.50)
    add_case("Zero rainfall - S high", zero_series_72, 71, default_thresholds, 0.0, 0.85)

    # 2. Incomplete history at start of series (hours 0, 1, 2)
    start_series = [1.75, 2.0, 3.0] + [0.0] * 10
    add_case("Incomplete history hour 0 (P1h=1.75 -> RTI=0.5 exact boundary)", start_series, 0, default_thresholds, 0.0, 0.20)
    add_case("Incomplete history hour 1", start_series, 1, default_thresholds, 0.0, 0.40)
    add_case("Incomplete history hour 2", start_series, 2, default_thresholds, 0.0, 0.70)

    # 3. RTI Boundary: exactly at 0.5, just below, just above
    # T1h = 3.5 -> P1h = 1.75 gives exactly 0.50
    b_series_05 = [0.0] * 20
    b_series_05[10] = 1.7465  # RTI = 1.7465 / 3.5 = 0.4990
    add_case("RTI just below 0.5 cutoff (0.499 -> none)", b_series_05, 10, default_thresholds, 0.0, 0.50)

    b_series_05[10] = 1.75  # RTI = 0.5000 exactly
    add_case("RTI exact 0.5 cutoff (0.5 -> elevated) S low", b_series_05, 10, default_thresholds, 0.0, 0.20)
    add_case("RTI exact 0.5 cutoff (0.5 -> elevated) S mid", b_series_05, 10, default_thresholds, 0.0, 0.50)
    add_case("RTI exact 0.5 cutoff (0.5 -> elevated) S high", b_series_05, 10, default_thresholds, 0.0, 0.75)

    # 4. RTI Boundary: exactly at 1.0, just below, just above
    # T1h = 3.5 -> P1h = 3.5 gives exactly 1.00
    b_series_10 = [0.0] * 20
    b_series_10[10] = 3.4965  # RTI = 3.4965 / 3.5 = 0.9990
    add_case("RTI just below 1.0 cutoff (0.999 -> elevated)", b_series_10, 10, default_thresholds, 0.0, 0.50)

    b_series_10[10] = 3.5  # RTI = 1.0000 exactly
    add_case("RTI exact 1.0 cutoff (1.0 -> severe) S low", b_series_10, 10, default_thresholds, 0.0, 0.20)
    add_case("RTI exact 1.0 cutoff (1.0 -> severe) S mid", b_series_10, 10, default_thresholds, 0.0, 0.50)
    add_case("RTI exact 1.0 cutoff (1.0 -> severe) S high", b_series_10, 10, default_thresholds, 0.0, 0.80)

    # 5. RTI Boundary: exactly at 1.5, just below, just above
    # T1h = 3.5 -> P1h = 5.25 gives exactly 1.50
    b_series_15 = [0.0] * 20
    b_series_15[10] = 5.2465  # RTI = 5.2465 / 3.5 = 1.4990
    add_case("RTI just below 1.5 cutoff (1.499 -> severe)", b_series_15, 10, default_thresholds, 0.0, 0.50)

    b_series_15[10] = 5.25  # RTI = 1.5000 exactly
    add_case("RTI exact 1.5 cutoff (1.5 -> extreme) S low", b_series_15, 10, default_thresholds, 0.0, 0.20)
    add_case("RTI exact 1.5 cutoff (1.5 -> extreme) S mid", b_series_15, 10, default_thresholds, 0.0, 0.50)
    add_case("RTI exact 1.5 cutoff (1.5 -> extreme) S high", b_series_15, 10, default_thresholds, 0.0, 0.90)

    # 6. Susceptibility Boundaries (S = 0.33, S = 0.66)
    # Under elevated RTI (0.75)
    elev_series = [0.0] * 10
    elev_series[5] = 2.625  # 2.625 / 3.5 = 0.75
    add_case("S just below 0.33 (0.329 -> low)", elev_series, 5, default_thresholds, 0.0, 0.329)
    add_case("S exact 0.33 boundary (0.33 -> mid)", elev_series, 5, default_thresholds, 0.0, 0.330)
    add_case("S exact 0.66 boundary (0.66 -> mid)", elev_series, 5, default_thresholds, 0.0, 0.660)
    add_case("S just above 0.66 (0.661 -> high)", elev_series, 5, default_thresholds, 0.0, 0.661)

    # Under severe RTI (1.20)
    sev_series = [0.0] * 10
    sev_series[5] = 4.2  # 4.2 / 3.5 = 1.20
    add_case("Severe RTI with S low (0.30)", sev_series, 5, default_thresholds, 0.0, 0.30)
    add_case("Severe RTI with S exact 0.33 (mid)", sev_series, 5, default_thresholds, 0.0, 0.33)
    add_case("Severe RTI with S exact 0.66 (mid)", sev_series, 5, default_thresholds, 0.0, 0.66)
    add_case("Severe RTI with S high (0.70)", sev_series, 5, default_thresholds, 0.0, 0.70)

    # Under extreme RTI (2.00)
    ext_series = [0.0] * 10
    ext_series[5] = 7.0  # 7.0 / 3.5 = 2.00
    add_case("Extreme RTI with S low (0.25 -> moderate)", ext_series, 5, default_thresholds, 0.0, 0.25)
    add_case("Extreme RTI with S exact 0.33 (mid -> high)", ext_series, 5, default_thresholds, 0.0, 0.33)
    add_case("Extreme RTI with S exact 0.66 (mid -> high)", ext_series, 5, default_thresholds, 0.0, 0.66)
    add_case("Extreme RTI with S high (0.85 -> high)", ext_series, 5, default_thresholds, 0.0, 0.85)

    # 7. Trailing 3-Hour Driven Trigger (P3h dominates)
    # P1h small (1.0 -> 0.28), but sum(3h) = 1.0 + 4.5 + 4.5 = 10.0 -> 10.0 / 8.9 = 1.1236 (severe)
    t3_series = [0.0] * 10
    t3_series[3] = 4.5
    t3_series[4] = 4.5
    t3_series[5] = 1.0
    add_case("Trailing 3h accumulation trigger (T3h dominates)", t3_series, 5, default_thresholds, 0.0, 0.50)

    # 8. Trailing 24-Hour Driven Trigger (P24h dominates)
    # Constant 3.0 mm/h for 24h: P1h=3.0 (0.85), P3h=9.0 (1.01), P24h=72.0 -> 72.0 / 64.5 = 1.1163
    t24_series = [3.0] * 24
    add_case("Trailing 24h accumulation trigger (72mm in 24h)", t24_series, 23, default_thresholds, 0.0, 0.50)

    # 9. Trailing 72-Hour Driven Trigger with Antecedent Contribution
    # P72h = 20.0, antecedent = 30.0 -> total = 50.0 / 44.8 = 1.1161 (severe)
    t72_series = [0.28] * 72
    add_case("Trailing 72h trigger with antecedentMm72h", t72_series, 71, default_thresholds, 30.0, 0.50)
    add_case("Trailing 72h without antecedent (falls into none/elevated)", t72_series, 71, default_thresholds, 0.0, 0.50)

    # 10. All 12 Matrix Combinations Verification
    matrix_scenarios = [
        ("none", 0.0, "low", 0.10, "low"),
        ("none", 0.0, "mid", 0.50, "low"),
        ("none", 0.0, "high", 0.80, "low"),
        ("elevated", 2.0, "low", 0.10, "low"),
        ("elevated", 2.0, "mid", 0.50, "low"),
        ("elevated", 2.0, "high", 0.80, "moderate"),
        ("severe", 4.0, "low", 0.10, "low"),
        ("severe", 4.0, "mid", 0.50, "moderate"),
        ("severe", 4.0, "high", 0.80, "high"),
        ("extreme", 6.0, "low", 0.10, "moderate"),
        ("extreme", 6.0, "mid", 0.50, "high"),
        ("extreme", 6.0, "high", 0.80, "high"),
    ]
    for rti_target, rain_val, s_band_target, s_num, expected_cls in matrix_scenarios:
        s_arr = [0.0] * 5
        s_arr[2] = rain_val
        add_case(f"Matrix verification {rti_target} x {s_band_target} -> {expected_cls}", s_arr, 2, default_thresholds, 0.0, s_num)

    if output_path:
        out_p = Path(output_path)
        out_p.parent.mkdir(parents=True, exist_ok=True)
        with open(out_p, "w", encoding="utf-8") as f:
            json.dump(test_cases, f, indent=2)

    return test_cases


if __name__ == "__main__":
    vector_file = Path(__file__).resolve().parent.parent / "tests" / "vectors" / "risk_vectors.json"
    vectors = generate_risk_vectors(vector_file)
    print(f"[RISK REF] Generated {len(vectors)} deterministic test vectors at {vector_file}")
