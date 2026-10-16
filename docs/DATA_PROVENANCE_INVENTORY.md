# NEXSTORM Data Provenance & Risk Calculation Traceability (P26)

**Audit Status:** Complete & Verified  
**Date:** October 16, 2026  
**Auditor:** Antigravity Senior Verification Engine  
**Pilot Geographic Focus:** Amritsar Municipal Corporation (`amritsar`) & Jalandhar Municipal Corporation (`jalandhar`), Punjab, India  

---

## 1. Source Dataset Provenance Inventory

Every risk calculation, spatial intersection, and forecast presented in NEXSTORM traces back to genuine public, satellite, or governmental source datasets. Fabricated municipal telemetry, synthetic default coordinates, and simulated flood depths have been strictly audited and purged.

| Dataset Name | Source / Provider | URL / Identifier | Spatial Resolution / Extent | CRS / Units | License & Attribution | Runtime Usage & Role |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Copernicus DEM (GLO-30)** | European Space Agency / Copernicus | `https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model` | 30m cell resolution; resampled to 250m UTM grid | EPSG:32643 (UTM 43N); Elevation in meters AMSL | Copernicus Open Access License | Static Susceptibility ($S$): Elevation, slope, TWI, and HAND computation. |
| **ESA WorldCover 2021** | European Space Agency | `https://esa-worldcover.org/` | 10m land cover classification; resampled to 250m | EPSG:32643; Categorical classes (Built-up = 50, Bare/Cropland = 10-40, Water = 80) | CC-BY 4.0 | Static Susceptibility ($S$): Impervious surface and surface runoff factor weighting. |
| **Google Open Buildings (v3)** | Google Research | `https://sites.research.google/open-buildings/` | Building footprints with polygonal vertices and confidence $\ge 0.65$ | EPSG:4326 input; mapped to EPSG:32643 grid | CC-BY 4.0 | Building Exposure: 360,252 footprints in Amritsar intersecting 250m susceptibility cells. |
| **OpenStreetMap Road Network** | OpenStreetMap Contributors | `https://download.geofabrik.de/asia/india.html` | Road centerlines, tags (highway, tunnel, bridge), nodes | EPSG:4326 coordinates, length in meters | ODbL (Open Database License) | Road Risk & Routing: 14,853 segments, 26,155 graph nodes, 5 underpass physical depression zones. |
| **Open-Meteo Ensemble API** | Open-Meteo / ECMWF / NOAA | `https://open-meteo.com/en/docs/ensemble-api` | 50-member ECMWF IFS (0.25°) + 30-member GFS (0.25°) | Lat/Lon query; precipitation rate in mm/h | CC-BY 4.0 | Real-time & Forecast: Hourly precipitation ($P_{1h}, P_{24h}, P_{72h}$) driving dynamic RTI. |
| **Open-Meteo Historical Archive** | Copernicus Climate Change Service (ERA5) | `https://archive-api.open-meteo.com/v1/archive` | 11 km ERA5-Land hourly reanalysis | Lat/Lon query; hourly precipitation in mm | CC-BY 4.0 | Historical Replay & Evaluation: Replaying confirmed storm events chronologically. |
| **The Tribune News Archives (2023–2024)** | The Tribune India (Local Bureau) | `https://www.tribuneindia.com/` (MCA verified reports) | 13 geo-referenced news reports for Amritsar; 10 for Jalandhar | Latitude / Longitude coordinates | Editorial citation under Fair Dealing | Validation & Ground-Truth Calibration: Historical waterlogging incidents for backtesting. |
| **NDMA / IMD SACHET CAP Alerts** | National Disaster Management Authority (NDMA) | `https://sachet.ndma.gov.in/` | District-level CAP XML feeds | WGS84 bounding polygons; CAP v1.2 | Government of India Open Data | Early Warning Feeds: Official meteorological warning banner ingestion. |

---

## 2. Risk Calculation Traceability Matrix

Every risk value rendered across the application maps directly to an explicit mathematical formula, code module, and parameter set.

### 2.1 Static Cell Susceptibility ($S$)
- **Implementation Files:** `pipeline/scripts/03_susceptibility.py` (Amritsar), `pipeline/scripts/compute_jalandhar_physical_features.py` (Jalandhar), and `src/lib/risk/matrix.ts`
- **Spatial Grid:** 250m regular metric cell mesh (`EPSG:32643`). Amritsar = 1,998 cells; Jalandhar = 2,354 cells.
- **Audited Implemented Formula:**
  $$S = 0.30 \cdot f_{\text{depression}} + 0.10 \cdot f_{\text{flatness}} + 0.30 \cdot f_{\text{builtUp}} + 0.15 \cdot f_{\text{lowPoint}} + 0.15 \cdot f_{\text{density}}$$
- **Factor Definitions & Provenance:**
  - $f_{\text{depression}}$: Relative local relief depression rank within a 750m focal radius from Copernicus DEM GLO-30 (`rank(-local_depression_m)`). Lower terrain relative to surroundings receives higher rank.
  - $f_{\text{flatness}}$: Topographic flatness rank (`rank(flat_fraction)` where flat = slope $< 0.5^\circ$).
  - $f_{\text{builtUp}}$: Impervious surface fraction derived from ESA WorldCover 2021 Class 50 (Built-up) (and Google Open Buildings footprint density in Amritsar).
  - $f_{\text{lowPoint}}$: Discrete structural depression indicator: 1.0 if verified railway/highway underpass or cell depression $\le$ 12th percentile ($< -0.7\text{ m}$ relative relief), otherwise 0.0.
  - $f_{\text{density}}$: Drainage deficiency proxy based on road network length modulated by built-up fraction (`road_length_m / 62500 * (0.3 + 0.7 * builtup_fraction)`).
- **Susceptibility Band Classification:**
  - **Low:** $S < 0.33$
  - **Mid:** $0.33 \le S \le 0.66$
  - **High:** $S > 0.66$

### 2.2 Dynamic Runoff-Terrain Index ($\text{RTI}_t$) & 2D Decision Matrix
- **Implementation Files:** `src/lib/risk/rti.ts`, `src/lib/risk/matrix.ts`, and `src/lib/risk/engine.ts`
- **Audited Implemented Formula:**
  $$\text{RTI}(t) = \max\left(\frac{P_{1h}(t)}{T_{1h}}, \frac{P_{3h}(t)}{T_{3h}}, \frac{P_{24h}(t)}{T_{24h}}, \frac{P_{72h}(t) + A_{72h}}{T_{72h}}\right)$$
  where $A_{72h}$ is antecedent 72-hour rainfall, and thresholds are calibrated per city:
  - Amritsar: $T_{1h} = 35\text{ mm}$, $T_{3h} = 55\text{ mm}$, $T_{24h} = 90\text{ mm}$, $T_{72h} = 140\text{ mm}$
  - Jalandhar: $T_{1h} = 32\text{ mm}$, $T_{3h} = 50\text{ mm}$, $T_{24h} = 85\text{ mm}$, $T_{72h} = 130\text{ mm}$
- **Rainfall Intensity Bands:**
  - **None:** $\text{RTI} < 0.5$
  - **Elevated:** $0.5 \le \text{RTI} < 1.0$
  - **Severe:** $1.0 \le \text{RTI} < 1.5$
  - **Extreme:** $\text{RTI} \ge 1.5$
- **2D Decision Matrix ($S \times \text{RTI}$):**
  | SBand / RTIBand | `none` ($\text{RTI} < 0.5$) | `elevated` ($0.5 \le \text{RTI} < 1.0$) | `severe` ($1.0 \le \text{RTI} < 1.5$) | `extreme` ($\text{RTI} \ge 1.5$) |
  | :--- | :--- | :--- | :--- | :--- |
  | **`low`** ($S < 0.33$) | `low` | `low` | `low` | `moderate` |
  | **`mid`** ($0.33 \le S \le 0.66$) | `low` | `low` | `moderate` | `high` |
  | **`high`** ($S > 0.66$) | `low` | `moderate` | `high` | `high` |
- **Ensemble Decision Rule:** For ensemble forecasts, each member evaluates this matrix; the displayed risk class is determined by the exceedance probability threshold $\ge 0.35$ (`p.high >= 0.35 -> high`, else `p.moderate >= 0.35 -> moderate`, else `low`).

### 2.3 Road Segment Impassability Risk & Route Penalty
- **Implementation File:** `src/lib/roads/service.ts` (`evaluateSegmentRisk`, `evaluateCandidateRoutes`)
- **Segment Risk Elevation:**
  - Base modeled risk follows intersecting cell susceptibility: Low ($S < 0.33$), Moderate ($0.33 \le S \le 0.66$), High ($S > 0.66$).
  - Physical Underpass Vulnerability: If `isUnderpass: true`, minimum risk elevates to at least **Moderate**.
  - Verified Field Evidence: If linked to an active verified observation or verified flooded photo, risk immediately elevates to **High**.
- **Route Composite Penalty ($0-100$):**
  $$\text{Penalty} = \min\left(100, \text{round}\left(50 \cdot \frac{D_{\text{high}}}{D_{\text{total}}} + 25 \cdot \frac{D_{\text{mod}}}{D_{\text{total}}} + \min(30, 15 \cdot N_{\text{obs}}) + \min(20, 10 \cdot N_{\text{underpass}}) + \min(15, 15 \cdot \frac{D_{\text{unknown}}}{D_{\text{total}}}) + \min(30, 25 \cdot N_{\text{flooded\_photo}})\right)\right)$$

### 2.4 Building Structure Exposure
- **Implementation File:** `src/lib/buildings/service.ts` (`queryBuildings`, `loadCellIndex`)
- **Calculation:**
  - Spatially intersects Google Open Buildings footprints with 250m cells (Amritsar only; Jalandhar defaults to honest unavailable 404).
  - Exposure category maps directly from underlying cell susceptibility:
    - $S \ge 0.66 \implies$ `high_catchment`
    - $0.33 \le S < 0.66 \implies$ `moderate_catchment`
    - $S < 0.33 \implies$ `low_catchment`

---

## 3. Discovered Defects & Remediations

During this audit, six specific defects involving coordinate defaults, static single-city assumptions, and unverified narrative claims were identified and fixed:

| Subsystem / File | Pre-Audit Vulnerability | Remediation Applied | Verification Status |
| :--- | :--- | :--- | :--- |
| `src/lib/weather/ensemble.ts` | Defaulted missing query coordinates to Amritsar (`31.63, 74.87`). | Dynamically resolves `lat`, `lon`, and `timezone` from target city config via `getCityConfig(cityId)`. | **VERIFIED** via unit test querying Jalandhar (`31.33, 75.59`). |
| `src/lib/weather/historical.ts` | Used static `DEFAULT_LAT`/`DEFAULT_LON` (Amritsar) for historical reanalysis queries. | Added `resolveCityCoords(cityId, options)` querying target city bounding center. | **VERIFIED** via unit test intercepting API URL. |
| `src/lib/risk/engine.ts` | `computeTimeline` defaulted cell distribution to hardcoded Amritsar counts `{ low: 644, mid: 1198, high: 156, total: 1998 }`. | Dynamically reads target city susceptibility distribution via `getCitySusceptibility(config.id)`. | **VERIFIED** on Jalandhar 2,354-cell distribution. |
| `src/lib/roads/service.ts` | `getNetworkTopology` defaulted missing road graph node counts to Amritsar's `26,155`. | Updated to return `graph?.totalNodes ?? 0`. Keyed caches by `cityId` to prevent cross-city cache pollution. | **VERIFIED**: Jalandhar honestly returns 0 nodes; Amritsar returns 26,155. |
| `src/lib/buildings/service.ts` | `computePolygonCentroid` defaulted empty polygon rings to Amritsar coords `[74.872, 31.634]`. | Replaced with honest `{ lng: 0, lat: 0 }`. | **VERIFIED** via unit test. |
| `src/components/home/RoadMapCanvas.tsx` & `RoadsSection.tsx` | Claimed specific unverified flood depth (`~60cm storm inundation recorded`). | Replaced with honest qualitative language (`severe/impassable water accumulation reported`). | **VERIFIED** in UI components. |

---

## 4. Multi-City Data Quality & Pilot Readiness Matrix

| Pilot City | Target UTM CRS | Grid Cells (250m) | Building Footprints | Road Segments | Graph Nodes | Verified Storm Events | Readiness State | Operational Alerts Permitted |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Amritsar** (`amritsar`) | `EPSG:32643` | 1,998 | 360,252 (Google Open Buildings V3) | 14,853 | 26,155 (37,924 routing edges) | 7 historical storms (ERA5), 13 Tribune incidents | `evaluation_ready` | **YES** (Controlled evaluation mode) |
| **Jalandhar** (`jalandhar`) | `EPSG:32643` | 2,354 | Unavailable (0 structures; GOB V3 7.18 GB unindexed archive blocker) | 17,358 (OSM genuine vector) | 30,876 (93,031 routing edges, 13 underpasses, 821 corridors) | 5 historical storms (ERA5), 10 Tribune incidents | `evidence_insufficient` | **NO** (Strictly blocked by safety gates) |

---

## 5. Highest-Value Next Data Acquisition Tasks

1. **Jalandhar Google Open Buildings V3 Batch Extraction Procedure:**
   - Source: `https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/391_buildings.csv.gz` (7.18 GB uncompressed ~25 GB CSV).
   - Execution: Run offline pipeline on server with $\ge 32\text{ GB}$ RAM streaming polygon rows filtered by Jalandhar bounding box (`75.52 <= lng <= 75.66` and `31.28 <= lat <= 31.38`).
   - Output target: `pipeline/inputs/jalandhar/google_open_buildings_jalandhar.parquet`.
   - Pipeline script: Execute `python pipeline/scripts/09_prepare_buildings.py --city jalandhar` to generate `cell_index.json` and `hotspot_buildings.geojson`.
2. **Local Municipal Drain Network Alignment:** Replace idealized Euclidean drain buffer vectors with surveyed municipal open drain line vectors from MCA/MCJ master sanitation plans when made publicly accessible.
3. **Ground-Truth Rain Gauge Telemetry:** Connect municipal telemetry from Punjab Disaster Management Authority or local MCJ pumping stations to transition Jalandhar from `evidence_insufficient` to `evaluation_ready`.
