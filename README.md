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
- **Validation, Provenance & Integrity**: Zod schemas on all API boundaries; canonical SHA-256 frozen configuration verification (`74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49`); value-level data provenance metadata (`Observed`, `Estimated`, `Fallback`) attached to all telemetry fields.
- **Testing**: Vitest (80 test files, 721 passing unit & component tests), Playwright (E2E browser smoke tests), and Pytest (57 geospatial pipeline tests).

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
| `p16-polish` | **Done** | Complete frontend visual polish & design-system overhaul, clean tokens, watermark-free OSM tiles, WCAG AA typography & contrast |
| `p17-truth` | **Done** | Data truth audit, capability truth matrix, strict scientific degradation boundaries |
| `p18-backtest` | **Done** | 14-year ERA5-Land reanalysis backtesting engine against 15 historical Tribune event records |
| `p19-evidence` | **Done** | Historical event evidence dossier, Wilson confidence intervals, spatial tolerance checks |
| `p20-alerts` | **Done** | Multi-channel alert subsystem (SMS, email, webhooks), fail-closed rate limiters, subscriber repository |
| `p21-canary` | **Done** | Production deployment readiness, dry-run canary preflight, security review, runtime kill-switch |
| `p22-spatial-audit` | **Done** | Deep spatial audit, boundary proximity analysis, miss dissection, LOSEO cross-validation |
| `p23-multi-city` | **Done** | Dynamic multi-city registry, Jalandhar exploratory bootstrap, isolated city alert repos |
| `p24-geovalidation` | **Done** | Independent geospatial audit, machine-readable `quality_report.json`, cross-city non-equivalence proof |
| `p25-terrain-evidence` | **Done** | Ingested physical Copernicus DEM & ESA WorldCover for Jalandhar, reconstructed 10-record incident inventory, defensible evaluation workflow, `evidence_insufficient` gate enforcement |

---

## 5. Multi-City Architecture & Governance

NEXSTORM supports dynamic multi-city discovery via `src/lib/city/registry.ts`, with isolated data directories in `public/data/cities/{city_id}/`.

| City ID | Name & Bounds | Primary Role | Readiness State | Alert Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **`amritsar`** | $31.50^\circ–31.75^\circ\text{ N}, 74.75^\circ–75.05^\circ\text{ E}$ | Reference Baseline (Calibrated) | `pilot_eligible` | Opt-in canary evaluation only |
| **`jalandhar`** | $31.28^\circ–31.38^\circ\text{ N}, 75.52^\circ–75.66^\circ\text{ E}$ | Secondary Pilot (Physical Terrain) | `evidence_insufficient` | **Strictly Suppressed (Fail-Closed)** |

### Readiness State Machine
Cities advance through a strict 6-stage gate:
1. `configuration_only`: Valid metadata schema & bounding box.
2. `data_bootstrapped`: Valid metric analysis grid in target UTM CRS.
3. `model_generated`: Physical terrain & land cover features computed; passes technical integrity audit (`quality_report.json`).
4. `evidence_insufficient`: Model generated, but city lacks sub-daily telemetry or municipal records. **Live alerts fail-closed.**
5. `evaluation_ready`: $\ge 5$ independent verified storms with documented detection and spatial matching.
6. `pilot_eligible`: Localized calibration complete, municipal authorization recorded, operator sign-off granted.

---

## 6. How to Run the Project & Launch Everything Perfectly

### Prerequisites
- **Node.js**: `v20.x` or higher (tested on Node 22 & 24)
- **npm**: `v10.x` or higher
- **Git**
- *(Optional)* **Python**: `3.11+` with virtualenv (only needed if running the offline geospatial data pipeline or tests in `pipeline/`)

---

### Quick Start (Zero-Config, Runs Completely Out of the Box)

NEXSTORM is engineered to run immediately with **zero required API keys or external services**. Public Open-Meteo weather APIs, pre-packaged geospatial datasets (`public/data/`), and local file-based persistence run automatically.

```bash
# 1. Clone the repository
git clone https://github.com/sakshamgupta005/NEXSTORM.git
cd NEXSTORM

# 2. Install dependencies
npm install

# 3. Start the local development server (Turbopack)
npm run dev
```

The application will be live at [http://localhost:3000](http://localhost:3000).

---

### Step-by-Step Execution Guide

#### Step 1: Environment Configuration (Optional)
If you wish to configure optional cloud persistence (Supabase) or alert credentials:
```bash
cp .env.example .env.local
```
Key configuration parameters in `.env.local`:
- `NEXT_PUBLIC_SITE_URL`: Base URL (default: `http://localhost:3000`)
- `OBSERVATION_SALT`: Stable salt for privacy-preserving reporter hashing (auto-generated ephemeral fallback if unset)
- `MODERATOR_SECRET`: Bearer token for verifying community waterlogging observations via `/api/observations/[id]/verify`
- `ALERT_OPERATOR_KEY`: Security token for executing alert dispatches via `/api/alerts/dispatch`
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase authentication & persistent storage (offline file mutex used if unset)

Verify your configuration safely at any time:
```bash
npm run env:check
```

#### Step 2: Install Node Dependencies
```bash
npm install
```

#### Step 3: Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Step 4: Run in Production Mode
To test production compilation, bundle size, and server-side rendering:
```bash
# Compile optimized production bundle
npm run build

# Start production server
npm run start
```

---

### Key URLs & User Journey Walkthrough

| URL / Screen | Key Features & Interactions |
|---|---|
| **Main Platform**<br>[http://localhost:3000](http://localhost:3000) | • **Overview Tab**: System hero, synthetic hyetograph scenario simulator ($0–80\text{ mm/h}$), and 3-pillar architectural cards.<br>• **Buildings Tab**: Interactive Google Open Buildings V3 footprint layer, high-risk hotspot selectors, and building dossiers with elevation & catchment susceptibility.<br>• **Roads Tab**: Dynamic flood-aware routing engine, comparing Route A (Bypass) vs Route B (Rego Underpass chokepoint) with exposure penalty scores.<br>• **About Tab**: 6-stage scientific processing pipeline and technology provenance.<br>• **Navbar Actions**: Click **Live Pipeline Status** for live diagnostic telemetry (`/api/health`) or **Report Waterlogging** to submit a ground-truth observation. |
| **Amritsar City Console**<br>[http://localhost:3000/city/amritsar](http://localhost:3000/city/amritsar) | Calibrated reference baseline console: interactive 250m cell inspector, live NDMA SACHET warning feed, rainfall intensity timelines, and cell factor breakdowns. |
| **Jalandhar Pilot Console**<br>[http://localhost:3000/city/jalandhar](http://localhost:3000/city/jalandhar) | Secondary physical terrain pilot: demonstrates the `evidence_insufficient` safety gate, displaying physical Copernicus DEM & ESA WorldCover data while strictly suppressing uncalibrated alerts. |
| **Authentication (Optional)**<br>[http://localhost:3000/login](http://localhost:3000/login) | Clean sign-in and sign-up flows with Supabase auth or fallback demo preview modes. |

---

### Developer & Operational Command Reference

| Command | Purpose | When to Run |
|---|---|---|
| `npm run dev` | Boots local Next.js 16 development server with Turbopack | Local development |
| `npm run build` | Compiles optimized production bundle and checks SSR/route contracts | Before deployment |
| `npm run start` | Boots the compiled production server | Production testing |
| `npm test` | Runs Vitest unit and component test suites (80 files, 721 tests) | Code changes / pre-commit |
| `npm run typecheck` | Strict TypeScript compilation check (`tsc --noEmit`) | Type safety verification |
| `npm run lint` | Runs ESLint static analysis | Style and lint verification |
| `npm run verify` | Runs all master quality gates (env check, lint, typecheck, tests, build) | CI/CD and pre-submission |
| `npm run smoke` | Probes `/api/health`, `/`, headers, and 404 isolation against a running server | Post-deployment smoke check |
| `npm run preflight:alerts` | Runs alert subsystem readiness & safety checks across all cities | Before alert rollout |
| `npm run env:check` | Diagnostics report for environment variables (masked secrets) | Configuration audit |

*(Optional)* Run Python geospatial pipeline tests (requires Python 3.11+ virtual environment):
```bash
.venv\Scripts\python.exe -m pytest pipeline/tests/ -v
# or on Linux/macOS:
# pytest pipeline/tests/ -v
```

---

## 7. Verification & Automated Test Commands

Run the full testing and quality audit suite:

```bash
# 1. TypeScript Strict Typecheck (zero errors)
npm run typecheck

# 2. ESLint Code Quality (zero errors, zero warnings)
npm run lint

# 3. Vitest Unit, Component, and Integration Tests (80 test files, 721 tests)
npm test

# 4. Next.js Production Build Verification (compiles 33 routes)
npm run build

# 5. Playwright E2E Browser Smoke Tests
npm run test:e2e

# 6. Python Geospatial Pipeline & Quality Audit Test Suite (57 tests)
.venv\Scripts\python.exe -m pytest pipeline/tests/ -v
```

---

## 8. API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/rainfall?cityId=amritsar` | `GET` | Normalised precipitation forecast & observations with value-level provenance metadata (`Observed`, `Estimated`, `Fallback`). |
| `/api/risk?cityId=amritsar&mode=live` | `GET` | Evaluates real-time risk grid and timeline from live ensemble weather forecasts. |
| `/api/risk?cityId=amritsar&mode=replay&event=2025-09-01_amritsar&t=1` | `GET` | Evaluates 72-hour historical monsoon event replay with verified golden outputs. |
| `/api/risk?cityId=amritsar&mode=scenario&peakMm1h=40&durationH=4` | `GET` | Evaluates synthetic triangular hyetograph scenario over verified susceptibility grid. |
| `/api/scenario` | `POST` | Computes hyetograph scenarios with custom peak rainfall and storm duration parameters. |
| `/api/cell/[cellId]?cityId=amritsar` | `GET` | Returns cell factor contributions, terrain override note, nearest historical hotspot ($\le 500\text{ m}$), and scientific limitations. |
| `/api/buildings?cityId=amritsar` | `GET` | Viewport-bounded building footprint query with metric areas and multi-cell susceptibility. |
| `/api/roads/risk?cityId=amritsar` | `GET` | Road segment risk query with bounding box, highway classification, and underpass filters. |
| `/api/roads/route-compare` | `POST` | Multi-candidate route flood exposure evaluation and safety ranking. |
| `/api/roads/plan` | `GET`, `POST` | Origin-to-destination flood-aware route planning with A* pathfinding and candidate comparison. |
| `/api/observations?cityId=amritsar` | `GET`, `POST` | Query filtered observations or submit a community report with rate-limiting and spatial snapping. |
| `/api/observations/[id]/verify` | `PATCH` | Verify or reject a community observation (requires `MODERATOR_SECRET` bearer token). |
| `/api/alerts/subscribe` | `POST` | Register a new alert subscriber (SMS, email, webhook) with city boundary validation. |
| `/api/alerts/unsubscribe` | `POST` | Deregister an alert subscriber. |
| `/api/alerts/preview?cityId=amritsar` | `GET` | Preview current alert decision state and target audience for a city. |
| `/api/alerts/status?cityId=amritsar` | `GET` | Inspect operational dispatch status, suppression state, and delivery statistics. |
| `/api/alerts/dispatch` | `POST` | Trigger authorized alert delivery cycle (requires `ALERT_OPERATOR_KEY`). |
| `/api/official-alerts?state=Punjab` | `GET` | Normalized NDMA SACHET CAP alert feed for official flood/weather advisories. |
| `/api/evaluation?cityId=amritsar` | `GET` | Serves offline pipeline evaluation summary verified against frozen configuration hash. |
| `/api/evaluation/backtest?cityId=amritsar&season=2024` | `GET` | Runs chronological historical backtesting against genuine ERA5 reanalysis and Tribune incident records. |
| `/api/health` | `GET` | Operational health probe with system memory, uptime, and cache statuses. |

---

## 9. Permanent Governance & Safety Guardrails

- **Mandatory Permanent Disclaimer**: Prominently displayed across all application headers, modals, and API payloads:
  > *"RESEARCH PROTOTYPE — DEMO DATA: NEXSTORM provides experimental relative waterlogging risk estimates based on simulated rainfall and synthetic placeholder susceptibility data. It does NOT provide verified street-level flood predictions, measured observations, or official emergency warnings. Consult IMD, NDMA, and local municipal disaster authorities for official emergency advisories."*
- **Restricted Vocabulary**: User-facing interfaces strictly avoid panic and emergency words (*Emergency, Evacuate, Evacuation, Danger, Safe, Unsafe*). Allowed advisory tiers are restricted to **Watch** and **Warning**, with route recommendations framed as **caution**, **avoid**, or **lower_exposure**.
- **No Hallucinated Data**: Upstream weather disconnects trigger cached snapshot fallbacks (`kind: "cached"`) or explicit HTTP 503 degraded states. Zero synthetic rainfall is fabricated.
- **Truthful Confidence**: Single deterministic weather runs explicitly return `confidence: "unavailable"` rather than inventing synthetic ensemble spreads.

---

## 10. Verified Known Limitations

1. **Surface Susceptibility vs Underground Hydraulics**: Static susceptibility captures macro-topographic pooling potential; it does not simulate storm sewer pipe diameters, catch-basin clogging, or pump discharge rates.
2. **Road Network Restrictions**: Road graph edges in `road_graph.json` are bidirectional due to OpenStreetMap GeoPackage limitations; lane-level one-way restrictions and turn bans are unmodeled.
3. **Routing Velocities**: Candidate route travel times are estimated using a fixed 30 km/h baseline velocity without dynamic real-time traffic congestion feeds.
4. **Building Plinth Heights**: Footprint exposure measures terrain macro-catchment intersection ($m^2$); it does not assess plinth elevations above street grade or indoor submergence.
5. **Observation Storage**: Features dual-mode persistence (`src/lib/observations/repository.ts`): high-concurrency Supabase PostgreSQL/PostGIS in production with RLS; serialized queue-based mutex file storage for local offline development. Database migration provided in `supabase/migrations/20261015_create_observations.sql`.

---

## 11. License & Attributions

Research and hackathon prototype developed for BuildFest 2.0 (Problem Statement PS-18).  
Data sources: Open-Meteo (CC BY 4.0), OpenStreetMap (ODbL), Copernicus DEM GLO-30 (European Space Agency), Google Open Buildings V3, ESA WorldCover 2021.
