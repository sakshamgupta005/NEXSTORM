# Spatial Matching & Unified Risk Architecture

## 1. Architectural Scope & Problem Statement

NEXSTORM's long-term mission unites three equal pillars for urban waterlogging intelligence in Amritsar:
1. **Area Risk**: Macro-catchment static susceptibility and dynamic precipitation risk across 250m grid cells.
2. **Building Exposure**: Spatial intersection of building footprints with catchment hazard layers, strictly separating exposure from unprovable indoor vulnerability.
3. **Road Risk & Flood-Aware Routing**: Segment-level corridor hazard assessment, underpass identification, citizen observation matching, and candidate route risk exposure scoring.

The core engineering challenge is **spatial data integration**: mapping heterogeneous datasets (raster DEMs, vector polylines, polygonal cadastres, and point observations) to common geographic entities while preserving data provenance and communicating uncertainty.

---

## 2. Coordinate Reference Systems & Transformations

### 2.1 The Two-Tier CRS Standard
All spatial computations in NEXSTORM follow an explicit two-tier coordinate strategy:

```
┌────────────────────────────────────────────────────────┐
│ WGS84 (EPSG:4326)                                      │
│ • Unit: Decimal Degrees (Latitude, Longitude)          │
│ • Role: Storage, APIs, GeoJSON, Leaflet Map Rendering │
└──────────────────────────┬─────────────────────────────┘
                           │ Pure TypeScript Geodesy Engine
                           │ Forward / Inverse Transverse Mercator
                           ▼
┌────────────────────────────────────────────────────────┐
│ UTM Zone 43N (EPSG:32643)                              │
│ • Unit: Metric Meters (Easting, Northing)              │
│ • Role: Orthogonal Projection, Euclidean Distances,    │
│   Segment Snapping, Buffer Analysis                    │
└────────────────────────────────────────────────────────┘
```

### 2.2 Mathematical Implementation
The pure TypeScript geodetic engine in `src/lib/spatial/crs.ts` implements the Transverse Mercator projection based on the WGS84 reference ellipsoid ($a = 6378137.0\text{ m}, b = 6356752.3142\text{ m}, e^2 \approx 0.00669438$):
- **Central Meridian**: $\lambda_0 = 75.0^\circ\text{ E}$ (Amritsar lies between $74.75^\circ\text{ E}$ and $75.00^\circ\text{ E}$).
- **Scale Factor**: $k_0 = 0.9996$.
- **False Easting**: $500,000.0\text{ m}$.
- **False Northing**: $0.0\text{ m}$.

### 2.3 Empirical Geodetic Control Points
Validated against GDAL and Python `pyproj` (EPSG:32643):
- **Golden Temple (`31.6200° N, 74.8765° E`)**: Easting $488,284.97\text{ m}$, Northing $3,498,349.52\text{ m}$. Round-trip discrepancy $< 0.1\text{ mm}$.
- **GNDU Main Gate (`31.6370° N, 74.8270° E`)**: Easting $483,594.34\text{ m}$, Northing $3,500,248.72\text{ m}$. Round-trip discrepancy $< 0.1\text{ mm}$.
- **SSSS Chowk (`31.6480° N, 74.8780° E`)**: Easting $488,435.32\text{ m}$, Northing $3,501,452.92\text{ m}$. Round-trip discrepancy $< 0.1\text{ mm}$.

---

## 3. Spatial Matching Engine Mechanics

### 3.1 Deterministic Point-in-Polygon (PIP)
Implemented in `src/lib/spatial/point-in-polygon.ts`:
- **Algorithm**: Jordan curve theorem ray-casting algorithm.
- **Bounding Box Pre-Filtering**: Rejects exterior points in $\mathcal{O}(1)$ time before polyline evaluation.
- **Edge Tolerance**: Collinear boundary checks with numerical tolerance ($\epsilon = 10^{-9}$ degrees).
- **MultiPolygon Support**: Evaluates exterior shells and properly accounts for interior polygon holes.

### 3.2 Point-to-Grid Matching & Spatial Snapping
Implemented in `src/lib/spatial/grid-matcher.ts`:
1. **Grid Indexing**: Each grid cell (`A-XXXX` for Amritsar 250m, `G-XXXX` for GNDU 50m) provides a pre-computed bounding box and centroid in both WGS84 and UTM43N.
2. **Point Snapping**:
   - Primary: Ray-casting test returns `exact_inside` when the point falls inside the polygon boundary.
   - Centroid Proximity: Computes metric Euclidean distance to the cell centroid.
   - Out-of-Bounds Handling: If a point falls outside the municipal bounding polygon, it returns an explicit `unmatched` status with `cellId: null` rather than silently assigning it to the nearest cell.

### 3.3 Road Segment Matching & Orthogonal Projection
Implemented in `src/lib/spatial/road-matcher.ts`:
Given an observation point $P = (x_p, y_p)$ and a road polyline segment between $A = (x_a, y_a)$ and $B = (x_b, y_b)$ in UTM43N coordinates:
1. Vector $v = B - A$, vector $u = P - A$.
2. Segment length squared: $\|v\|^2 = \Delta x^2 + \Delta y^2$.
3. Projection parameter (fraction along segment):
   $$t = \frac{u \cdot v}{\|v\|^2} = \frac{(x_p - x_a)\Delta x + (y_p - y_a)\Delta y}{\Delta x^2 + \Delta y^2}$$
4. Clamping to finite segment: $t_{\text{clamped}} = \max(0, \min(1, t))$.
5. Nearest projected point: $P_{\text{proj}} = A + t_{\text{clamped}} \cdot v$.
6. Cross-track orthogonal distance: $d_{\perp} = \|P - P_{\text{proj}}\|$.

#### The Strict 30-Meter Snapping Guardrail
- If $d_{\perp} \le 30\text{ m}$: Match accepted with `matchQuality = 'projected_segment'`.
- If $d_{\perp} > 30\text{ m}$: Point is **strictly rejected** as `unmatched` with `unmatchedReason = 'beyond_snapping_tolerance'`. Arbitrary assignment to the nearest road is prohibited.

---

## 4. The Three Risk Products: Data Contracts & Scientific Boundaries

```
┌────────────────────────────────────────────────────────────────────────┐
│ UNIFIED RISK PRODUCT ARCHITECTURE                                      │
├─────────────────────┬──────────────────────────┬───────────────────────┤
│ 1. Area Risk        │ 2. Building Exposure     │ 3. Road Risk & Routes │
├─────────────────────┼──────────────────────────┼───────────────────────┤
│ • 250m Cell ID      │ • Building Footprint ID  │ • Road Segment ID     │
│ • Static Suscept.   │ • Intersecting Cell ID   │ • Intersecting Cells  │
│ • Dynamic RTI       │ • Footprint Area (m²)    │ • Length & Geometry   │
│ • 2D Risk Class     │ • Catchment Risk Class   │ • Underpass Alert     │
│ • Live Forecasts    │ • Centroid Coordinates   │ • Active Reports Count│
│ • Uncertainty Range │ • Strict Non-Depth Guard │ • Modeled Risk Class  │
└─────────────────────┴──────────────────────────┴───────────────────────┘
```

### 4.1 Product 1: Area-Level Risk Assessment
- **Unit of Analysis**: 250m regular grid cells ($62,500\text{ m}^2$).
- **Core Inputs**: Copernicus DEM GLO-30 terrain (slope flatness, sink depression depth), ESA WorldCover 2021 built-up density, and multi-window rainfall accumulations ($P_{1\text{h}}, P_{3\text{h}}, P_{24\text{h}}, P_{72\text{h}}$).
- **Core Outputs**: Continuous Susceptibility score $S \in [0, 1]$, Rainfall Trigger Index (RTI), and relative risk class (`low`, `moderate`, `high`).
- **Scientific Limitation**: Indicates macro-catchment ponding potential; cannot predict individual street curb overtopping or basement flooding.

### 4.2 Product 2: Building-Level Exposure Assessment
- **Unit of Analysis**: Discrete building footprint polygon (`AMR-BLD-XXXXXX`).
- **Core Inputs**: Building polygon geometry, centroid, footprint area, and intersecting 250m grid cell risk.
- **Contract Interface** (`BuildingExposureAssessment`):
  ```typescript
  export interface BuildingExposureAssessment {
    buildingId: string
    sourceDataset: 'osm_buildings' | 'google_open_buildings' | 'microsoft_footprints'
    centroid: Wgs84Coordinates
    footprintAreaM2: number
    intersectingCellId: string
    cellSusceptibility: number
    catchmentRiskClass: 'low' | 'moderate' | 'high'
    matchQuality: 'centroid_inside' | 'intersects' | 'unmatched'
    exposureCategory: 'minimal' | 'moderate_catchment' | 'high_catchment'
    scientificCaveat: string // Strictly disclaims indoor water depth or structural safety
    provenance: ProvenanceRecord
  }
  ```
- **Scientific Guardrails**:
  - **No Indoor Depth Claims**: NEXSTORM does not model door thresholds, plinth elevation, basement existence, or interior leakage.
  - **Separation of Concepts**:
    - **Hazard**: Rainfall accumulation and catchment ponding volume.
    - **Susceptibility**: Topographic sink and impervious land cover conditions.
    - **Exposure**: Spatial presence of a building in an elevated catchment.
    - **Vulnerability**: Physical structural weakness (NOT evaluated by NEXSTORM).

### 4.3 Product 3: Road-Level Risk Assessment & Routing
- **Unit of Analysis**: Road network centerline segment (`AMR-ROAD-XXXXXX`).
- **Core Inputs**: Polyline geometry, highway classification (trunk, primary, secondary, residential), intersecting grid cells, railway underpass tags, and fresh verified citizen reports.
- **Contract Interface** (`RoadSegmentRiskAssessment`):
  ```typescript
  export interface RoadSegmentRiskAssessment {
    segmentId: string
    roadName?: string
    highwayType: string
    lengthMeters: number
    intersectingCellIds: string[]
    maxCellSusceptibility: number
    isUnderpassOrDepression: boolean
    activeReportsCount: number
    modeledRiskClass: 'low' | 'moderate' | 'high'
    corridorStatus: 'passable_unverified' | 'caution_ponding_likely' | 'impassable_reported'
    scientificCaveat: string
    provenance: ProvenanceRecord
  }
  ```
- **Scientific Guardrails**:
  - High modeled risk does **not** mean the road is closed. A road is only marked `impassable_reported` when a verified or corroborated report exists.
  - Road risk represents corridor catchment exposure, not dynamic hydraulic flow depth.

---

## 5. Future Flood-Aware Routing Architecture

### 5.1 Route Risk Formulation & Penalty Costing
In a future routing phase, when an origin and destination are provided, candidate routes will be generated and evaluated using a multi-factor penalty cost function:

$$\text{Cost}(e) = L_e \cdot \left(1 + \alpha \cdot S_e + \beta \cdot H_e\right) + \gamma \cdot R_e + \delta \cdot U_e$$

Where:
- $L_e$: Metric length of segment $e$ (meters).
- $S_e$: Catchment susceptibility score ($\in [0, 1]$).
- $H_e$: Dynamic rainfall hazard score ($\in [0, 1]$).
- $R_e$: Active verified citizen report indicator ($\in \{0, 1\}$).
- $U_e$: Railway underpass / depression indicator ($\in \{0, 1\}$).
- $\alpha, \beta, \gamma, \delta$: Penalty tuning parameters.

### 5.2 Evaluated Routing Engines

```
┌────────────────────────────────────────────────────────┐
│ CANDIDATE ROUTING ENGINES COMPARISON                   │
├─────────────────────┬──────────────┬───────────────────┤
│ Engine              │ Performance  │ Flood Weighting   │
├─────────────────────┼──────────────┼───────────────────┤
│ Valhalla            │ High (C++)   │ Superior (Lua/C++ │
│                     │ Tile-based   │ dynamic costing)  │
├─────────────────────┼──────────────┼───────────────────┤
│ GraphHopper         │ High (Java)  │ Custom JSON model │
│                     │ Flexible     │ runtime weights   │
├─────────────────────┼──────────────┼───────────────────┤
│ OSRM (MLD Mode)     │ Ultra-fast   │ Dynamic speeds    │
│                     │ Low memory   │ via traffic CSV   │
└─────────────────────┴──────────────┴───────────────────┘
```

**Recommendation**: **Valhalla** or **GraphHopper Custom Model** are the best long-term engines for NEXSTORM because they allow passing custom edge penalty factors at query time without rebuilding graph contraction hierarchies.

### 5.3 Route Evaluation Output Contract
Implemented in `src/lib/spatial/contracts.ts`:
- **Total Route Distance & Duration**: Physical route metrics.
- **Exposure Breakdown**: High-risk distance, moderate-risk distance, underpass count, and active incident count.
- **Composite Risk Score ($0\text{ to }100$)**: Normalized risk penalty index.
- **Routing Recommendation**: `standard_advisory`, `caution_moderate_exposure`, or `warning_high_waterlogging_risk`.
- **Mandatory Routing Disclaimer**:
  > *"Experimental flood-aware route comparison. NEXSTORM does not provide live turn-by-turn navigation or guarantee road passability. Always obey municipal advisories, traffic police directives, and visible water depth on roadways."*

---

## 6. Evidence, Provenance & Uncertainty Contracts

Every spatial result across all three products must carry complete provenance:
1. **Modality**: `modeled` (computational simulation) vs. `observed` (physical measurement / news / citizen report).
2. **Match Quality**: `exact_inside`, `boundary_touch`, `centroid_inside`, `intersects`, `projected_segment`, `buffer_proximity`, or `unmatched`.
3. **Verification Status**: `unverified`, `corroborated`, `verified`, or `rejected`.
4. **Imputation Flags**: Whether missing values were imputed (e.g., 0mm weather fallback).
5. **Timestamp & Versioning**: Canonical SHA-256 hash of configuration and retrieval epoch.

---

## 7. Phased Implementation Roadmap

| Phase | Focus Area | Status | Deliverables |
| :--- | :--- | :--- | :--- |
| **P8** | **Data Foundation & Spatial Architecture** | **Complete** | Geodetic CRS engine, PIP, grid snapping, road segment projection, 3-product data contracts, dataset feasibility audit. |
| **P9** | **Scalable External Data Ingestion** | Ready for execution | Ingest Google Open Buildings V3 GeoPackage for Amritsar; build routable road graph with underpass tagging via Valhalla/OSRM. |
| **P10** | **Unified Risk Console & Flood-Aware Routing** | Future | Multi-layer map toggle (Area / Building / Road), building risk inspector sheet, flood-aware route comparison UI. |
