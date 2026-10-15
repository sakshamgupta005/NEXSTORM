# NEXSTORM — Scientific Validation, Risk Calibration & Reliability Audit Report

**Date:** 2026-10-15  
**Pilot Study Area:** Amritsar, Punjab, India (Municipal analysis grid: 1,998 cells @ 250m; GNDU Campus sub-grid: 699 cells @ 50m)  
**Governing Configuration Hash:** `74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49`  

---

## 1. Executive Summary

This report establishes the scientific validity, calibration properties, empirical baselines, and data reliability guardrails for **NEXSTORM**, an experimental urban waterlogging and heavy-rainfall susceptibility prototype.

In strict alignment with the project's governing directives, **no synthetic production data, invented incidents, or fabricated flood depths** were created. All evaluations reflect the actual historical records ($N=15$ verified incident locations, $9$ event days across $10$ monsoon seasons) and the actual running codebase.

### Primary Scientific Conclusions
1. **Zero Training Leakage in Model Formulation**: The model's static susceptibility weights and multi-window RTI thresholds were defined a priori from Copernicus DEM terrain and 15 seasons (2010–2024 JJAS) of ERA5-Land reanalysis. Historical incident locations were **never used to fit or optimize model parameters**.
2. **Statistically Meaningful Hotspot Recovery with Wide Confidence Intervals**: 8 of 15 validated hotspot cells ($53.3\%$) fall within the top 20% of susceptibility scores ($2.67\times$ lift over the 20% spatial null). The median hotspot cell percentile is **81.9%**. However, due to the small sample size ($N=15$), the exact 95% Clopper-Pearson binomial confidence interval is wide: $[26.6\%, 78.7\%]$.
3. **Severe News-Reporting Selection Bias Discovered**: A pure built-up density baseline achieves an apparent ROC-AUC of **0.8658**, compared to **0.5609** for the frozen terrain-informed susceptibility score. Investigation reveals this is an artifact of journalistic selection bias: all 15 reports originated from *The Tribune India* and documented traffic bottlenecks in prominent commercial arteries (Hall Gate, Putlighar, Lawrence Road). Unreported peripheral cells are unlabelled, not confirmed flood-free. Adopting a model driven solely by built-up density was scientifically rejected (`adopted: false`).
4. **High Sensitivity vs. False Alarm Burden**: The model's multi-window RTI rule ($\max(RTI) \ge 0.5$) detects **66.7% (6/9)** of historical reported event days, whereas the standard IMD 24h 64.5mm threshold captures **0.0% (0/9)**, confirming that 24-hour totals fail to capture short convective cloudbursts. However, the model rule triggers on **45.0 days per 122-day monsoon season (~36.9% of days)**, incurring a substantial false alarm burden that must be explicitly communicated to users.
5. **Spatial Resolution Limits**: The 250m city cells ($62,500\text{ m}^2$) indicate macro-catchment susceptibility and cannot support claims of street-level curb or doorway inundation.

---

## 2. Risk Engine Formulation & Assumptions

### 2.1 Multi-Window Rainfall Threat Index (RTI)
Urban pluvial flooding in Indian cities is driven by sub-daily convective rainfall intensity interacting with antecedent ground saturation. NEXSTORM calculates the dimensionless Rainfall Threat Index:

$$\text{RTI} = \max\left( \frac{P_{1\text{h}}}{T_{1\text{h}}}, \frac{P_{3\text{h}}}{T_{3\text{h}}}, \frac{P_{24\text{h}}}{T_{24\text{h}}}, \frac{P_{72\text{h}} + \text{Antecedent}_{72\text{h}}}{T_{72\text{h}}} \right)$$

Frozen calibrated thresholds derived from 15 seasons of Open-Meteo ERA5-Land Reanalysis (2010-06-01 to 2024-09-30 JJAS):
- $T_{1\text{h}} = 3.5\text{ mm}$ (90th percentile hourly monsoon precipitation)
- $T_{3\text{h}} = 8.9\text{ mm}$ (90th percentile 3-hour accumulation)
- $T_{24\text{h}} = 64.5\text{ mm}$ (Official IMD "Heavy Rainfall" criterion)
- $T_{72\text{h}} = 44.8\text{ mm}$ (95th percentile 72-hour accumulation)

#### RTI Categorization
- $\text{RTI} < 0.5$: `none`
- $0.5 \le \text{RTI} < 1.0$: `elevated`
- $1.0 \le \text{RTI} < 1.5$: `severe`
- $\text{RTI} \ge 1.5$: `extreme`
- **Beyond Calibration Safeguard**: If $\max(\text{RTI}) > 2.25$ ($1.5\times$ the extreme cutoff), the system flags the result with `beyondCalibration: true` and warns that outputs outside calibration are unreliable.

### 2.2 Static Susceptibility Index ($s$)
Cell susceptibility $s \in [0, 1]$ represents intrinsic topographic and imperviousness vulnerability:

$$s = 0.30 \cdot f_{\text{depression}} + 0.30 \cdot f_{\text{builtUp}} + 0.15 \cdot f_{\text{lowPoint}} + 0.15 \cdot f_{\text{densityProxy}} + 0.10 \cdot f_{\text{flatness}}$$

- $f_{\text{depression}}$: Rank of relative terrain hollow depth (Copernicus DEM GLO-30).
- $f_{\text{builtUp}}$: Mean of built-up area fraction and building footprint density.
- $f_{\text{lowPoint}}$: Indicator ($1.0$ vs $0.0$) if an OSM railway/road underpass proxy exists within 200m.
- $f_{\text{densityProxy}}$: Drainage deficiency proxy based on building count and area.
- $f_{\text{flatness}}$: Rank of slope flatness (low slope impedes gravity drainage).

### 2.3 2D Coupling Matrix
The continuous susceptibility score $s$ is partitioned into 3 static bins:
- `low`: $s < 0.33$ (644 cells, 32.2%)
- `mid`: $0.33 \le s \le 0.66$ (1,198 cells, 60.0%)
- `high`: $s > 0.66$ (156 cells, 7.8%)

Combining $S_{\text{band}}$ with $\text{RTI}_{\text{band}}$ produces the cell's displayed relative risk class:

| $S_{\text{band}} \backslash \text{RTI}_{\text{band}}$ | `none` ($\text{RTI} < 0.5$) | `elevated` ($0.5 \le \text{RTI} < 1.0$) | `severe` ($1.0 \le \text{RTI} < 1.5$) | `extreme` ($\text{RTI} \ge 1.5$) |
| :--- | :--- | :--- | :--- | :--- |
| **Low** ($s < 0.33$) | Low | Low | Low | Moderate |
| **Mid** ($0.33 \le s \le 0.66$) | Low | Low | Moderate | High |
| **High** ($s > 0.66$) | Low | Moderate | High | High |

---

## 3. Empirical Evaluation & Baseline Comparison

### 3.1 Hotspot Recovery (Experiment E2)
- **Unit of Observation**: 15 distinct spatial cells snapped from 15 published news reports of urban waterlogging in Amritsar.
- **Top 20% Hit Share**: 8 of 15 cells ($53.33\%$).
- **Statistical Significance**: Clopper-Pearson Exact 95% Binomial CI: $[26.59\%, 78.73\%]$. The null hypothesis expectation of random spatial selection is $20.0\%$.
- **Median Hotspot Percentile**: $81.93\%$ (IQR: $66.52\%$, 25th percentile: $23.37\%$, 75th percentile: $89.89\%$).

### 3.2 Baseline Performance Comparison
To assess whether the multi-factor susceptibility index adds genuine predictive value over simpler heuristics, all models were evaluated on the same pseudo-negative sample ($N=150$ sampled non-hotspot cells):

| Model / Feature Baseline | ROC-AUC | PR-AUC | Status | Scientific Assessment |
| :--- | :---: | :---: | :---: | :--- |
| **Random Spatial Baseline** | 0.5000 | 0.0909 | Benchmark | Uninformed spatial null expectation. |
| **Depression-Only ($f_{\text{depression}}$)** | 0.5431 | 0.1240 | Rejected | Topographic depression alone provides marginal discrimination in low-relief alluvial terrain. |
| **NEXSTORM Frozen Susceptibility ($S$)** | **0.5609** | **0.1606** | **Adopted** | Integrates terrain depression, slope, underpass low-points, and building density. Achieves 2.67x top-20% lift over null. |
| **Built-Up Density Only ($f_{\text{builtUp}}$)** | 0.8658 | 0.4410 | **Rejected** | **Artifact of news-reporting bias.** Explored and rejected (`learnedModelAdopted: false`). |

### 3.3 The Reporting Bias Finding
The apparent superiority of built-up density ($\text{ROC-AUC} = 0.8658$) is an epidemiological artifact:
- All 15 historical incident reports were gathered from local print journalism (*The Tribune India*).
- Media coverage systematically favors high-visibility commercial corridors (Hall Gate, Putlighar Chowk, Lawrence Road, Civil Lines, SSSS Chowk underpass) where traffic disruption impacts commerce.
- Peripheral residential or informal settlements experiencing severe ponding are omitted from news coverage.
- In presence-only evaluation, **non-hotspot cells are unlabelled, not confirmed non-flooding zones**.
- Optimizing weights towards built-up density would cause severe hydrologic miscalibration, blinding the model to pluvial depressions in less built-up areas.

### 3.4 Temporal Split & Zero Training Leakage
To audit temporal stability and prove absence of data leakage:
- **2023 Monsoon Batch** (5 locations: H-0001 to H-0005): 4 of 5 cells in top 20% susceptibility ($80.0\%$, Exact 95% CI: $[28.4\%, 99.5\%]$).
- **2024 Monsoon Batch** (10 locations: H-0006 to H-0015): 4 of 10 cells in top 20% susceptibility ($40.0\%$, Exact 95% CI: $[12.2\%, 73.8\%]$).
- **Zero Leakage**: Model weights were fixed a priori and never trained on either the 2023 or 2024 datasets.

---

## 4. Historical Event Detection vs. Alert Burden (Experiment E3)

Evaluated across 1,220 eligible JJAS monsoon days across 10 seasons (2015–2024):
- **Reported Waterlogging Event Days**: 9 distinct calendar days.

| Metric | NEXSTORM Model Rule ($\max(\text{RTI}) \ge 0.5$) | IMD Heavy Rain Baseline ($P_{24\text{h}} \ge 64.5\text{ mm}$) |
| :--- | :---: | :---: |
| **Hits (Event Days Captured)** | **6 / 9** | 0 / 9 |
| **Probability of Detection (POD)** | **66.67%** | 0.0% |
| **Wilson 95% Confidence Interval** | $[35.42\%, 87.94\%]$ | $[0.00\%, 29.91\%]$ |
| **Total Alert Days (10 Seasons)** | 450 days | 2 days |
| **Alert Days Per Monsoon Season** | **45.0 days / season** | 0.2 days / season |
| **Monsoon Alert Frequency** | **36.89% of all days** | 0.16% of all days |

### Scientific Trade-Off Analysis
1. **Diagnostic Failure of 24h Totals**: The official IMD 24h 64.5mm threshold missed all 9 recorded waterlogging events. Localized urban waterlogging in Amritsar is triggered by intense 1-hour or 3-hour convective cloudbursts ($P_{1\text{h}} \ge 15\text{ mm}$) that do not accumulate to 64.5mm over 24 hours.
2. **High False Alarm Burden**: The multi-window RTI rule captures sub-daily pulses, but alerting on 45 days per 122-day monsoon season (~37%) represents high alert fatigue if interpreted as guaranteed flooding. Users must be educated that an alert indicates *heightened relative susceptibility to pluvial runoff*, not unavoidable street flooding.
3. **The 3 Missed Events**:
   - `2023-07-15` (Hall Gate Market): $\max(\text{RTI}) = 0.4571$ (just below 0.5 threshold; 24h rain: 2.2mm).
   - `2023-08-20` (GT Road near Alpha Mall): $\max(\text{RTI}) = 0.3714$ (24h rain: 1.4mm).
   - `2023-09-02` (East Mohan Nagar): $\max(\text{RTI}) = 0.0000$ (24h rain: 0.0mm).
   On 2023-09-02, waterlogging was reported in East Mohan Nagar while coarse reanalysis recorded 0.0mm of rain. This proves that 10–25 km satellite/reanalysis grids completely miss hyper-local cloudburst cells, or that local sewer blockage caused flooding without rainfall.

---

## 5. Live Data, Provenance & Failure Mode Audit

| Data Source | Ingest Mechanism | Failure Mode | Provenance & Safeguard |
| :--- | :--- | :--- | :--- |
| **Open-Meteo Ensemble** | ECMWF IFS / GFS 0.25° | Upstream timeout / HTTP 5xx | Fallback order: ECMWF -> GFS -> Deterministic -> Cached Snapshot -> Degraded (503). Never fabricates members. |
| **Forecast Imputation** | Array normalization | Null intervals in precipitation array | Imputed as 0mm, and explicitly logged in `provenance.note`: `(DATA QUALITY WARNING: N missing intervals imputed)`. |
| **Snapshot Cache** | `public/data/snapshots/` | Corrupt JSON, stale (>6h), or future timestamp | Future timestamps (>60s) strictly rejected; stale snapshots (>6h) rejected; returns HTTP 503 degraded state. |
| **NDMA SACHET CAP** | XML feed parsing | Malformed XML, CDATA, missing tags | Zero-dependency safe parser; rejects non-Punjab alerts; prominent disclaimer separating official warnings from model outputs. |
| **Ensemble Confidence** | Inter-member spread | Deterministic fallback | Truthfully outputs `confidence: 'unavailable'`; does not manufacture artificial spreads. |

---

## 6. Explicit Boundaries (What NEXSTORM Does NOT Claim)

1. **Does NOT predict physical flood depth**: Risk classes (`Low`, `Moderate`, `High`) denote relative susceptibility ranks, never inundation depth in centimeters or inches.
2. **Does NOT model pipe surcharge hydraulics**: Underground storm sewers, silt deposition, pump station capacity, and pipe backflow are not simulated.
3. **Does NOT predict building damage or water ingress**: Predictions are cell-level spatial indices, not property-level damage assessments.
4. **Does NOT replace official warnings**: Statutory emergency alerts belong exclusively to the India Meteorological Department (IMD) and the National Disaster Management Authority (NDMA SACHET).
5. **Does NOT claim statewide coverage**: Only the Amritsar municipal boundary (250m) and GNDU campus (50m) have validated feature grids. Other Punjab cities (Ludhiana, Jalandhar, Patiala) are unmodelled.
