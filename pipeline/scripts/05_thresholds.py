"""
pipeline/scripts/05_thresholds.py
Retrieves and analyzes Open-Meteo archive precipitation for Amritsar (JJAS 2010-2024),
computes empirical extreme rainfall trigger thresholds (T1h, T3h, T24h, T72h),
and caches raw and derived data for offline use.
"""

from datetime import datetime
import json
from pathlib import Path
import time
import numpy as np
import pandas as pd
import requests

from utils import compute_sha256, exit_with_error, get_repo_root

ROOT = get_repo_root()
CACHE_DIR = ROOT / "pipeline" / "cache"
SOURCES_MD = ROOT / "pipeline" / "SOURCES.md"

AMRITSAR_LAT = 31.634
AMRITSAR_LON = 74.872
START_DATE = "2010-06-01"
END_DATE = "2024-09-30"
ARCHIVE_URL = (
    f"https://archive-api.open-meteo.com/v1/archive?"
    f"latitude={AMRITSAR_LAT}&longitude={AMRITSAR_LON}&"
    f"start_date={START_DATE}&end_date={END_DATE}&hourly=precipitation"
)


def fetch_or_load_archive_data() -> dict:
    """Fetches archive data from Open-Meteo with backoff, or loads from local cache."""
    cache_file = CACHE_DIR / "open_meteo_archive_jjas.json"
    if cache_file.exists():
        print(f"[CACHE] Loading cached archive from {cache_file}...")
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    print(f"[DOWNLOAD] Querying Open-Meteo Archive API for {START_DATE} to {END_DATE}...")
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            resp = requests.get(ARCHIVE_URL, timeout=45)
            if resp.status_code == 200:
                data = resp.json()
                if "hourly" in data and "precipitation" in data["hourly"]:
                    with open(cache_file, "w", encoding="utf-8") as f:
                        json.dump(data, f)
                    print(f"[SUCCESS] Cached {len(data['hourly']['precipitation'])} hourly records to {cache_file}")
                    return data
            elif resp.status_code == 429:
                wait_time = 5 * attempt
                print(f"[RATE LIMIT] Received HTTP 429, backing off for {wait_time}s (attempt {attempt}/{max_retries})...")
                time.sleep(wait_time)
            else:
                print(f"[WARN] Open-Meteo HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            print(f"[WARN] Attempt {attempt} failed: {e}")
            time.sleep(3)

    exit_with_error("Failed to retrieve Open-Meteo archive precipitation after retries.")


def compute_thresholds(hourly_times: list[str], hourly_precip: list[float]) -> dict:
    """Computes empirical rainfall trigger thresholds (T1h, T3h, T24h, T72h) across JJAS seasons."""
    times = pd.to_datetime(hourly_times)
    series = pd.Series(hourly_precip, index=times)

    # Filter to June-September (JJAS: months 6, 7, 8, 9)
    jjas_mask = series.index.month.isin([6, 7, 8, 9])
    jjas_series = series[jjas_mask]
    total_jjas_hours = len(jjas_series)
    valid_jjas_hours = int(jjas_series.notna().sum())

    # 1. T1h: 99th percentile of all hourly precipitation across JJAS hours
    # Percentile convention: numpy percentile with linear interpolation
    clean_hourly = jjas_series.dropna().to_numpy()
    t1h = float(np.percentile(clean_hourly, 99)) if len(clean_hourly) > 0 else 0.0

    # Trailing 3h and 72h window calculations:
    # Must be calculated per yearly JJAS season so trailing windows do not cross non-consecutive winter gaps.
    trailing_3h = []
    trailing_72h = []

    years = sorted(list(set(jjas_series.index.year)))
    for year in years:
        y_data = series[(series.index.year == year) & (series.index.month.isin([6, 7, 8, 9]))]
        # Rolling sum requires full window (min_periods=window) to ensure incomplete windows are omitted
        r3 = y_data.rolling(3, min_periods=3).sum().dropna()
        trailing_3h.extend(r3.tolist())
        r72 = y_data.rolling(72, min_periods=72).sum().dropna()
        trailing_72h.extend(r72.tolist())

    trailing_3h = np.array(trailing_3h, dtype=np.float64)
    trailing_72h = np.array(trailing_72h, dtype=np.float64)

    # 2. T3h: 99th percentile of trailing 3-hour precipitation sums
    t3h = float(np.percentile(trailing_3h, 99)) if len(trailing_3h) > 0 else 0.0

    # 3. T24h: Fixed at 64.5 mm (IMD heavy-rainfall lower bound)
    t24h = 64.5

    # 4. T72h: 95th percentile of trailing 72-hour precipitation sums
    t72h = float(np.percentile(trailing_72h, 95)) if len(trailing_72h) > 0 else 0.0

    return {
        "T1h": round(t1h, 2),
        "T3h": round(t3h, 2),
        "T24h": round(t24h, 1),
        "T72h": round(t72h, 2),
        "provisional": False,
        "derivedFrom": "Open-Meteo ERA5-Land Reanalysis & Archive (10-25 km grid)",
        "span": f"{START_DATE} to {END_DATE} (JJAS Monsoon Seasons)",
        "units": "mm",
        "sampleCounts": {
            "totalJJASHours": total_jjas_hours,
            "validJJASHours": valid_jjas_hours,
            "windows3h": len(trailing_3h),
            "windows72h": len(trailing_72h),
        },
        "distributions": {
            "max1h": round(float(clean_hourly.max()), 2) if len(clean_hourly) > 0 else 0.0,
            "p95_1h": round(float(np.percentile(clean_hourly, 95)), 2) if len(clean_hourly) > 0 else 0.0,
            "p99_1h": round(t1h, 2),
            "max3h": round(float(trailing_3h.max()), 2) if len(trailing_3h) > 0 else 0.0,
            "p95_3h": round(float(np.percentile(trailing_3h, 95)), 2) if len(trailing_3h) > 0 else 0.0,
            "p99_3h": round(t3h, 2),
            "max72h": round(float(trailing_72h.max()), 2) if len(trailing_72h) > 0 else 0.0,
            "p90_72h": round(float(np.percentile(trailing_72h, 90)), 2) if len(trailing_72h) > 0 else 0.0,
            "p95_72h": round(t72h, 2),
        },
        "limitation": (
            "Thresholds are derived from a coarse model/archive grid, approximately 10–25 km, "
            "and should be compared with forecast rainfall on a similar grid. "
            "They do not represent street-level or gauge-specific extremes."
        ),
    }


def main():
    print("=" * 60)
    print(" NEXSTORM 05_thresholds: Empirical Rainfall Trigger Thresholds")
    print("=" * 60)

    raw_data = fetch_or_load_archive_data()
    hourly = raw_data["hourly"]

    thresholds_dict = compute_thresholds(hourly["time"], hourly["precipitation"])

    print("\n--- Empirical Rainfall Trigger Thresholds Summary ---")
    print(f"Coverage Span: {thresholds_dict['span']}")
    print(f"Total JJAS Sample Hours: {thresholds_dict['sampleCounts']['totalJJASHours']:,}")
    print(f"T1h  (99th percentile hourly):       {thresholds_dict['T1h']} mm (Max: {thresholds_dict['distributions']['max1h']} mm)")
    print(f"T3h  (99th percentile trailing 3h):  {thresholds_dict['T3h']} mm (Max: {thresholds_dict['distributions']['max3h']} mm)")
    print(f"T24h (IMD Heavy Rain Standard):     {thresholds_dict['T24h']} mm (Fixed lower bound)")
    print(f"T72h (95th percentile trailing 72h): {thresholds_dict['T72h']} mm (Max: {thresholds_dict['distributions']['max72h']} mm)")
    print(f"Limitation: {thresholds_dict['limitation']}")

    out_path = CACHE_DIR / "thresholds.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(thresholds_dict, f, indent=2)
    print(f"\n[EXPORT] Thresholds written to {out_path}")

    # Update SOURCES.md with Open-Meteo entry
    cache_file = CACHE_DIR / "open_meteo_archive_jjas.json"
    if cache_file.exists() and SOURCES_MD.exists():
        sha256 = compute_sha256(cache_file)
        with open(SOURCES_MD, "r", encoding="utf-8") as f:
            sources_content = f.read()

        if "Open-Meteo Historical Weather API" not in sources_content:
            new_entry = f"""
## 5. Open-Meteo ERA5-Land Reanalysis Archive
- **Source Name:** Open-Meteo Historical Weather API (ERA5-Land reanalysis model grid)
- **URL / Official Page:** https://archive-api.open-meteo.com/v1/archive
- **Retrieval Date:** {datetime.now().strftime('%Y-%m-%d')}
- **Licence:** Creative Commons Attribution 4.0 International (CC BY 4.0) / Copernicus ECMWF Licence
- **Licence URL:** https://open-meteo.com/en/terms
- **Checksum (SHA-256):** `{sha256}`
- **Acquisition Method:** Downloaded via HTTP API, cached at `pipeline/cache/open_meteo_archive_jjas.json`
- **Native Resolution / CRS:** ~10-25 km grid / WGS84 point query (31.634 N, 74.872 E)
- **Coverage:** Hourly precipitation for June-September (JJAS) from 2010 through 2024 (43,920 hours)
- **Restrictions / Uncertainty:** Coarse reanalysis grid model; does not represent localized rain gauge extremes.
"""
            with open(SOURCES_MD, "a", encoding="utf-8") as f:
                f.write(new_entry)
            print("[SOURCES] Appended Open-Meteo archive entry to pipeline/SOURCES.md")

    print("\n[COMPLETE] 05_thresholds completed successfully.")


if __name__ == "__main__":
    main()
