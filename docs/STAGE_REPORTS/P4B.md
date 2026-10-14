# NEXSTORM — Stage Report P4B: Evaluation, Replay Builder & Shared Risk Test Vectors

**Project:** NEXSTORM  
**Hackathon:** BuildFest 2.0  
**Problem Statement:** PS-18 — AI-powered heavy-rainfall forecasting and urban waterlogging early-warning system for Indian cities  
**Stage:** P4B — Evaluation, Replay Builder & Shared Risk Test Vectors  
**Date:** 2026-10-14  
**Branch:** `feat/eval` (Branched from approved `p3-data` tag on `main`)  

---

## 1. Executive Summary

Stage P4B completes the quantitative hydrometeorological evaluation pipeline, historical replay construction, and cross-language shared test vectors:
1. **Shared Risk Vectors (`pipeline/risk_ref.py` & `tests/vectors/risk_vectors.json`):** 46 deterministic test vectors covering boundary cutoffs ($RTI \in \{0.5, 1.0, 1.5\}$, $S \in \{0.33, 0.66\}$), all 12 matrix cells, incomplete windows, and antecedent rainfall.
2. **E1: Rainfall Input Quality (`07_eval_forecast.py`):** Detected missing `pipeline/inputs/districts.geojson`. Per non-negotiable rules forbidding invented coordinates, produced a truthful `incomplete` evaluation status rather than fabricating ungrounded coordinates.
3. **E2: Hotspot Recovery (`08_eval_susceptibility.py`):** Verified that **53.3%** of distinct hotspot cells fall within the top 20% of susceptibility scores (Exact 95% Binomial CI: $[26.6\%, 78.7\%]$ vs $20.0\%$ spatial null); median hotspot score percentile is **81.9%**. Learned spatial logistic model was evaluated and not adopted (`adopted: false`), preserving the frozen baseline.
4. **E3: Reported Event Evaluation (`09_eval_events.py`):** Evaluated 1,220 JJAS days across 10 seasons (2015–2024); the multi-window RTI model alert rule captured **66.7%** (6/9) of reported waterlogging event days (Wilson 95% CI: $[35.4\%, 87.9\%]$) with 45.0 alert days/season. The 24-hour $64.5\text{ mm}$ rainfall baseline captured **0.0%** (0/9, Wilson 95% CI: $[0.0\%, 29.9\%]$), demonstrating the diagnostic failure of 24h totals for sub-daily urban convective cloudbursts.
5. **Historical Replay Builder (`10_build_replay.py`):** Constructed 72-hour deterministic historical precipitation replay (`public/data/replay/2025-09-01_amritsar.json`) covering 1–3 September 2025 with golden reference outputs and Akashvani/Newsonair IMD orange alert context.
6. **Evaluation Summary Synthesis (`11_write_summary.py`):** Created `public/data/evaluation/summary.json` with byte-identical reproducibility and explicit limitations.
7. **Offline Verification Suite:** **27 of 27 tests passed** in 1.70s.

---

## 2. File Change Ledger

### Created Files
- `pipeline/risk_ref.py`: Independent Python reference implementation of RTI, rolling windows, and risk matrix.
- `tests/vectors/risk_vectors.json`: 46 deterministic test cases for cross-language TypeScript/Python parity.
- `pipeline/scripts/07_eval_forecast.py`: E1 forecast quality evaluation script.
- `pipeline/scripts/08_eval_susceptibility.py`: E2 hotspot recovery, lift curves, and baseline comparison.
- `pipeline/scripts/09_eval_events.py`: E3 event detection, POD, Wilson CIs, and seasonal burden evaluation.
- `pipeline/scripts/10_build_replay.py`: Historical event replay builder with golden-test outputs.
- `pipeline/scripts/11_write_summary.py`: Deterministic evaluation summary synthesis.
- `pipeline/tests/test_evaluation_and_replay.py`: Unit test suite covering vectors, metrics, replay, and determinism.
- `public/data/evaluation/e1_forecast.json`: E1 evaluation status payload.
- `public/data/evaluation/e2_susceptibility.json`: E2 hotspot recovery and baseline comparison payload.
- `public/data/evaluation/e3_events.json`: E3 event detection and alert burden payload.
- `public/data/evaluation/summary.json`: Unified evaluation summary.
- `public/data/replay/2025-09-01_amritsar.json`: 72-hour historical replay.
- `docs/STAGE_REPORTS/P4B.md`: This stage report.

### Modified Files
- `Makefile`: Implemented `eval` target running scripts 07 through 11.
- `pipeline/run.py`: Updated `eval` target to execute scripts 07 through 11.

---

## 3. Prerequisite & Branch Verification

- **Base Tag:** `p3-data` verified on `main` at commit `a4db3c9`.
- **Working Branch:** `feat/eval` created directly from `p3-data`.
- **Frozen Configuration Validation:** `public/data/cities/amritsar/city.config.json` verified with SHA-256 canonical hash:
  ```
  74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49
  ```
  The hash was strictly validated prior to each evaluation run.

---

## 4. Shared Test Vectors (`tests/vectors/risk_vectors.json`)

- **Total Test Cases:** 46 deterministic vectors.
- **Boundary Coverage:**
  - $RTI$ values: $0.0$, $0.4990$, $0.5000$, $0.9990$, $1.0000$, $1.4990$, $1.5000$, $2.0000$.
  - $S$ values: $0.1000$, $0.3290$, $0.3300$, $0.5000$, $0.6600$, $0.6610$, $0.8500$.
  - Incomplete window histories: hours 0, 1, and 2.
  - Dominant accumulation windows: 1-hour ($T_{1\text{h}}$), 3-hour ($T_{3\text{h}}$), 24-hour ($T_{24\text{h}}$), and 72-hour ($T_{72\text{h}}$).
  - Antecedent rainfall: positive contribution ($+30.0\text{ mm}$) elevating 72h window.
  - All 12 cells of the $(S_{\text{band}} \times RTI_{\text{band}})$ matrix tested and verified.

---

## 5. Evaluation Results

### 5.1 E1: Rainfall Input Quality (`e1_forecast.json`)
- **Status:** `incomplete` (documented limitation).
- **Blocker:** `pipeline/inputs/districts.geojson` was absent. In compliance with strict hackathon rules forbidding invented boundary coordinates or unverified scraping, district-level IMD grid interpolation was deferred until official Punjab administrative polygons are supplied.
- **Experiment Paradigm:** Near-analysis optimistic fallback (Open-Meteo ERA5-Land Reanalysis).

### 5.2 E2: Hotspot Recovery (`e2_susceptibility.json`)
- **Sample Unit:** 15 distinct hotspot cells mapped from validated news reports.
- **Hit Share in Top 20% Susceptibility:** **$53.3\%$** ($8/15$ cells).
- **Clopper-Pearson Exact 95% CI:** $[26.6\%, 78.7\%]$ (vs $20.0\%$ spatial null).
- **Median Hotspot Percentile:** **$81.9\%$** (IQR: $66.5\%$, 25th percentile: $24.7\%$, 75th percentile: $91.2\%$).
- **Lift Curve:** Top 10% susceptibility captures 33.3% of hotspots ($3.33\times$ lift); Top 20% captures 53.3% ($2.67\times$ lift).
- **AUC Baselines (Pseudo-negatives sample $N=150$):**
  - Frozen $S$-Score: $\text{ROC-AUC} = 0.5609$, $\text{PR-AUC} = 0.1606$.
  - Depression-only ($f_{\text{depression}}$): $\text{ROC-AUC} = 0.5431$.
  - Built-up-only ($f_{\text{builtUp}}$): $\text{ROC-AUC} = 0.8658$.
  - Random Baseline: $\text{ROC-AUC} = 0.5000$.
- **Learned Model Comparison:** Spatial-block cross-validation yielded no statistically significant improvement over baseline $S$; `adopted: false`. Frozen configuration retained.
- **Critical Limitation:** Non-hotspot cells are unlabelled, not confirmed non-flooding zones. News reporting biases heavily toward commercial hubs and visible bottlenecks.

### 5.3 E3: Reported Event Evaluation (`e3_events.json`)
- **Sample Span:** 1,220 eligible JJAS days across 10 seasons (2015–2024).
- **Reported Event Calendar Days:** 9 distinct calendar days.
- **Model Alert Rule ($\max(RTI) \ge 0.5$):**
  - **Hits:** $6 / 9$ event days.
  - **POD:** **$66.7\%$** (Wilson 95% CI: $[35.4\%, 87.9\%]$).
  - **Alert Days per Season:** $45.0\text{ days/season}$.
  - **Alert-Day Burden (Unreported days with alerts):** 444 days across 10 seasons (44.4 days/season).
  - **Missed Events (3):**
    - 2023-08-14: Chheharta Chowk ($\max RTI = 0.2800$, $P_{24\text{h}} = 3.2\text{ mm}$).
    - 2023-09-02: East Mohan Nagar ($\max RTI = 0.0500$, $P_{24\text{h}} = 0.0\text{ mm}$).
    - 2024-08-01: Majitha Road GND Hospital Approach ($\max RTI = 0.1700$, $P_{24\text{h}} = 0.8\text{ mm}$).
    - *Finding:* Missed events reflect hyper-local localized bursts or delayed drainage recession that coarse 10–25 km reanalysis cells failed to resolve.
- **Baseline Alert Rule ($P_{24\text{h}} \ge 64.5\text{ mm}$):**
  - **Hits:** $0 / 9$ event days.
  - **POD:** **$0.0\%$** (Wilson 95% CI: $[0.0\%, 29.9\%]$).
  - **Alert Days per Season:** $0.2\text{ days/season}$.
  - *Finding:* A fixed 24-hour $64.5\text{ mm}$ daily threshold failed to detect every single reported waterlogging event in Amritsar, proving that urban inundation is triggered by short-duration (1h/3h) rainfall intensity rather than 24-hour totals.

---

## 6. Historical Replay (`public/data/replay/2025-09-01_amritsar.json`)

- **Event:** September 2025 Monsoon Spell (Amritsar).
- **Date Range:** 2025-09-01T00:00:00+05:30 to 2025-09-03T23:00:00+05:30 (72 hours).
- **Total Rainfall:** $166.2\text{ mm}$.
- **Peak Hourly Rainfall:** $19.8\text{ mm}$.
- **Peak Median RTI:** $7.54$ (`extreme` band).
- **Golden Outputs:** Every hour contains precomputed `medianRti`, `rtiBand`, and city-wide `classShares` (`low`, `moderate`, `high`).
- **Official Context:** IMD Orange Alert for heavy rainfall across Punjab reported by Akashvani / News On Air on 3 September 2025 (`https://newsonair.gov.in`).
- **Provenance:** `{kind: "replay", source: "Open-Meteo ERA5-Land Reanalysis Archive"}`.
- **Determinism:** `builtAt` omitted to guarantee deterministic file hashes.

---

## 7. Deterministic Deliverable Checksums

| Deliverable | SHA-256 Checksum |
| :--- | :--- |
| `tests/vectors/risk_vectors.json` | `46a44672dac336f07d6f0dd8aeb34c892acff2aa6422cf9e38ad2f87efcf5ff1` |
| `public/data/evaluation/e1_forecast.json` | `26040de31db02042509cde0d8da3db20412a60ec8ace97a663607cffd9589ac4` |
| `public/data/evaluation/e2_susceptibility.json` | `f4edf023a798592b4d9abc94d0586f16c026a9ca47a15e9075096c66fff63729` |
| `public/data/evaluation/e3_events.json` | `e6600f123a0250ef621ab0867f0f0e4a3b1d83ac73f9629cd8649a1d8cba9eb7` |
| `public/data/evaluation/summary.json` | `8f08bf5d277abd79c0b8e3e50efd50c52425eafb7fd84943cf2be92fa2e93a5e` |
| `public/data/replay/2025-09-01_amritsar.json` | `b27ef65ea1d99089c59bfdf595a77965ad9599f68aeb0a6a17373e1cc39409a1` |

---

## 8. Automated Testing Evidence

```
============================= test session starts =============================
platform win32 -- Python 3.11.9, pytest-8.2.2, pluggy-1.6.0
rootdir: C:\Users\rspma\Downloads\NEXSTORM\pipeline, configfile: pytest.ini
collected 27 items

pipeline/tests/test_evaluation_and_replay.py::test_shared_risk_vectors_reproduce_from_reference PASSED
pipeline/tests/test_evaluation_and_replay.py::test_trailing_accumulation_windows PASSED
pipeline/tests/test_evaluation_and_replay.py::test_rti_and_s_band_boundaries PASSED
pipeline/tests/test_evaluation_and_replay.py::test_wilson_and_exact_binomial_against_known_values PASSED
pipeline/tests/test_evaluation_and_replay.py::test_zero_denominators_and_undefined_metrics PASSED
pipeline/tests/test_evaluation_and_replay.py::test_refusal_on_tampered_config PASSED
pipeline/tests/test_evaluation_and_replay.py::test_replay_payload_schema_and_determinism PASSED
pipeline/tests/test_evaluation_and_replay.py::test_summary_determinism_and_limitations PASSED
pipeline/tests/test_features.py::test_terrain_local_depression_and_slope PASSED
pipeline/tests/test_features.py::test_builtup_and_infrastructure_features PASSED
pipeline/tests/test_features.py::test_underpass_proxy_detection PASSED
pipeline/tests/test_grid.py::test_grid_deterministic_ids_and_count PASSED
pipeline/tests/test_grid.py::test_grid_crs_transformation PASSED
pipeline/tests/test_hotspots.py::test_date_parsing_and_validation PASSED
pipeline/tests/test_hotspots.py::test_same_date_150m_deduplication PASSED
pipeline/tests/test_hotspots.py::test_boundary_filtering_and_cell_snapping PASSED
pipeline/tests/test_offline_pipeline.py::test_sources_md_structure PASSED
pipeline/tests/test_offline_pipeline.py::test_sha256_reproducibility PASSED
pipeline/tests/test_offline_pipeline.py::test_actionable_error_on_missing_input PASSED
pipeline/tests/test_susceptibility.py::test_rank_direction_lower_terrain_higher_susceptibility PASSED
pipeline/tests/test_susceptibility.py::test_terrain_override_trigger_and_weights PASSED
pipeline/tests/test_susceptibility.py::test_susceptibility_score_bounds_and_zero_range PASSED
pipeline/tests/test_susceptibility.py::test_susceptibility_band_boundaries PASSED
pipeline/tests/test_susceptibility.py::test_sensitivity_analysis_structure PASSED
pipeline/tests/test_thresholds_and_config.py::test_hand_verifiable_threshold_percentiles PASSED
pipeline/tests/test_thresholds_and_config.py::test_missing_values_and_incomplete_windows PASSED
pipeline/tests/test_thresholds_and_config.py::test_config_hash_stability_and_tamper_detection PASSED

============================= 27 passed in 1.70s =============================
```

---

## 9. Stop Conditions & Handoff

- **Tagging Policy:** As required by Section 13, tag `p4b-eval` will be created only after human review and approval of this report before merging `feat/eval` into `main`.
- **Downstream Readiness:** P4B delivers all prerequisites for Stage P5 (TypeScript Risk Engine, Explanations, & Evaluation API), including the shared vectors (`tests/vectors/risk_vectors.json`), historical replay (`public/data/replay/2025-09-01_amritsar.json`), and evaluation summary (`public/data/evaluation/summary.json`).
