# NEXSTORM — Urban Waterlogging & Heavy-Rainfall Early-Warning System

> **DISCLAIMER**: Experimental research prototype. Not an official weather forecast or emergency warning. For official alerts see IMD and NDMA SACHET. NEXSTORM does not predict flood depth, provide verified street-level forecasts, model underground drainage hydraulics, or predict riverine flooding.

**Hackathon**: BuildFest 2.0  
**Problem Statement**: PS-18 — AI-Powered Heavy-Rainfall Forecasting and Urban Waterlogging Early-Warning System for Indian Cities  
**Pilot City**: Amritsar, Punjab, India ($31.634^\circ\text{ N}, 74.872^\circ\text{ E}$)  
**Secondary View**: Guru Nanak Dev University (GNDU) Campus  
**Repository**: [https://github.com/sakshamgupta005/NEXSTORM](https://github.com/sakshamgupta005/NEXSTORM)  

---

## 1. Project Overview

NEXSTORM is an experimental, read-only web application and hydrometeorological risk engine estimating relative urban waterlogging risk across 250m grid cells from numerical weather forecasts and static geospatial susceptibility.

The system combines:
1. **Static Susceptibility ($S \in [0, 1]$)**: Multi-criteria geospatial factor weights capturing built-up density (ESA WorldCover), building fabric pressure (OpenStreetMap), terrain depression depth, and slope flatness (Copernicus DEM GLO-30).
2. **Dynamic Rainfall Trigger Index (RTI)**: Multi-window trailing precipitation accumulations normalized against 15-year monsoon climatology thresholds:
   $$\text{RTI} = \max\left(\frac{P_{1\text{h}}}{T_{1\text{h}}}, \frac{P_{3\text{h}}}{T_{3\text{h}}}, \frac{P_{24\text{h}}}{64.5}, \frac{P_{72\text{h}} + \text{antecedent}_{72\text{h}}}{T_{72\text{h}}}\right)$$
3. **2D Classification Matrix**: Continuous RTI and susceptibility are mapped into intensity bands (`none`, `elevated`, `severe`, `extreme` $\times$ `low`, `mid`, `high`) to produce relative risk classes: **`low`**, **`moderate`**, and **`high`**.

---

## 2. Architecture & Tech Stack

```
NEXSTORM Architecture
┌─────────────────────────────────────────────────────────────┐
│ Next.js 16 App Router (React 19, TypeScript strict, Tailwind v4) │
├──────────────────────────────┬──────────────────────────────┤
│ Frontend Views & Map Layer   │ API Route Handlers           │
│ • Interactive 250m Grid Map  │ • GET /api/risk (live/replay)│
│ • Hyetograph Timeline        │ • GET /api/cell/[cellId]     │
│ • Factor Explanations        │ • GET /api/evaluation        │
│ • NDMA SACHET Alerts Feed    │ • POST /api/scenario         │
├──────────────────────────────┴──────────────────────────────┤
│ TypeScript Hydrometeorological Risk Engine                  │
│ • Precomputed matrix lookups (<40ms for 51 mbrs x 2.5k cells)│
│ • Truthful confidence reporting (unavailable on single series)│
│ • Canonical SHA-256 frozen configuration verification       │
├─────────────────────────────────────────────────────────────┤
│ Resilience & Weather Adapters (Open-Meteo, ECMWF, GFS)       │
│ • Multi-model ensemble fallback with cached snapshot fallback│
│ • Zero synthetic data injection in degraded mode            │
├─────────────────────────────────────────────────────────────┤
│ Offline Geospatial Pipeline (Python 3.11 under pipeline/)   │
│ • Copernicus DEM GLO-30, ESA WorldCover, OSM Overpass       │
│ • 1,998 Amritsar cells, 699 GNDU subgrid cells, 15 hotspots  │
└─────────────────────────────────────────────────────────────┘
```

- **Frontend & Server**: Next.js 16.4 (App Router, Turbopack), React 19, TypeScript (strict mode), Tailwind CSS v4, Leaflet.
- **Data Pipeline**: Python 3.11 (`pipeline/`) using GeoPandas, Shapely, Rasterio, SciPy.
- **Static Artifacts**: Versioned under `public/data/` (GeoJSON grids, frozen configurations, evaluation summaries, and historical replay series).
- **Validation & Integrity**: Zod schemas on all API boundaries; bit-for-bit canonical SHA-256 config hash enforcement (`74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49`).
- **Testing**: Vitest (80 test files, 784 unit & component tests) and Playwright (E2E browser smoke tests).

---

## 3. Key Completed Stages & Roadmap

| Stage Tag | Status | Deliverables |
|---|---|---|
| `p0-clean` | **Done** | Template audit, removed unrelated speech/camera/payments toolkits |
| `p1-core` | **Done** | Core RTI calculations, scenario simulator, Amritsar interactive map prototype |
| `p2-adapters`| **Done** | Open-Meteo forecast adapters, multi-model ensemble fallbacks, NDMA Sachet feeds, snapshot cache |
| `p3-data` | **Done** | Offline Python pipeline, 1,998 real Amritsar cells, 699 GNDU campus cells |
| `p4b-eval` | **Done** | E1–E3 evaluation framework, 72h historical replay (`2025-09-01_amritsar.json`), 46 shared cross-language test vectors |
| `p5-risk` | **Done** | Real risk engine, cell factor explanations (`/api/cell/[cellId]`), contingency metrics, and `/api/evaluation` API |

---

## 4. Getting Started Locally

### Prerequisites
- Node.js 20+ (tested on Node 22 & 24)
- npm 10+
- Python 3.11+ (optional, only needed if re-running the offline geospatial data pipeline)

### Installation & Run

```bash
# 1. Clone the repository
git clone https://github.com/sakshamgupta005/NEXSTORM.git
cd NEXSTORM

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application or [http://localhost:3000/city/amritsar](http://localhost:3000/city/amritsar) for the city console.

---

## 5. Verification Commands

Run the full verification suite defined by the project:

```bash
# Typecheck TypeScript codebase
npm run typecheck

# Lint check (zero errors, zero warnings)
npm run lint

# Run Vitest test suite (80 test files, 784 tests)
npm test

# Build production bundle with Next.js Turbopack
npm run build

# Run Playwright E2E browser smoke tests
npm run test:e2e
```

---

## 6. API Documentation

| Endpoint | Method | Description |
|---|---|---|
| `/api/risk?cityId=amritsar&mode=live` | `GET` | Evaluates real-time risk grid and timeline from live ensemble/deterministic weather forecasts. |
| `/api/risk?cityId=amritsar&mode=replay&event=2025-09-01_amritsar&t=1` | `GET` | Evaluates historical monsoon event replay with verified golden outputs. |
| `/api/risk?cityId=amritsar&mode=scenario&peakMm1h=40&durationH=4` | `GET` | Evaluates synthetic triangular hyetograph scenario over verified susceptibility grid. |
| `/api/cell/[cellId]?cityId=amritsar` | `GET` | Returns cell factor contributions, terrain override note, nearest historical hotspot ($\le 500\text{ m}$), and scientific limitations. |
| `/api/evaluation?cityId=amritsar` | `GET` | Serves offline pipeline evaluation summary verified against frozen configuration hash. |
| `/api/official-alerts?state=Punjab` | `GET` | Normalized NDMA SACHET CAP alert feed for official flood/weather advisories. |
| `/api/health` | `GET` | Operational health probe with system memory, uptime, and cache statuses. |

---

## 7. Permanent Governance & Safety Guardrails
- **Permanent Disclaimer**: Displayed on all views and payloads: *"Experimental research prototype. Not an official weather forecast or emergency warning. For official alerts see IMD and NDMA SACHET."*
- **Restricted Terminology**: Alert text strictly avoids panic words (*Emergency, Evacuate, Evacuation, Danger, Safe, Unsafe*); allowed tiers are only **Watch** and **Warning**.
- **No Hallucinated Data**: Degraded upstream connections fall back to versioned snapshots (`kind: "cached"`) or return explicit 503 degraded states. Zero synthetic rainfall is fabricated.
- **Truthful Confidence**: Single deterministic series explicitly report `confidence: "unavailable"` without fabricating artificial ensemble spreads.

---

## 8. License
Research and hackathon prototype developed for BuildFest 2.0 (PS-18).
Data sources: Open-Meteo (CC BY 4.0), OpenStreetMap (ODbL), Copernicus DEM GLO-30, ESA WorldCover 2021.
