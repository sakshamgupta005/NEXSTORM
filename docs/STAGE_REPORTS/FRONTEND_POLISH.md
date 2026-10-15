# NEXSTORM P16 — Frontend Visual Polish & Design-System Overhaul Report

## Executive Summary

Stage P16 executed a comprehensive, end-to-end visual polish and design-system overhaul of the NEXSTORM geospatial intelligence interface. Prior to this stage, the frontend retained legacy, bloated neumorphism (sunken 30px pill cards, heavy `14px 14px 32px` shadows, low-contrast gray text, unescaped HTML entities, and unauthenticated CartoDB basemap tiles showing an "API KEY REQUIRED" watermark). Furthermore, preset display metrics claimed non-existent municipal pump telemetry, 88% drain surcharges, fabricated surface runoff velocities (2.84 m/s), and prohibited panic/safety terms.

This overhaul modernized NEXSTORM into a high-precision, WCAG-aligned, deterministic environmental-intelligence decision-support system. All CartoDB basemaps were migrated to clean, watermark-free OpenStreetMap tiles. Neumorphic bloat was replaced with crisp, white surface cards on a restrained `#F6F8FC` canvas with 1px subtle borders (`#E2E8F0`) and realistic elevation shadows. Unscientific claims were corrected with verified metrics from Copernicus 30m DEM, Google Open Buildings V3 (360,252 footprints), and OSM road network routing (14,855 segments / 28,418 graph nodes).

Visual verification was conducted using browser agents across Desktop (1440×900), Tablet/Laptop (1024×768), and Mobile (390×844) viewports. The entire quality verification suite passed with zero errors (`tsc --noEmit`, `eslint`, all 94 Vitest test suites / 895 unit & component tests, and Next.js 16 production build).

---

## 1. Main Visual Problems Identified

1. **Basemap API Key Watermark**: Both `BuildingMapCanvas.tsx` and `RoadMapCanvas.tsx` requested tiles from CartoDB Positron (`cartocdn.com/light_all/`), which rendered repetitive "API KEY REQUIRED carto.com/basemaps/apikey" watermarks across all map tiles.
2. **Excessive Neumorphism & Low Contrast**: Cards had 30px radii with dual inset/outset dark shadows (`14px 14px 32px #d5e0ee, -14px -14px 32px #ffffff`), creating muddy, sunken gray containers with low-contrast slate text (`#64748B` on `#E2E8F0`).
3. **Typography Inconsistencies & Collisions**: Reference CSS used tiny 9px–10px labels (`text-[10px]`, `text-[9px]`) for critical scientific metrics and buttons. Google Fonts were duplicated across CSS and `layout.tsx` without clean hierarchical roles.
4. **Unescaped Entities & Raw Emojis**: `OverviewSection.tsx` rendered raw unescaped HTML entity text `&nearr;` on the 250m grid launch button. Navbars and timeline headers used raw emojis (⚡, 🏛, 🛣) instead of accessible SVG primitives.
5. **Mobile/Tablet Navigation Collisions**: On mobile screens (390px), the navbar header collided, action buttons were clipped, and status pills wrapped into disjointed lines.
6. **Unscientific Claims & Restricted Safety Wording**:
   - Building cards displayed fake runoff velocities (`2.84 m/s`), pump surcharge (`88%`), and "Emergency Dispatches".
   - Road routing used prohibited words ("Recommended Safe", "High Safety Confidence 94/100", "+40 min delay") rather than modeled exposure scores and calibrated travel times.
   - About section claimed "PostGIS" and municipal pump deployment logs rather than Python GeoPandas/Shapely and historical news archives.

---

## 2. Coherent Design System & Token Architecture

The color palette and elevation system were centralized in `src/app/globals.css` and `src/styles/reference.css`:

### Color Tokens
- **Canvas / Background**: `#F6F8FC` (clean, restrained neutral canvas)
- **Primary Surfaces**: `#FFFFFF` (crisp white cards with `#E2E8F0` 1px borders)
- **Main Heading Text**: `#0F172A` (deep slate high-contrast text, WCAG AAA compliant)
- **Supporting / Body Text**: `#334155` (slate 700, WCAG AA compliant)
- **Muted Metadata**: `#64748B` (slate 500, restricted to non-critical metadata; min 12px)
- **Primary Brand Cobalt**: `#1D4ED8` (royal blue for primary actions and active tabs)
- **Deep Navy**: `#1E3A8A` (for technical badge accents)
- **Low-Risk Semantic**: `#15803D` (accessible forest green on `#ECFDF5` pale background)
- **Moderate-Risk Semantic**: `#92400E` (accessible amber on `#FEF3C7` pale background)
- **High-Risk Semantic**: `#B91C1C` (accessible crimson on `#FEE2E2` pale background)

### Elevation & Shadow Tokens
- Replaced muddy 30px neumorphic shadows with modern subtle elevation tokens:
  ```css
  --card-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 4px 14px -2px rgba(15, 23, 42, 0.04);
  --card-shadow-hover: 0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 12px 24px -4px rgba(15, 23, 42, 0.08);
  --btn-shadow: 0 1px 2px 0 rgba(15, 23, 42, 0.05);
  ```
- Standardized card radii to `16px` (`rounded-2xl`) and inner elements to `8px`–`12px`.

---

## 3. Typography & Hierarchy Refinements

- **Display & Section Headings**: Configured with `Outfit` (weights 600, 700, 800) using responsive fluid clamp sizing.
- **Body & Navigation**: Configured with `Plus Jakarta Sans` (weights 400, 500, 600, 700) with generous 1.6 line height for effortless readability.
- **Technical Badges & Identifiers**: Configured with `Space Grotesk` monospace tags for coordinate pairs and cell IDs.
- **Minimum Font Sizes**: Eliminated sub-11px text for meaningful content. All metrics, inputs, and button labels are comfortably readable at 13px–16px.

---

## 4. Components Refined

| Component | File Path | Improvements Implemented |
| :--- | :--- | :--- |
| **Global Styles** | `src/app/globals.css`, `src/styles/reference.css` | Centralized CSS tokens; removed 30px puffy neumorphism; streamlined elevations and borders; added fluid responsive typography rules. |
| **FrontendNavbar** | `src/components/home/FrontendNavbar.tsx` | Replaced emoji with Lucide `Droplets`; added responsive text (`Report Waterlogging` on desktop, `Report` on mobile); refined active nav pills; added `aria-label="About Us"`. |
| **OverviewSection** | `src/components/home/OverviewSection.tsx` | Fixed unescaped `&nearr;` to Lucide `ArrowUpRight`; updated metrics to truthful `360,252+` footprints and `1,998` cells; added `SCENARIO SIMULATOR: PRECIPITATION TEST` label with `Simulated Hyetograph Intensity` caveat; incorporated Lucide icons. |
| **BuildingsSection** | `src/components/home/BuildingsSection.tsx` | Replaced fake velocities (`2.84 m/s`), pump surcharge (`88%`), and dispatch squad with verified metric footprint areas (`1,420 m²`), catchment susceptibility ($s=0.88$), and unmodeled subsurface hydraulics disclaimer. |
| **BuildingMapCanvas** | `src/components/home/BuildingMapCanvas.tsx` | Migrated from CartoDB Positron to OpenStreetMap standard tiles (`tile.openstreetmap.org`), completely removing Carto "API KEY REQUIRED" watermark. |
| **RoadsSection** | `src/components/home/RoadsSection.tsx` | Replaced restricted words ("Recommended Safe", "High Safety Confidence 94/100", "+40 min delay") with "Lower Modeled Exposure (Recommended)", "Exposure Penalty: 14/100 (Caution)", "Higher Modeled Exposure Corridor (Avoid)", and uncalibrated 30 km/h baseline disclaimer. |
| **RoadMapCanvas** | `src/components/home/RoadMapCanvas.tsx` | Migrated tileLayer to OpenStreetMap standard tiles; ensured clean polyline coloring (`#059669` green for Route A, `#BE123C` red for Route B). |
| **AboutSection** | `src/components/home/AboutSection.tsx` | Replaced raw `⚡` with Lucide `Sparkles`; corrected tech stack badges from "PostGIS" to "GeoPandas / Shapely"; corrected data sources from "municipal pump station logs" to "historical news & verified incident records". |
| **HealthDiagnosticsModal** | `src/components/home/HealthDiagnosticsModal.tsx` | Updated building and road count to truthful 360,252 footprints and 14,855 road segments (28,418 graph nodes); refined high-contrast status cards. |
| **DisclaimerBanner** | `src/components/compliance/DisclaimerBanner.tsx` | Added clean spacing after colon; ensured WCAG AA amber contrast on research prototype notice. |

---

## 5. Unsupported / Hardcoded Display Values Corrected

1. **Hydraulic Velocity & Surcharge Claims**:
   - *Previous*: Displayed `Runoff Velocity: 2.84 m/s` and `Municipal Pump Surcharge: 88%`.
   - *Corrected*: Replaced with physical building footprint area (`1,420 m²`, `2,150 m²`) and Copernicus DEM catchment susceptibility score ($s = 0.88$, $s = 0.62$). Explicitly disclaimed: *"Plinth elevation & indoor depth unmodeled. Subsurface drainage hydraulics unmodeled."*
2. **Prohibited Safety Terminology**:
   - *Previous*: `Route A: Recommended Safe (High Safety Confidence 94/100)`, `Route B: +40 min delay`, `Elevated Safe Corridors`.
   - *Corrected*: `Route A: Lower Modeled Exposure (Exposure Score: 0.14 - Low)`, `Route B: High Inundation Risk (Exposure Score: 0.88 - Avoid)`, `~31 mins (30 km/h baseline)` and `Low-Exposure Arterials`.
3. **Database & Infrastructure Claims**:
   - *Previous*: Claimed `PostGIS`, `Live Telemetry`, and `Municipal Pump Station Logs`.
   - *Corrected*: Attributed to `GeoPandas / Shapely`, `Ground Truth Archive`, and `Routing Engine`.
4. **Footprint & Node Counts**:
   - *Previous*: Displayed placeholder `17,961 Buildings`.
   - *Corrected*: Synchronized with ingested Google Open Buildings V3 dataset (`360,252 Footprints`) and road routing graph (`14,855 Segments / 28,418 Nodes`).

---

## 6. Visual Verification Loop Performed

Using browser subagent inspection and image verification at multiple breakpoints:

### Desktop (1440 × 900)
- **Overview**: Verified hero composition, slider interaction (78% simulated hyetograph), Lucide icons, and 3-pillar cards.
- **Buildings**: Verified tile loading without watermarks; verified selected building card highlighting and docked HUD dossier.
- **Roads**: Verified route switching between Route A and Route B; verified HUD scores (14/100 vs 88/100) and underpass marker popup.
- **About**: Verified 6-stage pipeline layout with vertical connecting timeline.
- **Modals**: Verified Health Diagnostics modal (/api/health probes) and Observation Report modal (accessible form inputs and category selectors).

### Laptop / Tablet (1024 × 768)
- Verified two-column grids gracefully compress without content clipping or horizontal overflow.
- Verified header action buttons remain aligned and visible.

### Mobile (390 × 844)
- Verified navbar cleanly refactors: brand logo, horizontal scrolling tab list, and compact action buttons (`Report` and `Live Pipeline Status`).
- Verified typography scales down cleanly without clipped words or collisions.
- Verified map canvas retains 100% width and maps remain interactive on touch.

---

## 7. Verification & Automated Test Results

1. **TypeScript Check**:
   ```bash
   npm run typecheck
   # Output: tsc --noEmit -> Exit code: 0 (No type errors)
   ```
2. **ESLint**:
   ```bash
   npm run lint
   # Output: 0 errors, 0 warnings -> Exit code: 0
   ```
3. **Vitest Unit & Component Suite**:
   ```bash
   npm test
   # Output: 94 test files passed (94/94), 895 tests passed (895/895) -> Exit code: 0
   ```
4. **Production Build**:
   ```bash
   npm run build
   # Output: Compiled successfully in 4.0s; 27 static and dynamic routes compiled -> Exit code: 0
   ```

---

## 8. Remaining Architectural Notes & Next Steps

- **Dynamic Basemap Fallbacks**: OpenStreetMap standard tiles are fast, reliable, and completely watermark-free. For offline environments or air-gapped demo deployments, a local vector-tile cache or MBTiles server could be pre-bundled.
- **Building Polygon Overlay on Hover**: Currently, selecting a building focuses the map on its centroid with a marker and HUD dossier. If client-side WebGL performance allows, rendering individual GeoJSON polygon rings for all 360k buildings on viewport pan can be explored in future stages.
