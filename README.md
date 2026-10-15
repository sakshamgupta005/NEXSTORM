# NEXSTORM — Urban Waterlogging & Heavy-Rainfall Early-Warning System

> **DISCLAIMER**: Experimental research prototype. Not an official weather forecast or emergency warning. For official alerts see IMD and NDMA SACHET. NEXSTORM does not predict flood depth in centimeters, provide verified street-level forecasts, model underground storm sewer hydraulics, or predict riverine flooding.

**Hackathon**: BuildFest 2.0  
**Problem Statement**: PS-18 — AI-Powered Heavy-Rainfall Forecasting and Urban Waterlogging Early-Warning System for Indian Cities  
**Pilot City**: Amritsar, Punjab, India ($31.634^\circ\text{ N}, 74.872^\circ\text{ E}$)  
**Secondary Subgrid**: Guru Nanak Dev University (GNDU) Campus  
**Repository**: [https://github.com/sakshamgupta005/NEXSTORM](https://github.com/sakshamgupta005/NEXSTORM)  

---

## 1. Executive Summary & Capabilities

NEXSTORM is an experimental, deterministic environmental-intelligence and geospatial decision-support platform designed for urban climate resilience. Developed specifically for Amritsar, Punjab, NEXSTORM bridges numerical weather forecasting, satellite terrain elevation models, massive building footprint datasets, and topological road networks into a unified, explainable 3-pillar intelligence system.

```
                                  PROJECT NEXSTORM
                     Scientific Urban Waterlogging Intelligence
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
   PILLAR A: AREA                  PILLAR B: BUILDINGS              PILLAR C: ROADS
   Macro Susceptibility            Structure Footprints             Corridor Inundation
   & Rainfall Risk                 & Catchment Exposure             & Flood-Aware Routing
   ────────────────────            ────────────────────             ─────────────────────
   • 1,998 Amritsar 250m cells     • 360,252 Google Open            • 14,855 road segments
   • 699 GNDU subgrid cells          Buildings V3 footprints        • 28,418 graph nodes
   • Copernicus 30m DEM sinks      • Metric areas in UTM 43N        • 37,924 routing edges
   • Dynamic RTI Rainfall Trigger  • Area-weighted multi-cell       • Underpass sink identification
   • Live ECMWF/GFS ensemble         catchment exposure               (e.g., Rego Bridge sump)
   • Historical monsoon replay     • Centroid & bounds queries      • A* flood-aware pathfinding
   • Scenario hyetograph test      • Interactive structure dossier  • Exposure penalty comparison
        │                                │                                │
        └────────────────────────────────┴────────────────────────────────┘
                                         │
                                         ▼
                     GROUND-TRUTH & COMMUNITY EVIDENCE LAYER
                     ───────────────────────────────────────
                     • Citizen waterlogging reports with boundary enforcement
                     • Privacy-preserving reporter IP/session salt-hashing
                     • Temporal decay & spatial corroboration clustering
                     • Administrative audit & verification workflow
```

---

## 2. Core Pillars Detailed

### Pillar A: Area-Level Susceptibility & Rainfall Risk
- **Static Susceptibility ($S \in [0, 1]$)**: Multi-criteria geospatial factor weights capturing built-up density (ESA WorldCover 10m), building fabric pressure (OSM), terrain depression depth, and slope flatness (Copernicus DEM GLO-30).
- **Dynamic Rainfall Trigger Index (RTI)**: Multi-window trailing precipitation accumulations normalized against 15-year monsoon climatology thresholds:
  $$\text{RTI} = \max\left(\frac{P_{1\text{h}}}{T_{1\text{h}}}, \frac{P_{3\text{h}}}{T_{3\text{h}}}, \frac{P_{24\text{h}}}{64.5}, \frac{P_{72\text{h}} + \text{antecedent}_{72\text{h}}}{T_{72\text{h}}}\right)$$
- **2D Classification Matrix**: Continuous RTI and susceptibility are mapped into intensity bands (`none`, `elevated`, `severe`, `extreme` $\times$ `low`, `mid`, `high`) to produce relative risk classes: **`low`**, **`moderate`**, and **`high`**.
- **Three Operational Modes**:
  1. `live`: Open-Meteo ensemble forecast (ECMWF, GFS) updated every 6 hours with automated snapshot caching.
  2. `replay`: 72-hour verified historical monsoon replay (`2025-09-01_amritsar.json`).
  3. `scenario`: Synthetic hyetograph simulator with customizable peak rainfall intensity ($0–80\text{ mm/h}$) and storm duration.

### Pillar B: Building-Level Exposure Assessment
- **360,252 Building Footprints**: Ingested from Google Open Buildings V3 with polygons, centroid coordinates, and metric footprint areas ($m^2$) projected in UTM Zone 43N.
- **Multi-Cell Spatial Intersection**: Each structure is spatial-joined against the 250m susceptibility grid and Copernicus 30m DEM depression sinks.
- **Interactive Dossiers**: Provides building-level catchment susceptibility ($s \in [0, 1]$), elevation above sea level, and localized topographic depression warnings without making false indoor inundation claims.

### Pillar C: Road-Segment Risk & Flood-Aware Routing
- **14,855 Road Segments & 28,418 Graph Nodes**: Ingested from OpenStreetMap highway networks, topologically noded with 37,924 routing edges.
- **Underpass Chokepoints**: Identifies known historical topographic sump traps (e.g., Rego Bridge railway underpass bowl) where surface runoff converges.
- **A* Flood-Aware Routing Engine**: Compares alternative origin-to-destination corridors between key transit hubs (e.g., Amritsar Railway Station to Sri Guru Ram Dass Jee International Airport), evaluating distance, baseline travel time, and modeled exposure penalty scores.

### Ground-Truth Observations & Community Evidence
- **Citizen Reporting Dialog**: Allows submitting real-world observations (`street_flooding`, `underpass_submersion`, `drain_overflow`, `ponding`, `receding_water`) with depth severity ratings.
- **Spatial Boundary Validation**: Enforces WGS84 pilot boundaries ($\text{Lat: } 31.50^\circ–31.80^\circ\text{ N}, \text{Lng: } 74.70^\circ–75.05^\circ\text{ E}$).
- **Evidence Integrity**: Submissions are marked as `submitted` and only elevate risk calculations when corroborated by independent reports or field moderator verification.

---

## 3. Technology Stack & Architecture

- **Frontend & App Framework**: Next.js 16.4 (App Router, Turbopack), React 19, TypeScript (strict mode).
- **Design System & Styling**: Custom token architecture in `src/styles/reference.css` and `src/app/globals.css`, Tailwind CSS v4, Lucide React icons.
- **Mapping & Basemaps**: Leaflet.js with clean, reliable OpenStreetMap standard tiles (zero watermarks, zero API key dependencies).
- **Hydrological Engine**: TypeScript in-memory risk matrix engine ($<40\text{ ms}$ for 51 members $\times$ 2,500 cells $\times$ 48 hours).
- **Data Pipeline**: Python 3.11 (`pipeline/`) using GeoPandas, Shapely, Rasterio, SciPy.
- **Validation & Integrity**: Zod schemas on all API boundaries; canonical SHA-256 frozen configuration verification (`74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49`).
- **Testing**: Vitest (94 test suites, 895 passing tests), Playwright (E2E browser smoke tests), and Pytest (38 geospatial pipeline tests).

---

## 4. Completed Engineering Stages

| Stage Tag | Status | Deliverables |
|---|---|---|
| `p0-clean` | **Done** | Template audit, removed unrelated speech/camera/payments toolkits |
| `p1-core` | **Done** | Core RTI calculations, scenario simulator, Amritsar interactive map prototype |
| `p2-adapters`| **Done** | Open-Meteo forecast adapters, multi-model ensemble fallbacks, NDMA Sachet feeds, snapshot cache |
| `p3-data` | **Done** | Offline Python pipeline, 1,998 real Amritsar cells, 699 GNDU campus cells |
| `p4b-eval` | **Done** | E1–E3 evaluation framework, 72h historical replay (`2025-09-01_amritsar.json`), 46 cross-language test vectors |
| `p5-risk` | **Done** | Real risk engine, cell factor explanations (`/api/cell/[cellId]`), contingency metrics, and `/api/evaluation` API |
| `p6-console` | **Done** | City console view, interactive risk map, NDMA alerts feed, Punjab overview |
| `p7-validation` | **Done** | Scientific validation, risk calibration, temporal holdouts, data reliability safeguards |
| `p8-spatial` | **Done** | Amritsar data foundation audit, geodetic CRS engine, spatial matching, unified 3-pillar contracts |
| `p9-ingest` | **Done** | Ingested 360,252 Google Open Buildings V3 footprints, metric areas in UTM 43N, road network foundation |
| `p10-observations` | **Done** | Ground-truth observations & community reporting evidence layer, corroboration clustering, moderation |
| `p11-roads` | **Done** | Amritsar road-segment risk assessment, multi-cell spatial intersections, underpass chokepoint tags |
| `p12-buildings` | **Done** | Building-level exposure assessment, multi-cell footprint intersections, area-weighted susceptibility, viewport API |
| `p13-routing` | **Done** | Flood-aware origin-to-destination routing, A* pathfinding on 28,418 nodes and 37,924 edges, route comparison |
| `p14-trust` | **Done** | Evidence quality & provenance audit, moderator token hardening, reporter privacy salt-hashing |
| `p15-final` | **Done** | System integration, lazy-loading payload optimization (-8.87 MB), verified demo readiness |
| `p16-polish` | **Done** | Complete frontend visual polish & design-system overhaul, clean tokens, watermark-free OSM tiles, WCAG AA typography & contrast, responsive validation (Desktop, Tablet, Mobile) |

---

## 5. How to Launch Everything Perfectly

### Prerequisites
- **Node.js**: `v20.x` or higher (tested on Node 22 & 24)
- **npm**: `v10.x` or higher
- **Git**
- *(Optional)* **Python**: `3.11+` with virtualenv (only needed if re-generating raw DEM tiles or spatial indices from scratch)

### Step 1: Clone the Repository
```bash
git clone https://github.com/sakshamgupta005/NEXSTORM.git
cd NEXSTORM
```

### Step 2: Environment Configuration
NEXSTORM runs completely out of the box with safe zero-config defaults (utilizing local cached snapshots and public Open-Meteo endpoints). To configure custom ports or Supabase authentication:

```bash
# Copy the example environment file
cp .env.example .env.local
```

Key variables in `.env.local`:
```env
# Optional: Site base URL
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional: Supabase Auth (if using cloud persistence)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Launch Development Server
```bash
npm run dev
```
The server will boot with Next.js Turbopack in ~1 second.

### Step 5: Access the Key URLs
Open your browser to:
- **Main Platform Landing & 3-Pillar Experience**: [http://localhost:3000](http://localhost:3000)
  - **Overview**: Hero, hyetograph scenario simulator, and system architecture.
  - **Buildings**: Interactive building exposure map, hotspot selectors, and structure dossiers.
  - **Roads**: Dynamic road routing, Route A (Bypass) vs Route B (Rego Underpass) flood exposure comparison.
  - **About**: 6-stage scientific processing pipeline and technology provenance.
  - **Live Diagnostics Modal**: Click `Live Pipeline Status` in the navbar or query `/api/health`.
  - **Community Reporting Modal**: Click `Report Waterlogging` in the navbar.
- **City Console Grid View**: [http://localhost:3000/city/amritsar](http://localhost:3000/city/amritsar) (250m cell inspector, NDMA SACHET alert feed, and factor contributions).

### Step 6: Production Build & Deployment Preview
To verify production optimization and server-side rendering:
```bash
# 1. Build the production bundle
npm run build

# 2. Launch production server
npm run start
```

---

## 6. Verification & Automated Test Commands

Run the full testing and quality audit suite:

```bash
# 1. TypeScript Strict Typecheck (zero errors)
npm run typecheck

# 2. ESLint Code Quality (zero errors, zero warnings)
npm run lint

# 3. Vitest Unit, Component, and Integration Tests (94 test suites, 895 tests)
npm test

# 4. Next.js Production Build Verification (compiles all 27 routes)
npm run build

# 5. Playwright E2E Browser Smoke Tests
npm run test:e2e

# 6. (Optional) Python Geospatial Pipeline Test Suite (38 tests)
.venv\Scripts\python.exe -m pytest pipeline/tests/ -v
```

---

## 7. API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/risk?cityId=amritsar&mode=live` | `GET` | Evaluates real-time risk grid and timeline from live ensemble weather forecasts. |
| `/api/risk?cityId=amritsar&mode=replay&event=2025-09-01_amritsar&t=1` | `GET` | Evaluates 72-hour historical monsoon event replay with verified golden outputs. |
| `/api/risk?cityId=amritsar&mode=scenario&peakMm1h=40&durationH=4` | `GET` | Evaluates synthetic triangular hyetograph scenario over verified susceptibility grid. |
| `/api/cell/[cellId]?cityId=amritsar` | `GET` | Returns cell factor contributions, terrain override note, nearest historical hotspot ($\le 500\text{ m}$), and scientific limitations. |
| `/api/buildings?cityId=amritsar` | `GET` | Viewport-bounded building footprint query with metric areas and multi-cell susceptibility. |
| `/api/roads/risk?cityId=amritsar` | `GET` | Road segment risk query with bounding box, highway classification, and underpass filters. |
| `/api/roads/route-compare` | `POST` | Multi-candidate route flood exposure evaluation and safety ranking. |
| `/api/roads/plan` | `GET`, `POST` | Origin-to-destination flood-aware route planning with A* pathfinding and candidate comparison. |
| `/api/observations?cityId=amritsar` | `GET`, `POST` | Query filtered observations or submit a community report with rate-limiting and spatial snapping. |
| `/api/official-alerts?state=Punjab` | `GET` | Normalized NDMA SACHET CAP alert feed for official flood/weather advisories. |
| `/api/evaluation?cityId=amritsar` | `GET` | Serves offline pipeline evaluation summary verified against frozen configuration hash. |
| `/api/health` | `GET` | Operational health probe with system memory, uptime, and cache statuses. |

---

## 8. Permanent Governance & Safety Guardrails

- **Mandatory Permanent Disclaimer**: Prominently displayed across all application headers, modals, and API payloads:
  > *"RESEARCH PROTOTYPE — DEMO DATA: NEXSTORM provides experimental relative waterlogging risk estimates based on simulated rainfall and synthetic placeholder susceptibility data. It does NOT provide verified street-level flood predictions, measured observations, or official emergency warnings. Consult IMD, NDMA, and local municipal disaster authorities for official emergency advisories."*
- **Restricted Vocabulary**: User-facing interfaces strictly avoid panic and emergency words (*Emergency, Evacuate, Evacuation, Danger, Safe, Unsafe*). Allowed advisory tiers are restricted to **Watch** and **Warning**, with route recommendations framed as **caution**, **avoid**, or **lower_exposure**.
- **No Hallucinated Data**: Upstream weather disconnects trigger cached snapshot fallbacks (`kind: "cached"`) or explicit HTTP 503 degraded states. Zero synthetic rainfall is fabricated.
- **Truthful Confidence**: Single deterministic weather runs explicitly return `confidence: "unavailable"` rather than inventing synthetic ensemble spreads.

---

## 9. Verified Known Limitations

1. **Surface Susceptibility vs Underground Hydraulics**: Static susceptibility captures macro-topographic pooling potential; it does not simulate storm sewer pipe diameters, catch-basin clogging, or pump discharge rates.
2. **Road Network Restrictions**: Road graph edges in `road_graph.json` are bidirectional due to OpenStreetMap GeoPackage limitations; lane-level one-way restrictions and turn bans are unmodeled.
3. **Routing Velocities**: Candidate route travel times are estimated using a fixed 30 km/h baseline velocity without dynamic real-time traffic congestion feeds.
4. **Building Plinth Heights**: Footprint exposure measures terrain macro-catchment intersection ($m^2$); it does not assess plinth elevations above street grade or indoor submergence.
5. **Observation Storage**: Citizen observations persist locally in `public/data/cities/amritsar/observations/observations.json`. High-concurrency production deployments should attach Supabase or PostgreSQL.

---

## 10. License & Attributions

Research and hackathon prototype developed for BuildFest 2.0 (Problem Statement PS-18).  
Data sources: Open-Meteo (CC BY 4.0), OpenStreetMap (ODbL), Copernicus DEM GLO-30 (European Space Agency), Google Open Buildings V3, ESA WorldCover 2021.
