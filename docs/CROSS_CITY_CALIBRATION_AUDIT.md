# NEXSTORM Cross-City Calibration & Feature Comparability Audit (P24)

**Document Status:** Complete & Verified  
**Date:** October 2026  
**Comparative Geographies:** Amritsar (Calibrated Baseline) vs. Jalandhar (Exploratory Prototype)  
**Governing Standard:** P24 Geospatial Truth & Observability Protocol  

---

## 1. Executive Summary & Audit Mandate

NEXSTORM P23 introduced multi-city platform abstraction, establishing configuration contracts and dynamic city registration. In P24, this audit evaluates whether the underlying terrain features, susceptibility distributions, and risk scoring matrices are **technically correct, statistically comparable, and meaningfully interpretable** across disparate municipal geographies.

### Governing Scientific Finding:
> **SUSCEPTIBILITY SCORES ARE ORDINAL WITHIN A CITY, NOT COMPARABLE ACROSS CITIES.**
> A susceptibility score of $S = 0.50$ in Amritsar DOES NOT represent the same physical inundation probability as $S = 0.50$ in Jalandhar. Feature weights, normalization baselines, and risk cutoffs calibrated on Amritsar cannot be assumed to possess predictive validity in another municipal basin.

---

## 2. Statistical Comparison of Amritsar vs. Jalandhar

We conducted an independent statistical audit comparing the published GeoJSON layers (`susceptibility.geojson` and `grid.geojson`) for both cities:

| Metric / Layer Attribute | Amritsar (Reference Baseline) | Jalandhar (Exploratory Prototype) | Comparability Analysis & Discrepancies |
| :--- | :--- | :--- | :--- |
| **Grid Cell Count** | 1,998 metric cells | 2,354 metric cells | Both use regular $250\text{m} \times 250\text{m} = 62,500\,\text{m}^2$ cells in UTM Zone 43N (`EPSG:32643`). |
| **Study Area Extent** | 124.875 km² ($396\,\text{km}^2$ perimeter) | 147.125 km² ($0.14^\circ \times 0.10^\circ$) | Amritsar covers official municipal perimeter; Jalandhar is a rectangular Area of Interest (AOI). |
| **Boundary Specification** | Irregular official administrative boundary polygon | 4-vertex rectangular bounding box | Edge cells in both cities overhang boundary by up to 125m due to centroid-inclusion logic. |
| **Data Origin & Provenance** | **Physical Sensor & Vector Sampling** (Copernicus DEM 30m, ESA WorldCover 10m, OSM roads, Google Buildings) | **Analytic Coordinate Proxies** (distance-decay equations from central point + alluvial gradient formulas) | **Fundamental Provenance Difference:** Amritsar features reflect actual terrain relief; Jalandhar features are mathematical approximations. |
| **Composite Score Min ($S_{\min}$)** | **0.0000** | **0.2346** | Jalandhar minimum score is heavily elevated due to high baseline flatness and low-point proxies. |
| **Composite Score Mean ($S_{\mu}$)** | **0.4225** | **0.4557** | Similar citywide averages, but masking vastly different internal variance structures. |
| **Composite Score Max ($S_{\max}$)** | **1.0000** | **0.7508** | Jalandhar never reaches high susceptibility ($S > 0.75$) due to proxy damping. |
| **Standard Deviation ($S_{\sigma}$)** | **0.1697** | **0.0828** | **High Compression Anomaly:** Jalandhar susceptibility variance is less than half of Amritsar's. |
| **Low Band ($S < 0.33$)** | **32.23%** (644 cells) | **4.33%** (102 cells) | Amritsar exhibits healthy low-susceptibility negative space; Jalandhar has almost none. |
| **Mid Band ($0.33 \le S < 0.66$)** | **59.96%** (1,198 cells) | **93.16%** (2,193 cells) | **93.2% of Jalandhar is compressed into the mid band**, eliminating spatial contrast. |
| **High Band ($S \ge 0.66$)** | **7.81%** (156 cells) | **2.51%** (59 cells) | Severe under-representation of high-risk hotspots in Jalandhar. |

---

## 3. Component Feature Distribution Breakdown

Analyzing individual feature layers reveals the physical mechanisms driving the distribution differences:

### 1. Flatness Proxy (`f_flatness`)
- **Amritsar:** Min=0.0130, Mean=0.5000, Max=1.0000, Std=0.2886. Quantile-normalized across DEM slope cells, producing a uniform $[0, 1]$ spread.
- **Jalandhar:** Min=0.2000, Mean=**0.9073**, Max=1.0000, Std=0.1273.
- **Root Cause:** In Jalandhar, `f_flatness` was derived from `slope_raw = np.abs(np.gradient(f_depression_raw))`. Because `f_depression_raw` was a smooth coordinate slope, spatial gradient values are very small, causing $1.0 - \text{slope} \approx 0.90$ across almost the entire city.

### 2. Low-Point Proxy (`f_lowPoint`)
- **Amritsar:** Min=0.0000, Mean=**0.1206**, Max=1.0000, Std=0.3258. Low points were strictly defined as cells falling into the lowest 20th percentile of local relief, so only ~12% of cells receive a positive score.
- **Jalandhar:** Min=0.2358, Mean=**0.6471**, Max=0.9500, Std=0.1647.
- **Root Cause:** In Jalandhar, `f_lowPoint = 1.0 - f_depression_raw`. Since mean depression is ~0.47, mean lowPoint became ~0.65. Over 65% of the city is treated as a "low point," which defies physical hydrology.

### 3. Built-Up Proxy (`f_builtUp`)
- **Amritsar:** Min=0.2604, Mean=0.5000, Max=0.9638, Std=0.1813. Sampled directly from 10m ESA WorldCover built-up pixels and Google Open Buildings footprints.
- **Jalandhar:** Min=0.0500, Mean=0.2643, Max=0.9500, Std=0.1696. Exponential radial decay from center `(31.33°N, 75.59°E)`. Accurately concentrates density in the urban core, but misses secondary commercial corridors (e.g. Model Town, Rama Mandi).

---

## 4. Reusing Amritsar Weights and Thresholds: The Portability Fallacy

In `city.config.json`, Jalandhar inherited identical parameters from Amritsar:
```json
"weights": {
  "depression": 0.3,
  "flatness": 0.1,
  "builtUp": 0.3,
  "lowPoint": 0.15,
  "densityProxy": 0.15
},
"sBandCutoffs": [0.33, 0.66],
"thresholds": {
  "T1h": 3.5,
  "T3h": 8.9,
  "T24h": 64.5,
  "T72h": 44.8
}
```

### Critical Findings:
1. **Weight Calibration Specificity:** Amritsar's weights were calibrated to resolve 13 verified inundation hotspots (SSSS Chowk, Hall Gate, GT Road) where masonry underpasses and walled-city impervious density dominate. Transferring them to Jalandhar without localized incident fitting is an operational heuristic, not an empirically justified model.
2. **Rainfall Threshold Invariance:** The rainfall thresholds ($T_{1h} = 3.5\text{ mm}$, $T_{24h} = 64.5\text{ mm}$) represent regional Punjab synoptic monsoon climatology derived from 14 years of ERA5-Land reanalysis. While regional synoptic rainfall depth is comparable across Punjab, **local drainage conveyance capacity is not**. A 35 mm cloudburst in Amritsar (draining to Sakki Nullah) will produce different pluvial depth and duration than in Jalandhar (draining to Kala Sangha Nullah / Chitti Bein).
3. **Risk Matrix Non-Equivalence:** The classification matrix:
   $$\text{Risk}(RTI, S) \in \{\text{low}, \text{moderate}, \text{high}\}$$
   relies on calibrated band cutoffs. When 93.2% of a city's cells fall into the mid susceptibility band, the model loses the spatial resolution required to differentiate vulnerable neighborhoods from safe terrain.

---

## 5. Formal Readiness State Machine Rules

NEXSTORM enforces an explicit 6-state readiness progression. Entry and exit criteria are strictly defined:

```
[configuration_only]
       │
       ▼ (Valid boundary & regular metric grid generated)
[data_bootstrapped]
       │
       ▼ (Features extracted, non-synthetic scores [0, 1])
[model_generated]
       │
       ├────────────────────────────────────────┐
       ▼ (< 5 verified storms)                  ▼ (≥ 5 verified storms)
[evidence_insufficient] ────────────────> [evaluation_ready]
                                                │
                                                ▼ (Calibrated thresholds + operator consent)
                                          [pilot_eligible]
```

### Explicit State Entry Criteria:
1. **`configuration_only`**:
   - `city.config.json` conforms to Zod schema.
   - Canonical `configHash` matches SHA-256 over mathematical subset.
   - Bounding box is geographically valid.
2. **`data_bootstrapped`**:
   - `grid.geojson` exists as valid FeatureCollection.
   - All cell polygons are valid (`is_valid == true`), non-degenerate, and non-overlapping.
   - Projected CRS matches target UTM zone (scale error $< 0.1\%$).
3. **`model_generated`**:
   - `susceptibility.geojson` present with 1-to-1 matching cell IDs.
   - Scores $S \in [0.0, 1.0]$. All required feature columns present.
   - `quality_report.json` passes technical integrity with 0 fatal errors.
4. **`evidence_insufficient`**:
   - City lacks verified historical flood incident inventory OR has $< 5$ independent storm events in `incidents_inventory.json`.
   - **Operational Restriction:** Permitted for internal visualization and research. Live external alert delivery is strictly blocked.
5. **`evaluation_ready`**:
   - $\ge 5$ independent verified rainfall storm events in `incidents_inventory.json`.
   - Localized leave-one-out historical evaluation completed.
   - Empirical POD and sensitivity documented.
6. **`pilot_eligible`**:
   - City has achieved `evaluation_ready`.
   - Municipal agency partnership established and localized thresholds validated.
   - Operator authorization granted (`operationalStatus.alertsAllowed: true`).
   - Default rollout mode set to `evaluation_only`.

---

## 6. Recommendations for Secondary Cities

1. **Never Present Scores as Physical Probabilities:** UI and API responses for secondary cities must explicitly label susceptibility as "Relative Terrain Susceptibility Index (Uncalibrated)", not "Flood Probability".
2. **Incorporate Local DEM & OSM Vectors:** Transition Jalandhar from analytic coordinate proxies to physical Copernicus DEM raster tiles and OSM Overpass road vectors to eliminate flatness and low-point skewness.
3. **Preserve Amritsar as Baseline:** Maintain Amritsar's validated models and historical evidence as the permanent regression benchmark.
