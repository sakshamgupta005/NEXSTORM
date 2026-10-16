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
   • 1,998 Amritsar 250m cells     • 360,252 Google Open            • Dual-City Road Networks:
   • 699 GNDU subgrid cells          Buildings V3 footprints          - Amritsar: 14,855 segments,
   • Copernicus 30m DEM sinks      • Metric areas in UTM 43N            28,418 nodes, 37,924 edges
   • Dynamic RTI Rainfall Trigger  • Area-weighted multi-cell         - Jalandhar: 17,358 segments,
   • Live ECMWF/GFS ensemble         catchment exposure                 30,876 nodes, 93,031 edges
   • Historical monsoon replay     • Centroid & bounds queries      • Topographic underpass sinks
   • Scenario hyetograph test      • Interactive structure dossier    (e.g., Rego Bridge sump)
                                   • Centroid proximity matching    • A* flood-aware pathfinding
                                     (≤35m) for photo evidence      • Active visual flood penalty
        │                                │                                │
        └────────────────────────────────┴────────────────────────────────┘
                                         │
                                         ▼
                     GROUND-TRUTH & COMMUNITY EVIDENCE LAYER
                     ───────────────────────────────────────
                     • Multimodal AI vision analysis (Gemini 1.5 Flash, GPT-4o-mini, Local rules)
                     • Mathematical risk fusion engine (R_final = (1-wq)R_base + (wq)R_visual)
                     • Strict spatial snapping (≤25m roads, ≤35m buildings) & dry dampening floor
                     • Mapillary Graph API v4 street survey baseline vs active storm photo (<24h)
                     • Citizen waterlogging reports with privacy-preserving salt-hashing
                     • Administrative moderation & corroboration clustering workflow
```

---

### 1.1 Hackathon Judge Onboarding & 5-Minute Evaluation Guide

Welcome BuildFest 2.0 Judges! NEXSTORM runs **100% out-of-the-box with zero required API keys** (`npm install && npm run dev`). Use this quick 7-step checklist to evaluate the complete system in under 5 minutes:

| Step | Surface / Route | What to Observe & Test | Key Differentiators |
| :--- | :--- | :--- | :--- |
| **1** | **Landing & Overview**<br>[http://localhost:3000](http://localhost:3000) | • Observe the **Hero Radar Console** with pulsing radar scan ring, active sensor telemetry, and live pipeline status button (`/api/health`).<br>• Adjust the **Precipitation Stress-Test Slider** ($0–80\text{ mm/h}$) to see live dynamic risk shifting across the 3 intelligence pillars in real time.<br>• Inspect the **City Hydro Monitor** with catchment saturation and water elevation telemetry.<br>• Review the **Operational Capabilities Timeline** for system provenance and engineering milestones. | Deterministic hyetograph simulation with zero backend lag. |
| **2** | **About Us & Methodology**<br>[http://localhost:3000/about](http://localhost:3000/about) or [http://localhost:3000/?tab=about](http://localhost:3000/?tab=about) | • Use the top pill Table of Contents to navigate all 9 technical sections with smooth auto-scroll.<br>• Inspect the **Mathematical Formula Cards** ($S$, $\text{RTI}$, $R_{\text{final}}$) with clear LaTeX explanations.<br>• Review the **12-cell 2D Susceptibility-Rainfall Matrix** with WCAG AA high-contrast status badges.<br>• Review team contributions, architecture specifications, and academic citations. | 100% explainable, zero-hallucination physics-grounded methodology. |
| **3** | **Amritsar 250m Macro Explorer**<br>[http://localhost:3000/city/amritsar](http://localhost:3000/city/amritsar) | • Notice the **Data Integrity & Scientific Grounding Bar** clarifying relative susceptibility vs. flood depth.<br>• Switch between **Amritsar City (250m)** and **GNDU Campus (50m)** spatial scopes.<br>• Toggle between **Scenario Simulation**, **Live Forecast** (ECMWF/GFS ensemble), and **Historical Replay** (Sep 1, 2025 extreme downpour event).<br>• Scrub the **Rainfall Timeline** to inspect temporal cell risk propagation.<br>• Inspect the live **NDMA SACHET Official Warning Feed** and cell factor breakdowns. | Dual-resolution spatial grids (1,998 macro cells + 699 campus cells). |
| **4** | **Building Risk & Photo Evidence**<br>[http://localhost:3000/?tab=buildings](http://localhost:3000/?tab=buildings) | • Select landmarks (Golden Temple, Khalsa College, GNDU Science Block, Hall Gate, Heritage Street, Putlighar Market).<br>• Drag the **red Google Maps pin probe** anywhere on the canvas to see real-time distance-to-sink and runoff vector updates.<br>• Inspect the **Dossier HUD** with landmark photography previews and external Google Maps search links.<br>• Note: Buildings inherit catchment exposure ($m^2$); indoor inundation is not falsely claimed. | 360,252 Google Open Buildings V3 footprints in UTM Zone 43N. |
| **5** | **Dynamic Road Corridor Routing**<br>[http://localhost:3000/?tab=roads](http://localhost:3000/?tab=roads) | • Select origin and destination transit hubs (`AMRITSAR_HUBS`: Airport, Junction, Golden Temple, GNDU, ISBT).<br>• Click the **Swap Route Direction (⇅)** button to reverse pathfinding.<br>• Compare **Route A (Safe/Bypass)** vs **Route B (Hazardous/Underpass)** with exposure penalties.<br>• Inspect the automatic $+20$ pt hazard offset on the Rego Bridge underpass sump.<br>• Observe active visual flood penalty integration ($+25$ to $+30$ pts) when flood evidence is present. | Graph traversal over 14,855 segments, 28,418 nodes, and 37,924 edges. |
| **6** | **GNDU 50m Campus Campaign**<br>[http://localhost:3000/campaign/gndu](http://localhost:3000/campaign/gndu) | • Inspect the 699 high-res micro-cell coverage metric verified from `campus_susceptibility.geojson`.<br>• Review student crowd-sourced ground-truth objectives, ridge crest elevation ($233.8\text{m}$), and 42 mapped university facilities. | Hyper-local 50m micro-topography modeling for university climate resilience. |
| **7** | **Jalandhar Exploratory Readiness**<br>[http://localhost:3000/city/jalandhar](http://localhost:3000/city/jalandhar) | • Observe the **`evidence_insufficient`** safety status.<br>• Verify that operational alert dispatches are **strictly suppressed (fail-closed)** because Jalandhar lacks indexed building footprints and sub-daily validation records.<br>• Inspect physical Copernicus DEM and 17.3k road network graph (30.8k nodes, 93k edges). | Ethical AI guardrails: refuses to issue uncalibrated municipal warnings. |


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
- **Dual-City Road Networks**:
  - **Amritsar Baseline**: 14,855 road segments, 28,418 graph nodes, and 37,924 routing edges ingested from OpenStreetMap.
  - **Jalandhar Expansion**: 17,358 road segments, 30,876 graph nodes, and 93,031 routing edges topologically noded for graph traversal.
- **Topographic Underpass Chokepoints**: Identifies known historical sump traps (e.g., Rego Bridge railway underpass bowl in Amritsar) where surface runoff converges, applying an automatic $+20$ point baseline hazard offset.
- **A* Flood-Aware Routing Engine**: Compares alternative origin-to-destination corridors between key transit hubs (e.g., Amritsar Railway Station to Sri Guru Ram Dass Jee International Airport), evaluating distance, baseline travel time, and modeled exposure penalty scores.
- **Active Visual Impedance Penalty**: Traversed segments with active verified flood imagery incur a $+25$ to $+30$ point route impedance penalty, transitioning routing advice to `'avoid'` and explaining the specific flooded segments.

### Image Evidence & Multimodal AI Vision Fusion (P29–P32)
- **Multimodal AI Vision Ingestion**: Ingests ground-level smartphone photos, municipal records, and street surveys. Evaluates imagery using Google Gemini 1.5 Flash, OpenAI GPT-4o-mini, remote ONNX segmentation, or deterministic local rule-based heuristics with zero API dependencies.
- **Structured Visual Observations (`visualObservationZodSchema`)**: Extracts qualitative physical proxies without hallucinating millimeter water depths:
  - `roadWaterCondition`: `none`, `curb_ponding`, `flowing_surface_water`, `deep_standing_water`, `submerged`.
  - `roadPassability`: `passable`, `caution`, `impassable`.
  - `buildingWaterImpact`: `none`, `water_at_perimeter`, `entrance_doorstep_inundation`, `ground_floor_flooded`.
  - `imageQuality` & `uncertaintyLevel`: Bounded quality factors and confidence metrics.
- **Mathematical Risk Fusion Engine**: Integrates visual evidence directly into existing road and building scoring functions to compute a unified $R_{\text{final}}$ score:
  $$R_{\text{final}} = \text{clamp}\big((1 - w \cdot q) \cdot R_{\text{base}} + (w \cdot q) \cdot R_{\text{visual}},\, 0,\, 100\big)$$
  where reliability $q = q_{\text{dist}} \times q_{\text{time}} \times q_{\text{qual}} \times \text{conf}$.
- **Strict Spatial Association**: Enforces Haversine metric proximity thresholds ($\le 25\text{ m}$ for road corridor segments, $\le 35\text{ m}$ around building centroids). Distant photos inside the same 250m cell never bleed across unrelated structures.
- **Temporal Stratification**: Historical baseline street surveys (e.g., Mapillary Graph API v4 passes) enforce $q = 0.0$ (`historical_vulnerability_only`), ensuring baseline photos never trigger active storm alerts. Active storm evidence is restricted to $< 24\text{ h}$.
- **Asymmetric Dry Override & Safety Floor**: When a photo shows dry pavement in an area under severe rainfall ($R_{\text{visual}} < R_{\text{base}}$), visual weight is dampened to $w_{\text{eff}} = 0.25 \cdot w$ and clamped to a safety floor ($R_{\text{final}} \ge 0.85 \cdot R_{\text{base}}$). A localized dry spot can never erase upstream catchment deluge risk.
- **Deduplication Integrity**: All ingested photos are indexed and deduplicated via cryptographic SHA-256 hashes.

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
- **Multimodal Vision & Image Ingestion**: Pluggable AI vision adapters for Google Gemini 1.5 Flash (`@google/genai`), OpenAI GPT-4o-mini, remote ONNX segmentation service, and zero-dependency local rule heuristics; Mapillary Graph API v4 street survey adapter.
- **Testing**: Vitest (87 test files, 802 passing unit & component tests), Playwright (E2E browser smoke tests), and Pytest (57 geospatial pipeline tests).

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
| `p26-data-credibility` | **Done** | Data credibility & risk engine audit, coordinate truth across cities, zero-node network honesty, non-synthetic fallbacks |
| `p27-jalandhar-expansion` | **Done** | Ingested Jalandhar road network (17,358 segments, 30,876 nodes, 93,031 edges), Dijkstra pathfinding, building exposure blocker audit |
| `p28-independent-risk` | **Done** | Independent risk formula validation, monotonicity proofs, Wilson confidence intervals, canonical config hash verification |
| `p29-image-evidence` | **Done** | Geolocated image evidence architecture, FloodNet taxonomy adaptation, Mapillary Graph API v4 adapter, temporal stratification (<24h active vs historical) |
| `p30-ai-vision` | **Done** | Multimodal AI vision analysis (Gemini 1.5 Flash, GPT-4o-mini, ONNX, Local rules), strict Zod schema validation (`VisualRiskFeaturesV1`), confidence calibration |
| `p31-risk-fusion` | **Done** | Mathematical risk fusion engine ($R_{\text{final}}$), road dynamic risk escalation, route visual impedance penalties (+25 to +30 pts), building exposure elevation, 85% safety floor |
| `p32-end-to-end-audit` | **Done** | 10-point independent audit suite (`tests/unit/images/p32-end-to-end-audit.test.ts`), end-to-end verification across APIs and UI components (87 test files, 802 tests passed) |

---

## 5. Multi-City Architecture & Governance

NEXSTORM supports dynamic multi-city discovery via `src/lib/city/registry.ts`, with isolated data directories in `public/data/cities/{city_id}/`.

| City ID | Name & Bounds | Primary Role | Readiness State | Alert Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **`amritsar`** | $31.50^\circ–31.75^\circ\text{ N}, 74.75^\circ–75.05^\circ\text{ E}$ | Reference Baseline (Calibrated, 360k Buildings, 14.8k Roads) | `pilot_eligible` | Opt-in canary evaluation only |
| **`jalandhar`** | $31.28^\circ–31.38^\circ\text{ N}, 75.52^\circ–75.66^\circ\text{ E}$ | Secondary Pilot (Physical Terrain & 17.3k Road Network; Building S2-391 Archive Blocker) | `evidence_insufficient` | **Strictly Suppressed (Fail-Closed)** |

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

### Prerequisites & System Requirements
- **Node.js**: `v20.x` or higher (tested and verified on Node 20, 22, and 24; check with `node -v`)
- **npm**: `v10.x` or higher (check with `npm -v`)
- **Git**: Installed and available in PATH (check with `git --version`)
- **Operating System**: Windows 10/11 (PowerShell or Command Prompt), macOS, or Linux
- **Browser**: Any modern browser (Google Chrome, Microsoft Edge, Brave, Mozilla Firefox, Safari)
- *(Optional)* **Python**: `3.11+` with virtualenv (only needed if regenerating offline geospatial pipeline artifacts or running Python tests in `pipeline/`)

---

### Quick Start (Zero-Config, Runs Completely Out of the Box)

NEXSTORM is engineered to run immediately with **zero required API keys or external services**. All pre-packaged geospatial datasets (`public/data/`):
- 1,998 Amritsar 250m macro cells
- 699 GNDU Campus 50m micro-mesh cells
- Copernicus GLO-30 DEM depression sinks & ESA WorldCover rasters
- 360,252 Google Open Buildings V3 footprints in UTM Zone 43N
- Dual-city OpenStreetMap road graphs (Amritsar: 14.8k segments, 37.9k edges; Jalandhar: 17.3k segments, 93k edges)
- Verified historical monsoon replay (`2025-09-01_amritsar.json`)

are pre-computed and included in the repository. Public Open-Meteo weather APIs and local file-based mutex persistence operate automatically without any database setup.

```bash
# 1. Clone the repository
git clone https://github.com/sakshamgupta005/NEXSTORM.git
cd NEXSTORM

# 2. Install all dependencies
npm install

# 3. Start the local development server (Turbopack)
npm run dev
```

Once the terminal outputs `Ready in ...ms`, open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Detailed Step-by-Step Launch Guide

#### Step 1: Clone and Enter the Project Directory
```bash
git clone https://github.com/sakshamgupta005/NEXSTORM.git
cd NEXSTORM
```

#### Step 2: Install Dependencies
Install all required Node.js dependencies:
```bash
npm install
```
*Note: All peer dependencies and TypeScript types are resolved automatically.*

#### Step 3: Environment Configuration (Completely Optional)
By default, NEXSTORM does **not** require a `.env.local` file to run. However, if you wish to configure optional AI multimodal vision providers, custom base URLs, or security keys:

```bash
# On Linux / macOS / Git Bash:
cp .env.example .env.local

# On Windows PowerShell:
Copy-Item .env.example .env.local
```

Key configuration parameters in `.env.local`:
| Parameter | Default / Fallback | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Canonical application URL |
| `OBSERVATION_MODERATOR_KEY` | *(None / Dev mode)* | Bearer token required for verifying/rejecting community waterlogging reports via `/api/observations/[id]/verify` |
| `OBSERVATION_SALT` | *Auto-generated ephemeral salt* | Salt for privacy-preserving citizen reporter IP hashing |
| `ALERT_OPERATOR_KEY` | *(None / Dev mode)* | Operator bearer token required to execute municipal alert dispatches via `/api/alerts/dispatch` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | *(None / Uses local heuristics)* | Google Gemini API key for multimodal image flood condition analysis (`gemini-1.5-flash`) |
| `OPENAI_API_KEY` | *(None / Uses local heuristics)* | OpenAI API key for vision fallback (`gpt-4o-mini`) |
| `MAPILLARY_ACCESS_TOKEN` | *(None / Uses archived surveys)* | Mapillary Graph API v4 access token for baseline street-level survey imagery |
| `NEXT_PUBLIC_SUPABASE_URL` | *(None / Uses local JSON mutex)* | Supabase PostgreSQL database URL (optional cloud persistence) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(None / Uses local JSON mutex)* | Supabase anonymous public key |

Audit your environment configuration safely (with masked secrets):
```bash
npm run env:check
```

#### Step 4: Launch the Local Development Server
```bash
npm run dev
```
The server will boot with Next.js 16 and Turbopack at:
👉 **[http://localhost:3000](http://localhost:3000)**

##### Running on a Custom Port:
If port 3000 is already in use on your machine, pass the `-p` flag:
```bash
npm run dev -- -p 3001
```
Or set the `PORT` environment variable:
```bash
# Windows PowerShell:
$env:PORT="3001"; npm run dev

# Linux / macOS / Git Bash:
PORT=3001 npm run dev
```

#### Step 5: Launch in Optimized Production Mode (Recommended for Demos & Evaluations)
To evaluate the pre-compiled, optimized production bundle with full server-side rendering:
```bash
# 1. Compile optimized production build (compiles all 31 routes and verifies SSR contracts)
npm run build

# 2. Start the high-performance production server
npm run start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

#### Step 6: Verify Live Server Health
With either the development or production server running, execute the automated smoke test suite:
```bash
npm run smoke
```
This probes `/api/health`, `/`, response headers, security headers, and 404 isolation.

---

### Troubleshooting & Common Launch Pitfalls

#### 1. Port 3000 is already occupied (`Error: listen EADDRINUSE: address already in use :::3000`)
- **Option A (Quickest)**: Launch on an alternate port:
  ```bash
  npm run dev -- -p 3001
  ```
- **Option B (Free port 3000 on Windows PowerShell)**:
  ```powershell
  Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force
  ```
- **Option C (Free port 3000 on Windows Command Prompt)**:
  ```cmd
  for /f "tokens=5" %a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %a
  ```
- **Option D (Free port 3000 on macOS / Linux)**:
  ```bash
  npx kill-port 3000
  # or:
  lsof -ti:3000 | xargs kill -9
  ```

#### 2. Windows PowerShell Script Execution Policy Restriction
If running `npm run dev` in PowerShell produces:
`npm : File ... cannot be loaded because running scripts is disabled on this system.`
- **Fix**: Open PowerShell and run:
  ```powershell
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
  ```
  Then re-run `npm run dev`.

#### 3. Node.js Version Incompatibility
If you see unexpected module errors during build or runtime:
- Check your installed Node.js version:
  ```bash
  node -v
  ```
- Ensure you are using **Node.js v20.x, v22.x, or v24.x**. If you have `nvm` (Node Version Manager) installed:
  ```bash
  nvm use 20
  # or:
  nvm use 22
  ```

#### 4. Stale Next.js / Turbopack Cache
If you encounter unusual compilation errors after pulling git changes:
- Clean the Next.js build cache and restart:
  ```bash
  # Windows PowerShell:
  Remove-Item -Recurse -Force .next
  npm run dev

  # Linux / macOS / Git Bash:
  rm -rf .next
  npm run dev
  ```

---

### Key URLs & User Journey Walkthrough

| URL / Screen | Key Features & Interactions |
|---|---|
| **Main Platform (Overview)**<br>[http://localhost:3000](http://localhost:3000) or `/?tab=overview` | • **Hero Radar Console**: Real-time telemetry feed with active radar scan ring, sensor counters, and live pipeline status button (`/api/health`).<br>• **Precipitation Stress-Test Slider**: Scrub between $0$ and $80\text{ mm/h}$ to watch dynamic hyetograph risk recalculate instantly across all 3 pillars.<br>• **City Hydro Monitor**: Real-time saturation metrics, catchment pressure, and terrain elevation gauges.<br>• **Pillar Spotlight Cards**: Interactive drill-down into Area, Building, and Road intelligence layers.<br>• **System Capabilities Timeline**: 32-stage engineering development provenance.<br>• **Report Waterlogging**: Click navbar button to open citizen observation report modal with spatial snapping and boundary validation. |
| **Building Exposure HUD**<br>[http://localhost:3000/?tab=buildings](http://localhost:3000/?tab=buildings) | • **Google Open Buildings V3**: Visualizes 360,252 building footprints projected in UTM Zone 43N.<br>• **Landmark Hotspots**: Instant focus on Golden Temple, Khalsa College, GNDU Science Block, Hall Gate, Heritage Street, Putlighar Market, Lawrence Road, and Mall Road.<br>• **Interactive Probe Pin**: Drag the red Google Maps pin probe anywhere across the canvas to inspect live distance-to-sink and runoff vector updates.<br>• **Dossier HUD**: View structure area ($m^2$), elevation above sea level, catchment susceptibility score, landmark photography preview, and external Google Maps links. |
| **Road Corridor Routing**<br>[http://localhost:3000/?tab=roads](http://localhost:3000/?tab=roads) | • **Flood-Aware Pathfinding**: Graph traversal over 14,855 segments, 28,418 nodes, and 37,924 edges.<br>• **Transit Hub Pairings**: Select origin/destination corridors (Airport, Railway Station, Golden Temple, GNDU, ISBT Bus Terminal).<br>• **Swap Route Direction (⇅)**: Reverse origin and destination with one click.<br>• **Route Comparison**: Compare Route A (Safe/Bypass) vs Route B (Hazardous/Underpass) with explicit exposure penalty scores.<br>• **Underpass Chokepoints**: Automatic $+20$ pt baseline penalty on the Rego Bridge underpass sump bowl.<br>• **Active Visual Flood Penalties**: Verified flood imagery applies $+25$ to $+30$ pt impedance penalties, triggering dynamic route avoidance. |
| **About Us & Methodology**<br>[http://localhost:3000/about](http://localhost:3000/about) or `/?tab=about` | • **Sticky Pill Navigation**: Smooth auto-scroll through all 9 technical sections.<br>• **Mathematical Formula Cards**: Mathematical derivations for Static Susceptibility ($S$), Dynamic RTI, and Vision Fusion ($R_{\text{final}}$).<br>• **12-Cell 2D Matrix**: High-contrast WCAG AA risk classification matrix.<br>• **Research & Citations**: Academic citations (FloodNet, Open Buildings, Copernicus DEM) and research team credentials. |
| **Amritsar City Console**<br>[http://localhost:3000/city/amritsar](http://localhost:3000/city/amritsar) | • **Calibrated Reference Baseline**: 1,998 250m cells with comprehensive geospatial risk evaluation.<br>• **Dual Spatial Scopes**: Toggle between Amritsar City (250m macro) and GNDU Campus (50m micro-mesh).<br>• **3 Operational Modes**: Switch between Live Forecast (ECMWF/GFS ensemble), Scenario Simulation, and Historical Replay (Sep 1, 2025 extreme downpour).<br>• **Rainfall Timeline**: Interactive scrubber to trace cell-by-cell temporal risk propagation.<br>• **Official Alerts**: Live NDMA SACHET CAP feeds and localized cell factor breakdown drawers. |
| **GNDU Campus Campaign**<br>[http://localhost:3000/campaign/gndu](http://localhost:3000/campaign/gndu) | • **Campus Flood Resilience Hub**: 699 high-res micro-cells from `campus_susceptibility.geojson`.<br>• **42 Campus Facilities**: Academic blocks, hostels, sports complexes, and university administrative buildings.<br>• **Ridge Crest Analysis**: High-elevation ridge ($233.8\text{m}$) vs southern lowlands.<br>• **Student Action Portal**: Objectives and ground-truth photo evidence submission workflow. |
| **Jalandhar Pilot Console**<br>[http://localhost:3000/city/jalandhar](http://localhost:3000/city/jalandhar) | • **Ethical AI Safety Gate**: Demonstrates the `evidence_insufficient` fail-closed safety gate.<br>• **Physical Terrain & Roads**: Copernicus DEM topography and 17,358 road segments (30.8k nodes, 93k edges).<br>• **Suppression Proof**: Live alerts are strictly suppressed to prevent uncalibrated municipal panic. |
| **Authentication (Optional)**<br>[http://localhost:3000/login](http://localhost:3000/login) | Clean sign-in and sign-up forms with Supabase auth or demo preview modes. |

---

### Developer & Operational Command Reference

| Command | Purpose | When to Run |
|---|---|---|
| `npm run dev` | Boots local Next.js 16 development server with Turbopack | Local development (`http://localhost:3000`) |
| `npm run build` | Compiles optimized production bundle and verifies SSR/route contracts | Before deployment or release |
| `npm run start` | Boots the compiled production server | Production testing / demo presentations |
| `npm test` | Runs Vitest unit and component test suites (87 files, 802 passing tests) | Pre-commit / verification |
| `npm run typecheck` | Strict TypeScript compilation check with `tsc --noEmit` (zero errors) | Code changes / type safety |
| `npm run lint` | Runs ESLint static analysis across the codebase | Style & quality audits |
| `npm run verify` | Master quality verification pipeline (env check, lint, typecheck, tests, build) | CI/CD and pre-submission |
| `npm run smoke` | Probes `/api/health`, `/`, headers, security policies, and 404 isolation | Post-launch smoke check |
| `npm run preflight:alerts` | Runs alert subsystem readiness & safety checks across all cities | Before enabling alert dispatches |
| `npm run env:check` | Diagnostics report for environment variables (safely masks secrets) | Configuration audit |

*(Optional)* Run Python geospatial pipeline tests (requires Python 3.11+ virtual environment):
```bash
# Windows PowerShell:
.venv\Scripts\python.exe -m pytest pipeline/tests/ -v

# Linux / macOS:
pytest pipeline/tests/ -v
```

---

## 7. Verification & Automated Test Commands

Run the full testing and quality audit suite:

```bash
# 1. TypeScript Strict Typecheck (zero errors)
npm run typecheck

# 2. ESLint Code Quality (zero errors, zero warnings)
npm run lint

# 3. Vitest Unit, Component, and Integration Tests (87 test files, 802 tests)
npm test

# 4. Next.js Production Build Verification (compiles 31 routes)
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
| `/api/buildings?cityId=amritsar` | `GET` | Viewport-bounded building footprint query with metric areas and multi-cell susceptibility. (Jalandhar returns honest `CITY_NOT_PREPARED` with documented Google Open Buildings S2-391 7.18 GB unindexed archive blocker). |
| `/api/roads/risk?cityId=amritsar` | `GET` | Road segment risk query for Amritsar (14.8k roads) or Jalandhar (17.3k roads) with bounding box, underpass filters, and fused $R_{\text{final}}$ risk scores (`riskScore`, `baseRiskScore`, `visualRiskScore`, `visualReliability`, `fusionReason`). |
| `/api/roads/route-compare` | `POST` | Multi-candidate route flood exposure evaluation, safety ranking, and active visual flood penalties (+25 to +30 pts) for Amritsar and Jalandhar corridors. |
| `/api/roads/plan` | `GET`, `POST` | Origin-to-destination flood-aware route planning with A* pathfinding on topologically noded graphs (Amritsar: 37,924 edges; Jalandhar: 93,031 edges). |
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
6. **Perspective Shift (UAV Drone vs Smartphone Ground Cameras)**: Benchmark computer vision datasets (FloodNet) train predominantly on UAV aerial nadir imagery. Street-level citizen smartphone photos exhibit horizontal perspective, occlusion, and lighting variance; NEXSTORM uses multimodal LLM extraction and deterministic rule mapping with calibrated quality factors rather than uncalibrated aerial segmentation models.
7. **Satellite Revisit & Cloud Limitations**: Optical satellites (Sentinel-2) are 100% cloud-blind during active monsoon downpours. Synthetic Aperture Radar (Sentinel-1 C-SAR) penetrates cloud cover but operates on a 12-day orbit revisit interval, making it unsuitable for 1-hour real-time operational warning.

---

## 11. License & Attributions

Research and hackathon prototype developed for BuildFest 2.0 (Problem Statement PS-18).  
Data sources & libraries:
- **Weather Telemetry**: Open-Meteo (CC BY 4.0), ECMWF, GFS.
- **Geospatial & Networks**: OpenStreetMap (ODbL 1.0), Copernicus DEM GLO-30 (European Space Agency), ESA WorldCover 2021.
- **Building Footprints**: Google Open Buildings V3 (CC BY-4.0).
- **Street Surveys**: Mapillary Graph API v4 (CC-BY-SA 4.0).
- **Scientific References**: FloodNet (`sahilkhose/FloodNet`, `BinaLab/FloodNet-Supervised_v1.0`), FloodRescue-AI (`aayusPrasad/FloodRescue-AI`).
