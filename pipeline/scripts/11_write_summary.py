"""
pipeline/scripts/11_write_summary.py
Stage P4B: Evaluation Summary Synthesizer.
Merges E1 (Forecast Quality), E2 (Hotspot Recovery), E3 (Reported Event Detection),
and Sensitivity Analysis results into public/data/evaluation/summary.json.
Guarantees byte-identical deterministic JSON serialization without wall-clock timestamps.
"""

import json
from pathlib import Path

from utils import exit_with_error, get_repo_root, verify_frozen_config

ROOT = get_repo_root()
PUBLIC_DATA_DIR = ROOT / "public" / "data" / "cities" / "amritsar"
EVAL_DIR = ROOT / "public" / "data" / "evaluation"
CONFIG_FILE = PUBLIC_DATA_DIR / "city.config.json"
HOTSPOTS_FILE = PUBLIC_DATA_DIR / "hotspots.json"

E1_FILE = EVAL_DIR / "e1_forecast.json"
E2_FILE = EVAL_DIR / "e2_susceptibility.json"
E3_FILE = EVAL_DIR / "e3_events.json"
SENS_FILE = EVAL_DIR / "e2_sensitivity.json"
OUT_SUMMARY = EVAL_DIR / "summary.json"


def main():
    print("=" * 60)
    print(" NEXSTORM 11_write_summary: Evaluation Synthesis")
    print("=" * 60)

    # 1. Validate frozen configuration
    verify_frozen_config(CONFIG_FILE)

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)
    config_hash = config["configHash"]

    with open(HOTSPOTS_FILE, "r", encoding="utf-8") as f:
        hotspots = json.load(f)
    n_hotspots = len(hotspots)
    distinct_cells = len(set(h["cellId"] for h in hotspots))

    # 2. Load Evaluation Stages
    e1_data = json.load(open(E1_FILE, "r", encoding="utf-8")) if E1_FILE.exists() else {"status": "missing"}
    e2_data = json.load(open(E2_FILE, "r", encoding="utf-8")) if E2_FILE.exists() else {"status": "missing"}
    e3_data = json.load(open(E3_FILE, "r", encoding="utf-8")) if E3_FILE.exists() else {"status": "missing"}
    sens_data = json.load(open(SENS_FILE, "r", encoding="utf-8")) if SENS_FILE.exists() else {"status": "missing"}

    # 3. Limitations Array (strictly required limitations)
    limitations = [
        "News-reporting bias: media reports focus exclusively on high-visibility arterial corridors and central markets.",
        "Unlabelled negative examples: non-hotspot cells are unlabelled rather than confirmed non-flooding zones.",
        "Coarse rainfall grid: ERA5-Land reanalysis (~10-25 km) does not resolve localized hyper-local convective cloudbursts.",
        "Small sample size: 15 validated historical incident locations and 9 calendar event days constrain inferential power.",
        "Near-analysis optimism: reanalysis archive series overstates real-time operational lead-time-1 forecast skill.",
        "Missing or unreachable sources: pipeline/inputs/districts.geojson was absent; gridded IMD verification deferred.",
        "Incomplete coverage: only reported monsoon events in Amritsar are evaluated.",
        "Deterministic-only confidence being unavailable: single-series historical archives cannot produce ensemble spreads.",
    ]

    # 4. Construct Deterministic Summary Object
    summary = {
        "schemaVersion": "1.0.0",
        "cityId": "amritsar",
        "configHash": config_hash,
        "nHotspots": n_hotspots,
        "nDistinctHotspotCells": distinct_cells,
        "nEvents": e3_data.get("sampleCounts", {}).get("reportedEventDays", 9),
        "modeFlags": {
            "e1Mode": e1_data.get("status", "incomplete"),
            "e2Mode": e2_data.get("mode", "descriptive"),
            "e3Mode": "historical_replay_eval",
            "learnedModelAdopted": e2_data.get("learnedModelComparison", {}).get("adopted", False),
        },
        "coverage": {
            "city": "Amritsar, Punjab, India",
            "analysisGridCells": 1998,
            "campusSubGridCells": 699,
            "thresholdCoverageSpan": config["thresholds"]["span"],
            "eventEvaluationSpan": e3_data.get("evaluationSpan", "2015-06-01 to 2024-09-30"),
        },
        "headlineMetrics": {
            "e1_forecast": {
                "status": e1_data.get("status", "incomplete"),
                "reason": e1_data.get("reason", "Missing districts.geojson"),
            },
            "e2_susceptibility": {
                "top20PercentHitShare": e2_data.get("top20PercentAnalysis", {}).get("observedHitShare"),
                "binomialExact95CI": e2_data.get("top20PercentAnalysis", {}).get("binomialExact95CI"),
                "medianHotspotPercentile": e2_data.get("percentileDistribution", {}).get("medianHotspotPercentile"),
                "rocAuc": e2_data.get("aucBaselines", {}).get("frozenSScore", {}).get("rocAuc"),
            },
            "e3_events": {
                "modelPod": e3_data.get("modelAlertRule", {}).get("pod"),
                "modelWilson95CI": e3_data.get("modelAlertRule", {}).get("wilson95CI"),
                "modelAlertDaysPerSeason": e3_data.get("modelAlertRule", {}).get("alertDaysPerSeason"),
                "baselinePod": e3_data.get("baselineAlertRule", {}).get("pod"),
                "baselineWilson95CI": e3_data.get("baselineAlertRule", {}).get("wilson95CI"),
                "baselineAlertDaysPerSeason": e3_data.get("baselineAlertRule", {}).get("alertDaysPerSeason"),
            },
        },
        "sensitivity": {
            "perturbationFactor": sens_data.get("perturbationFactor", 0.30),
            "maxCellBandChangeFraction": max(
                (p["fractionChanged"] for p in sens_data.get("perturbations", {}).values()), default=0.0
            ),
        },
        "limitations": limitations,
    }

    # Deterministic JSON export
    with open(OUT_SUMMARY, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, sort_keys=True)

    print(f"\n[EXPORT] Evaluation summary successfully written to {OUT_SUMMARY}")
    print(f"Config Hash: {summary['configHash']}")
    print(f"E2 Top 20% Hit Share: {summary['headlineMetrics']['e2_susceptibility']['top20PercentHitShare'] * 100:.1f}%")
    print(f"E3 Model POD: {summary['headlineMetrics']['e3_events']['modelPod'] * 100:.1f}% vs Baseline POD: {summary['headlineMetrics']['e3_events']['baselinePod'] * 100:.1f}%")

    print("\n[COMPLETE] 11_write_summary completed successfully.")


if __name__ == "__main__":
    main()
