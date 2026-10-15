"""
pipeline/scripts/14_run_backtest.py
Stage P18: Real Rainfall Validation & Historical Backtesting.
Chronologically backtests historical rainfall (ERA5 reanalysis) across 2023-2024 monsoons,
evaluating detection performance, lead time, and alert burden against the 15 Tribune waterlogging incidents.
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
from risk_ref import compute_rti, rolling_sum


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
    print("=" * 65)
    print(" NEXSTORM 14_run_backtest: P18 Historical Rainfall Backtesting")
    print("=" * 65)

    verify_frozen_config(CONFIG_FILE)

    hotspots_path = PUBLIC_DATA_DIR / "hotspots.json"
    archive_cache_path = CACHE_DIR / "open_meteo_archive_jjas.json"
    susc_path = PUBLIC_DATA_DIR / "susceptibility.geojson"

    if not hotspots_path.exists() or not archive_cache_path.exists():
        exit_with_error("Missing required input files for backtesting.")

    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        config = json.load(f)
    thresholds = config["thresholds"]

    with open(hotspots_path, "r", encoding="utf-8") as f:
        hotspots = json.load(f)

    with open(archive_cache_path, "r", encoding="utf-8") as f:
        archive_data = json.load(f)

    # 1. Parse Hourly Rainfall
    raw_times = pd.to_datetime(archive_data["hourly"]["time"])
    raw_precip = pd.Series(archive_data["hourly"]["precipitation"], index=raw_times)

    # Filter to 2023-2024 seasons with 72h warmup (from 2023-05-29 to 2024-09-30)
    eval_mask = (raw_precip.index >= "2023-05-29") & (raw_precip.index <= "2024-09-30 23:00")
    precip = raw_precip[eval_mask]

    print(f"[DATA] Loaded {len(precip)} hourly records spanning {precip.index[0]} to {precip.index[-1]}.")

    # 2. Extract Event Days
    events_by_date = defaultdict(list)
    for h in hotspots:
        date_str = h.get("articleDate")
        if date_str:
            events_by_date[date_str].append(h)

    event_dates = sorted(list(events_by_date.keys()))
    print(f"[GROUND TRUTH] Evaluating against {len(event_dates)} event dates across {len(hotspots)} incidents.")

    # 3. Chronological Rolling Accumulation
    vals = precip.tolist()
    p1 = rolling_sum(vals, 1)
    p3 = rolling_sum(vals, 3)
    p24 = rolling_sum(vals, 24)
    p72 = rolling_sum(vals, 72)

    # Evaluate RTI at each hour
    t1h = thresholds["T1h"]
    t3h = thresholds["T3h"]
    t24h = thresholds["T24h"]
    t72h = thresholds["T72h"]

    rtis = []
    for i in range(len(vals)):
        r1 = p1[i] / t1h
        r3 = p3[i] / t3h
        r24 = p24[i] / t24h
        r72 = p72[i] / t72h
        rtis.append(round(max(r1, r3, r24, r72), 6))

    # Daily grouping in local time
    daily_groups = defaultdict(lambda: {"hours": [], "precip": [], "rtis": []})
    for idx, dt in enumerate(precip.index):
        # Local time +05:30
        local_dt = dt + pd.Timedelta(hours=5, minutes=30)
        date_str = local_dt.strftime("%Y-%m-%d")
        daily_groups[date_str]["hours"].append(idx)
        daily_groups[date_str]["precip"].append(vals[idx])
        daily_groups[date_str]["rtis"].append(rtis[idx])

    # Filter strictly to 2023-06-01 to 2024-09-30
    eval_dates = sorted([d for d in daily_groups.keys() if "2023-06-01" <= d <= "2024-09-30"])

    model_alert_dates = set()
    baseline_alert_dates = set()
    daily_records = {}

    for d in eval_dates:
        d_data = daily_groups[d]
        total_24h = round(float(sum(d_data["precip"])), 2)
        max_1h = round(float(max(d_data["precip"])), 2) if d_data["precip"] else 0.0
        max_rti = round(float(max(d_data["rtis"])), 4) if d_data["rtis"] else 0.0

        is_model = max_rti >= 0.5
        is_baseline = total_24h >= 64.5

        if is_model:
            model_alert_dates.add(d)
        if is_baseline:
            baseline_alert_dates.add(d)

        daily_records[d] = {
            "total24h": total_24h,
            "max1h": max_1h,
            "maxRti": max_rti,
            "isModelAlert": is_model,
            "isBaselineAlert": is_baseline,
        }

    # 4. Evaluate Event Days Considering Publication Window
    model_hits = 0
    baseline_hits = 0
    detailed_events = []

    for ev_date in event_dates:
        prev_date = (pd.Timestamp(ev_date) - pd.Timedelta(days=1)).strftime("%Y-%m-%d")

        st_ev = daily_records.get(ev_date, {"total24h": 0.0, "maxRti": 0.0})
        st_prev = daily_records.get(prev_date, {"total24h": 0.0, "maxRti": 0.0})

        eff_max_rti = max(st_ev["maxRti"], st_prev["maxRti"])
        eff_total_24h = max(st_ev["total24h"], st_prev["total24h"])

        ev_model_hit = (ev_date in model_alert_dates) or (prev_date in model_alert_dates)
        ev_base_hit = (ev_date in baseline_alert_dates) or (prev_date in baseline_alert_dates)

        if ev_model_hit:
            model_hits += 1
        if ev_base_hit:
            baseline_hits += 1

        ev_incidents = events_by_date[ev_date]
        detailed_events.append({
            "date": ev_date,
            "locationCount": len(ev_incidents),
            "locations": [i["name"] for i in ev_incidents],
            "maxRti": eff_max_rti,
            "total24hMm": eff_total_24h,
            "modelDetected": ev_model_hit,
            "baselineDetected": ev_base_hit,
        })

    n_events = len(event_dates)
    pod_model = round(model_hits / n_events, 4) if n_events > 0 else 0.0
    pod_baseline = round(baseline_hits / n_events, 4) if n_events > 0 else 0.0
    model_ci = wilson_interval(model_hits, n_events, 0.95)
    baseline_ci = wilson_interval(baseline_hits, n_events, 0.95)

    n_seasons = 2
    alert_days_per_season_model = round(len(model_alert_dates) / n_seasons, 1)
    alert_days_per_season_base = round(len(baseline_alert_dates) / n_seasons, 1)

    results = {
        "evaluationSpan": "2023-06-01 to 2024-09-30 (2 Monsoon Seasons)",
        "provenance": {
            "source": "Open-Meteo ERA5-Land Hourly Reanalysis",
            "resolution": "11 km",
            "incidents": "The Tribune Amritsar Archive (15 Documented Hotspot Reports)",
        },
        "sampleCounts": {
            "totalEligibleDays": len(eval_dates),
            "reportedEventDays": n_events,
            "distinctIncidents": len(hotspots),
            "seasons": n_seasons,
        },
        "modelAlertRule": {
            "condition": "At least one cell moderate or high risk (Max RTI >= 0.5)",
            "hits": model_hits,
            "misses": n_events - modelHits if "modelHits" in locals() else n_events - model_hits,
            "pod": pod_model,
            "wilson95CI": list(model_ci),
            "totalAlertDays": len(model_alert_dates),
            "alertDaysPerSeason": alert_days_per_season_model,
        },
        "baselineAlertRule": {
            "condition": "24-hour rainfall >= 64.5 mm (IMD Heavy Rainfall Standard)",
            "hits": baseline_hits,
            "misses": n_events - baseline_hits,
            "pod": pod_baseline,
            "wilson95CI": list(baseline_ci),
            "totalAlertDays": len(baseline_alert_dates),
            "alertDaysPerSeason": alert_days_per_season_base,
        },
        "events": detailed_events,
        "limitations": [
            "News reporting bias: incidents represent opportunistic journalistic coverage of central corridors.",
            "Unreported days and locations cannot be classified as verified flood-free negatives.",
            "Coarse 11 km ERA5 grid averages convective thunderstorm cores.",
            "Small sample size of 15 validated incident locations.",
        ],
    }

    out_file = EVAL_DIR / "e4_backtest.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n--- Backtest Evaluation Results ---")
    print(f"Reported Event Days: {n_events}")
    print(f"Model Alert Rule Hits: {model_hits}/{n_events} | POD: {pod_model*100:.1f}% (Wilson 95% CI: [{model_ci[0]*100:.1f}%, {model_ci[1]*100:.1f}%])")
    print(f"Model Alert Days per Season: {alert_days_per_season_model} days/season")
    print(f"IMD Baseline (64.5mm) Hits: {baseline_hits}/{n_events} | POD: {pod_baseline*100:.1f}% (Wilson 95% CI: [{baseline_ci[0]*100:.1f}%, {baseline_ci[1]*100:.1f}%])")
    print(f"Baseline Alert Days per Season: {alert_days_per_season_base} days/season")
    print(f"[EXPORT] Results written to {out_file}")
    print("\n[COMPLETE] 14_run_backtest executed successfully.")


if __name__ == "__main__":
    main()
