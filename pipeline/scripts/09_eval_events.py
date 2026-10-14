"""
pipeline/scripts/09_eval_events.py
Stage P4B: Evaluation E3 - Reported Historical Event Day Evaluation.
Evaluates model alert detection performance and alert burden against news-reported
waterlogging event days and baseline IMD 64.5mm threshold.
"""

from collections import defaultdict
import json
import math
from pathlib import Path
import numpy as np
import pandas as pd

import sys
from utils import exit_with_error, get_repo_root, verify_frozen_config

ROOT = get_repo_root()
CACHE_DIR = ROOT / "pipeline" / "cache"
PUBLIC_DATA_DIR = ROOT / "public" / "data" / "cities" / "amritsar"
EVAL_DIR = ROOT / "public" / "data" / "evaluation"
CONFIG_FILE = PUBLIC_DATA_DIR / "city.config.json"

sys.path.insert(0, str(ROOT / "pipeline"))
from risk_ref import compute_rti, FROZEN_MATRIX


def wilson_interval(k: int, n: int, confidence: float = 0.95) -> tuple[float, float]:
    """Computes Wilson score interval for binomial proportion."""
    if n == 0:
        return 0.0, 1.0
    z = 1.95996
    p = k / n
    denom = 1.0 + z**2 / n
    center = (p + z**2 / (2.0 * n)) / denom
    margin = (z * math.sqrt(p * (1.0 - p) / n + z**2 / (4.0 * n**2))) / denom
    return round(max(0.0, float(center - margin)), 4), round(min(1.0, float(center + margin)), 4)


def main():
    print("=" * 60)
    print(" NEXSTORM 09_eval_events: E3 Reported Event Evaluation")
    print("=" * 60)

    # 1. Validate frozen configuration
    verify_frozen_config(CONFIG_FILE)

    hotspots_path = PUBLIC_DATA_DIR / "hotspots.json"
    archive_cache_path = CACHE_DIR / "open_meteo_archive_jjas.json"
    thresholds_path = CACHE_DIR / "thresholds.json"

    if not hotspots_path.exists() or not archive_cache_path.exists() or not thresholds_path.exists():
        exit_with_error("Missing required input files for E3 evaluation.")

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        config_data = json.load(f)
    thresholds = config_data["thresholds"]

    with open(hotspots_path, "r", encoding="utf-8") as f:
        hotspots_data = json.load(f)

    with open(archive_cache_path, "r", encoding="utf-8") as f:
        archive_data = json.load(f)

    # 2. Extract and Deduplicate Event Days
    events_by_date = defaultdict(list)
    for h in hotspots_data:
        date_str = h.get("articleDate")
        if date_str:
            events_by_date[date_str].append(h["name"])

    event_dates = sorted(list(events_by_date.keys()))
    print(f"[EVENTS] Found {len(event_dates)} distinct reported event calendar days across {len(hotspots_data)} reports.")

    # 3. Load Hourly Rainfall Series (JJAS 2015-2024)
    times = pd.to_datetime(archive_data["hourly"]["time"])
    precip = pd.Series(archive_data["hourly"]["precipitation"], index=times)

    # Eligible days: JJAS from 2015 to 2024
    jjas_mask = (precip.index.year >= 2015) & (precip.index.year <= 2024) & (precip.index.month.isin([6, 7, 8, 9]))
    jjas_precip = precip[jjas_mask]

    daily_groups = jjas_precip.groupby(jjas_precip.index.date)
    eligible_days = sorted(list(daily_groups.groups.keys()))
    total_eligible_days = len(eligible_days)
    n_seasons = len(set(d.year for d in eligible_days))

    print(f"[PRECIPITATION] Evaluating {total_eligible_days} eligible JJAS days across {n_seasons} seasons (2015-2024).")

    # 4. Daily RTI & Baseline Alerts Evaluation
    # Model alert condition: At least one cell shows moderate or high risk at max RTI.
    # From frozen matrix: RTI >= 0.5 flags high-S cells as moderate.
    model_alert_dates = set()
    baseline_alert_dates = set()
    daily_stats = {}

    for d in eligible_days:
        d_series = daily_groups.get_group(d)
        d_vals = d_series.tolist()
        total_24h = float(sum(d_vals))

        # Hourly max RTI on this day
        # For trailing windows, get up to 72 hours before start of day
        day_start = pd.Timestamp(d)
        window_start = day_start - pd.Timedelta(hours=72)
        window_precip = precip[window_start : day_start + pd.Timedelta(hours=23)].tolist()

        if len(window_precip) >= 24:
            # Evaluate RTI at each hour of day d
            rtis = []
            offset = len(window_precip) - len(d_vals)
            for h_idx in range(len(d_vals)):
                rti_val = compute_rti(window_precip, offset + h_idx, thresholds, antecedent_72h=0.0)
                rtis.append(rti_val)
            max_rti = max(rtis) if rtis else 0.0
        else:
            max_rti = 0.0

        daily_stats[str(d)] = {"p24h": round(total_24h, 2), "maxRti": round(max_rti, 4)}

        # Model alert rule: max RTI >= 0.5 (flags moderate risk in high-S cells)
        if max_rti >= 0.5:
            model_alert_dates.add(str(d))

        # Baseline alert rule: 24h total >= 64.5mm
        if total_24h >= 64.5:
            baseline_alert_dates.add(str(d))

    # 5. Evaluate Event Days
    model_hits = 0
    baseline_hits = 0
    missed_events = []

    for ev_date in event_dates:
        ev_names = ", ".join(events_by_date[ev_date])
        st = daily_stats.get(ev_date)
        if not st:
            print(f"[WARN] Event date {ev_date} outside analyzed range.")
            continue

        is_model_hit = ev_date in model_alert_dates
        is_base_hit = ev_date in baseline_alert_dates

        if is_model_hit:
            model_hits += 1
        else:
            missed_events.append({
                "date": ev_date,
                "locations": ev_names,
                "reason": f"Max RTI ({st['maxRti']}) below 0.5 threshold; 24h rain: {st['p24h']} mm",
            })

        if is_base_hit:
            baseline_hits += 1

    n_events = len(event_dates)
    pod_model = round(model_hits / n_events, 4) if n_events > 0 else 0.0
    pod_base = round(baseline_hits / n_events, 4) if n_events > 0 else 0.0

    model_ci = wilson_interval(model_hits, n_events, confidence=0.95)
    base_ci = wilson_interval(baseline_hits, n_events, confidence=0.95)

    alert_days_per_season_model = round(len(model_alert_dates) / n_seasons, 1)
    alert_days_per_season_base = round(len(baseline_alert_dates) / n_seasons, 1)

    # Unreported alert days (alert-day burden, lower bound on false alarms)
    model_alert_burden = len(model_alert_dates - set(event_dates))
    base_alert_burden = len(baseline_alert_dates - set(event_dates))

    e3_results = {
        "evaluationSpan": "2015-06-01 to 2024-09-30 (JJAS Monsoon Seasons)",
        "sampleCounts": {
            "reportedEventDays": n_events,
            "totalEligibleDays": total_eligible_days,
            "seasons": n_seasons,
        },
        "modelAlertRule": {
            "condition": "At least one cell moderate or high risk (Max RTI >= 0.5)",
            "hits": model_hits,
            "pod": pod_model,
            "wilson95CI": list(model_ci),
            "totalAlertDays": len(model_alert_dates),
            "alertDaysPerSeason": alert_days_per_season_model,
            "alertDayBurden": model_alert_burden,
            "confidence": "unavailable (single deterministic rainfall series)",
        },
        "baselineAlertRule": {
            "condition": "24-hour rainfall >= 64.5 mm (IMD Heavy Rain Standard)",
            "hits": baseline_hits,
            "pod": pod_base,
            "wilson95CI": list(base_ci),
            "totalAlertDays": len(baseline_alert_dates),
            "alertDaysPerSeason": alert_days_per_season_base,
            "alertDayBurden": base_alert_burden,
        },
        "missedEvents": missed_events,
        "criticalLimitations": [
            "News-reporting bias: media coverage reports only visible traffic disruption in central areas.",
            "Unreported days are unlabelled, not confirmed non-flooding days.",
            "Small event sample size (10 event calendar days) limits statistical power.",
            "Model uses coarse 10-25 km grid precipitation without localized urban gauge networks.",
        ],
    }

    out_file = EVAL_DIR / "e3_events.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(e3_results, f, indent=2)

    print("\n--- E3 Event Detection Results ---")
    print(f"Reported Event Days Evaluated: {n_events}")
    print(f"Model Alert Rule Hits: {model_hits}/{n_events} | POD: {pod_model*100:.1f}% (Wilson 95% CI: [{model_ci[0]*100:.1f}%, {model_ci[1]*100:.1f}%])")
    print(f"Model Alert Days per Season: {alert_days_per_season_model} days/season")
    print(f"Baseline (64.5mm) Hits: {baseline_hits}/{n_events} | POD: {pod_base*100:.1f}% (Wilson 95% CI: [{base_ci[0]*100:.1f}%, {base_ci[1]*100:.1f}%])")
    print(f"Baseline Alert Days per Season: {alert_days_per_season_base} days/season")
    print(f"Missed Events Count: {len(missed_events)}")
    print(f"[EXPORT] E3 results written to {out_file}")

    print("\n[COMPLETE] 09_eval_events completed successfully.")


if __name__ == "__main__":
    main()
