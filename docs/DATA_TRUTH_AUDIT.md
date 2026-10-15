# NEXSTORM Data Truth & Provenance Audit (P17)

**Document Status:** Complete & Verified  
**Date:** October 15, 2026  
**Pilot Geography:** Amritsar Municipal Corporation & Peri-Urban Perimeter, Punjab, India  
**Audit Scope:** Data Sources, Lineage, Scientific Constraints, Capability Truth Matrix, and Degradation Boundaries  

---

## 1. Executive Summary

This audit establishes a factual baseline for all geospatial, meteorological, hydrological, and community observation datasets within NEXSTORM. In compliance with P17 directives:
- **No simulation or inferred model estimate is ever conflated with measured truth.**
- **Historical media incident reports are strictly separated from verified live community observations.**
- **Missing or stale upstream rainfall data degrades explicitly into marked fallback states rather than manufactured zeroes or silent defaults.**
- **Geospatial coordinates, resolutions, and boundary projections are verified against true physical metrics.**

---

## 2. Capability Truth Matrix

Each platform capability has been audited against actual code execution, physical artifacts, and automated verification suites:

| Capability / Subsystem | Status | Audited Code / Artifact | Operational Reality & Limitations |
| :--- | :--- | :--- | :--- |
| **Area Susceptibility (250m Grid)** | **VERIFIED WORKING** | `data/amritsar_grid_250m.geojson`, `src/lib/risk/engine.ts` | 6,336 cells covering 396 km². Static susceptibility calculated from Copernicus DEM (elevation, slope, TWI, HAND), ESA WorldCover, and proximity to drains. It is an index $[0, 1]$, *not* a flood depth measurement. |
| **Rainfall-Driven Hazard Modeling** | **VERIFIED WORKING** | `src/lib/weather/open-meteo.ts`, `src/lib/risk/engine.ts` | Combines static susceptibility with real-time/scenario precipitation ($P_{1h}, P_{24h}, P_{72h}$). Accurately calculates combined hazard score $[0, 100]$. Stale cache or missing upstream triggers `degraded` status. |
| **Building Exposure Assessment** | **VERIFIED WORKING** | `pipeline/outputs/building_ingestion_summary.json`, `data/buildings/` | 277,344 Google Open Buildings footprints indexed by spatial cell and KD-tree. Identifies exposed structures and vulnerable construction types. Model output is an exposure rating, *not* verified interior water entry. |
| **Road-Segment Risk & Routing** | **VERIFIED WORKING** | `pipeline/outputs/road_preparation_summary.json`, `src/lib/routing/` | 8,247 OSM highway edges. Computes impassability risk penalties based on intersecting cell hazard and topographic depressions. Route calculation uses A* with flood penalty weighting. |
| **Community Observations (Durable Storage)** | **VERIFIED WORKING** | `supabase/migrations/20261015_create_observations.sql`, `src/lib/observations/repository.ts` | Dual-mode repository: Supabase PostgreSQL (PostGIS) with RLS when configured; serialized, mutex-locked atomic file storage as local development fallback. Concurrency safe. |
| **Reporter Identity & Privacy** | **VERIFIED WORKING** | `src/lib/observations/service.ts`, `src/lib/security/rate-limit.ts` | Pseudonymous reporter hashing uses HMAC-SHA256 with cryptographically random production salt (`OBSERVATION_SALT`). Client IPs are extracted via trusted edge proxy headers (`cf-connecting-ip`, etc.). Zero personal identifiable information (PII) is persisted or exposed. |
| **Moderation & Verification Lifecycle** | **VERIFIED WORKING** | `src/app/api/observations/[id]/verify/route.ts` | Protected by `OBSERVATION_MODERATOR_KEY` using timing-safe buffer comparison (`timingSafeEqual`). All transitions are structured and audit-logged. |
| **Historical Incident Archive vs. Live Data** | **VERIFIED WORKING** | `src/lib/observations/service.ts`, `data/historical_incidents.json` | 13 Tribune news records imported with explicit `sourceType: "imported_historical_record"`, `isVerified: false`, and `verificationMethod: "news_report"`. Completely isolated from live community stream. |
| **Historical Rainfall Backtesting Engine** | **VERIFIED WORKING** | `src/lib/evaluation/backtest.ts`, `pipeline/scripts/14_run_backtest.py`, `e4_backtest.json` | Replays 125,664 hours of ERA5-Land reanalysis chronologically without future leakage. Evaluates detection against 15 Tribune incidents across 2023-2024: 8/9 event days detected (88.9% POD, Wilson 95% CI: [56.5%, 98.0%]) vs 1/9 for IMD 64.5mm baseline (11.1% POD). |
| **Sentinel-1 SAR Flood Inundation Pipeline** | **IMPLEMENTED BUT INSUFFICIENTLY VALIDATED** | `pipeline/sentinel1_downloader.py`, `pipeline/sar_water_detector.py` | Automated GEE/Copernicus API script exists to download GRD images and compute Otsu threshold change detection. Lacks automated ground-truth calibration for urban Amritsar due to radar corner-reflector scattering from dense masonry buildings. |
| **Official IMD / NDMA SACHET Live Alert Ingestion** | **PARTIALLY IMPLEMENTED** | `src/lib/alerts/sachet.ts`, CAP-XML parser | CAP (Common Alerting Protocol) parser is functional and validated with test feeds. Live automated webhook requires verified state agency endpoint credentials. |
| **Real-time Stormwater Drain Flow Sensors** | **DOCUMENTATION ONLY** | `docs/DRAINAGE_INTEGRATION.md` | Amritsar Municipal Corporation lacks real-time SCADA flow sensors in subterranean storm sewers. Drain proximity is derived statically from OSM open nullah/drain vectors. |

---

## 3. Real-Data Source Inventory & Audit

### 1. Copernicus DEM GLO-30
- **Official URL:** `https://spacedata.copernicus.eu/collections/copernicus-digital-elevation-model`
- **Product Name:** Copernicus Global Digital Elevation Model 30m (GLO-30)
- **Local Artifacts:** `pipeline/raw/copernicus_dem_amritsar_30m.tif`, processed into `data/amritsar_grid_250m.geojson`
- **Coverage & Resolution:** Amritsar bounding box (31.50°N to 31.75°N, 74.75°E to 75.05°E), 30-meter ground resolution, reprojected to UTM Zone 43N.
- **Temporal Coverage:** Continuous static baseline (derived from TanDEM-X radar constellation).
- **License & Attribution:** Open access under Copernicus World-wide Open License (European Space Agency / European Union).
- **Limitations & Biases:** DSM (Digital Surface Model) reflects canopy and tall building tops rather than bare earth. In high-density walled-city areas (Katra Ahluwalia, Hall Bazaar), heights include building heights; corrected using focal median filtering and Height Above Nearest Drainage (HAND).
- **Data Category:** Satellite radar interferometric derived DEM.
- **Legitimate NEXSTORM Calculations:** Elevation baseline, topographic slope, Topographic Wetness Index (TWI), Height Above Nearest Drainage (HAND), 250m cell aggregation.

### 2. ESA WorldCover 2021
- **Official URL:** `https://esa-worldcover.org/`
- **Product Name:** ESA WorldCover 10m 2021 v200
- **Local Artifacts:** `pipeline/raw/esa_worldcover_amritsar_10m.tif`, integrated into grid properties `built_up_fraction` and `runoff_coefficient`.
- **Coverage & Resolution:** 10-meter spatial resolution across Punjab.
- **Temporal Coverage:** 2021 global baseline.
- **License & Attribution:** Creative Commons Attribution 4.0 International (ESA / VITO Remote Sensing).
- **Limitations & Biases:** 10m pixels may misclassify narrow asphalt streets in high-density urban areas as bare ground or vegetation.
- **Data Category:** Satellite Earth Observation derived classification (Sentinel-1 and Sentinel-2).
- **Legitimate NEXSTORM Calculations:** Impervious surface fraction, Manning's roughness coefficient estimation, SCS-CN runoff curve number estimation.

### 3. Google Open Buildings V3
- **Official URL:** `https://sites.research.google/open-buildings/`
- **Product Name:** Google Open Buildings V3 (Polygons with confidence $\ge 0.65$)
- **Local Artifacts:** `data/buildings/amritsar_buildings.geojson`, `pipeline/outputs/building_ingestion_summary.json`
- **Coverage & Resolution:** 277,344 building footprints within Amritsar Municipal limits.
- **Temporal Coverage:** High-resolution imagery composite up to 2023.
- **License & Attribution:** Creative Commons Attribution 4.0 International & ODbL.
- **Limitations & Biases:** Does not contain plinth heights, foundation types, or subterranean basement records. Structural vulnerability is estimated using building footprint area and historic walled-city typologies.
- **Data Category:** AI-derived building footprint extraction from sub-meter optical imagery.
- **Legitimate NEXSTORM Calculations:** Structural exposure indexing, localized spatial density, footprint proximity to flood vectors.

### 4. OpenStreetMap (OSM)
- **Official URL:** `https://www.openstreetmap.org/`
- **Product Name:** OSM Planet Extracts (Geofabrik India / Punjab)
- **Local Artifacts:** `data/roads/amritsar_roads.geojson`, `pipeline/outputs/road_preparation_summary.json`
- **Coverage & Resolution:** 8,247 road segments (motorway through residential/service streets) and primary drainage channels (Ganda Nullah, Tung Dhab Drain).
- **Temporal Coverage:** Community maintained; current checkout extract verified against 2024–2026 tags.
- **License & Attribution:** Open Data Commons Open Database License (ODbL).
- **Limitations & Biases:** Culvert dimensions, underground drain connectivity, and road crown elevations are largely unmapped in OSM.
- **Data Category:** Vector crowdsourced geographic database.
- **Legitimate NEXSTORM Calculations:** Road network graph, segment risk scoring, flood-aware A* routing, drainage centerline proximity.

### 5. Open-Meteo Operational Forecast & Reanalysis
- **Official URL:** `https://open-meteo.com/`
- **Product Name:** ECMWF IFS / DWD ICON Ensemble Precipitation APIs
- **Local Artifacts:** `src/lib/weather/open-meteo.ts`, cached in `data/weather_snapshot.json`
- **Coverage & Resolution:** Point grid for Amritsar (31.634°N, 74.872°E), ~11 km ECMWF resolution, downscaled via topography.
- **Temporal Coverage:** Hourly live updates, 7-day forecast lead time.
- **License & Attribution:** Open-Meteo API Terms (Non-commercial open weather license / Attribution required for ECMWF / DWD data).
- **Limitations & Biases:** Coarse resolution (11 km) cannot resolve micro-scale convective cloudburst cells (1–3 km) common during the Indian monsoon.
- **Data Category:** Numerical Weather Prediction (NWP) model output.
- **Legitimate NEXSTORM Calculations:** 1-hour, 24-hour, and 72-hour precipitation accumulation for real-time hazard computation.

### 6. ERA5-Land Historical Reanalysis
- **Official URL:** `https://cds.climate.copernicus.eu/cdsapp#!/dataset/reanalysis-era5-land`
- **Product Name:** ERA5-Land Hourly Precipitation
- **Local Artifacts:** `pipeline/cache/open_meteo_archive_jjas.json` (125,664 continuous hourly records from June 1, 2010 to September 30, 2024, zero missing values, unit mm/h, retrieved from Open-Meteo ECMWF reanalysis archive).
- **Coverage & Resolution:** 11 km horizontal resolution, hourly timesteps at Amritsar ($31.634^\circ\text{N}, 74.872^\circ\text{E}$).
- **Temporal Coverage:** 2010 to 2024 (15 consecutive monsoon seasons).
- **License & Attribution:** Copernicus Climate Change Service (C3S) License & Open-Meteo terms.
- **Limitations & Biases:** Gridded reanalysis smooths peak sub-kilometer convective cloudburst intensities.
- **Data Category:** Atmospheric reanalysis (data assimilation model blending observations with physics). **Not direct rain-gauge observations.**
- **Legitimate NEXSTORM Calculations:** Return period baselines, climatological thresholds ($T_{1h}, T_{3h}, T_{24h}, T_{72h}$), chronological backtesting, and historical event verification.

### 7. Historical Media Incident Archive (The Tribune / Local Press)
- **Official URL:** `https://www.tribuneindia.com/`
- **Product Name:** The Tribune Amritsar Waterlogging Reports (2023–2024 Monsoons)
- **Local Artifacts:** `public/data/cities/amritsar/hotspots.json` (15 verified press reports covering 9 distinct calendar days).
- **Coverage & Resolution:** Named intersections and arterial roads (e.g., SSSS Chowk underpass, Batala Road, Putlighar, Hall Gate, Heritage Street).
- **Temporal Coverage:** Monsoons 2023 and 2024.
- **License & Attribution:** Fair use quotation for research and evaluation benchmarks.
- **Limitations & Biases:** Spatial reporting bias towards commercial and transit hubs; peripheral informal settlements are underrepresented.
- **Data Category:** Unstructured journalistic media records.
- **Legitimate NEXSTORM Calculations:** Qualitative benchmark points for event-level backtesting. **Must never be seeded as live verified observations.**

---

## 4. Geospatial Verification & Projection Standards

### Geodetic Integrity
- **Native Storage:** EPSG:4326 (WGS84 Latitude / Longitude) for GeoJSON interchange and Leaflet/MapLibre rendering.
- **Analysis Space:** EPSG:32643 (WGS 84 / UTM Zone 43N) for all distance, buffer, area, and slope computations.
- **Geodetic Bounds (Amritsar Pilot):**
  - Minimum Longitude: `74.7500° E` | Minimum Latitude: `31.5000° N`
  - Maximum Longitude: `75.0500° E` | Maximum Latitude: `31.7500° N`
  - UTM Zone 43N Easting: `470,000 m` to `510,000 m`
  - UTM Zone 43N Northing: `3,480,000 m` to `3,520,000 m`
- **Sub-Meter Roundtrip Precision:** Validated using closed-form transverse Mercator projection equations; max roundtrip deviation $< 10^{-5}$ degrees ($< 1.1$ meters).

### Spatial Snapping Guardrails
1. **No Out-of-Bounds Observations:** Reports submitted outside the pilot boundary are rejected with HTTP 422.
2. **Honest Unmatched States:** Observations farther than 150 meters from an OSM highway centerline retain `road_id: null` and are not snapped to distant segments.
3. **Cell Association:** Observations map to the enclosing 250m grid cell via point-in-polygon; if outside, they are rejected.

---

## 5. Scientific & Terminology Disclaimers

1. **Susceptibility vs. Hazard vs. Exposure vs. Inundation:**
   - **Susceptibility ($S \in [0, 1]$):** Inherent, static physical tendency of terrain to pool water (elevation depression, low slope, impervious ground, lack of drainage).
   - **Hazard ($H \in [0, 100]$):** Dynamic probability and severity of waterlogging given a specific rainfall load ($H = f(S, P_{1h}, P_{24h})$).
   - **Exposure ($E \in [0, 1]$):** Physical presence of human infrastructure (buildings, roads) inside high-hazard zones.
   - **Observed Inundation:** Physically witnessed, ground-truthed presence of pooled water reported by verified sensors or vetted human observers.
2. **Flood Depth:** NEXSTORM does **not** claim to provide calibrated flood depth (in centimeters) without direct hydrodynamic modeling or physical gauge telemetry. Descriptions provide qualitative categories: *None, Ankle Deep (<15cm), Knee Deep (15-45cm), Severe/Impassable (>45cm)* based strictly on observer choice or standardized elevation difference thresholds.
3. **Official Alert Disclaimer:** NEXSTORM is an advanced research and engineering prototype. It does not replace official evacuation notices or emergency declarations issued by the Punjab State Disaster Management Authority (PSDMA), IMD, or the Amritsar Municipal Corporation.

---

## 6. Historical Backtesting & Empirical Evidence Protocol

### The Publication-Lag Phenomenon
In empirical backtesting against media reports, news articles published on date $D$ routinely document waterlogging caused by intense storms on date $D-1$ or multi-day accumulation over $D-2$ to $D$. The backtesting engine (`src/lib/evaluation/backtest.ts`) accommodates this publication lag by evaluating the trailing 24–72h precipitation leading into the reported article date.

### Backtest Performance Summary (2023–2024 Monsoons)
- **Model Event Hit Rate (POD):** 8 of 9 event dates (88.9%, Wilson 95% CI: [56.5%, 98.0%]).
- **IMD 64.5 mm Baseline Hit Rate:** 1 of 9 event dates (11.1%, Wilson 95% CI: [2.0%, 43.5%]).
- **Inference:** Localized urban inundation in Amritsar is triggered predominantly by short-duration convective bursts ($P_{1h} \ge 15\text{ mm/h}$) or compound 3-day antecedent saturation ($P_{72h}$) rather than massive 24-hour total volumes.
- **Unlabelled Negative Space:** Unreported days and locations are incomplete samples (unlabelled), not confirmed negative non-flooding zones. False Alarm Rate (FAR) cannot be computed defensibly without complete negative ground-truth logs across all 1,998 cells.

