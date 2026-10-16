'use client'

import React from 'react'
import type { TabKey } from './FrontendNavbar'

export interface AboutSectionProps {
  onSwitchTab?: (tab: TabKey) => void
}

export function AboutSection(props: AboutSectionProps = {}) {
  void props

  return (
    <section className="tab-view active-view" id="view-about">
      {/* Centered Document Wrapper: Perfectly centered in the viewport with generous breathing room */}
      <div className="w-full flex justify-center py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
        <article className="w-full max-w-4xl space-y-14 text-slate-800">
          {/* Document Header */}
          <header className="border-b border-slate-200 pb-8 space-y-3">
            <div className="text-xs font-semibold tracking-wider uppercase text-blue-700 font-mono">
              Platform Documentation &amp; Technical Reference
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-display">
              About NEXSTORM
            </h1>
            <h2 className="text-xl sm:text-2xl font-bold text-blue-800 font-display">
              Scientific Urban Waterlogging Intelligence
            </h2>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-3xl pt-1">
              An explainable, deterministic geospatial intelligence platform engineered for urban
              waterlogging resilience in Indian cities. This reference documents our data sources,
              computational algorithms, risk methodology, and system implementation.
            </p>
          </header>

          {/* 1. About NEXSTORM */}
          <section aria-labelledby="section-about" className="space-y-5 pt-2">
            <h2
              id="section-about"
              className="text-2xl sm:text-3xl font-bold text-slate-900 font-display pb-3 border-b border-slate-200"
            >
              1. About NEXSTORM
            </h2>

            <p className="text-base leading-relaxed text-slate-700">
              NEXSTORM is an experimental environmental-intelligence and geospatial decision-support
              platform designed to mitigate the hazards of urban pluvial waterlogging in Indian
              cities. During the monsoon season, high-intensity convective cloudbursts routinely
              overwhelm municipal drainage infrastructure. The combination of dense impervious
              built-up surfaces, localized topographic depressions, and drainage bottlenecks causes
              streets to submerge rapidly, paralyzing transit corridors and endangering residents.
            </p>

            <p className="text-base leading-relaxed text-slate-700">
              Standard regional meteorological forecasts provide broad municipal-wide precipitation
              totals that lack the spatial resolution necessary to evaluate localized surface runoff
              or identify which specific roads and neighborhoods are at risk. NEXSTORM bridges this
              critical gap by coupling numerical weather forecasting with high-resolution satellite
              digital elevation models, comprehensive building footprints, and topological road
              networks into a deterministic, auditable early-warning framework.
            </p>

            <p className="text-base leading-relaxed text-slate-700">
              Piloted in Amritsar, Punjab (31.634° N, 74.872° E), the platform serves three primary
              groups of stakeholders:
            </p>

            <ul className="space-y-3 pl-6 list-disc text-base leading-relaxed text-slate-700">
              <li>
                <strong>Municipal Authorities &amp; Emergency Teams:</strong> Gain high-resolution
                spatial situational awareness across 250m grid cells, identify vulnerable low-lying
                chokepoints (such as railway underpass sumps), and simulate customizable storm
                scenarios to position response crews proactively.
              </li>
              <li>
                <strong>Transit Operators &amp; Urban Planners:</strong> Evaluate road corridor
                inundation hazards, plan alternative flood-aware routes between critical transit
                nodes (such as railway stations and international airports), and prioritize
                long-term drainage interventions.
              </li>
              <li>
                <strong>Citizens &amp; Field Observers:</strong> Inspect localized building-level
                catchment exposure, track official government weather warnings from NDMA SACHET, and
                contribute verified ground observations with privacy-preserving reporting controls.
              </li>
            </ul>
          </section>

          {/* 2. How NEXSTORM Works */}
          <section aria-labelledby="section-how-it-works" className="space-y-5 pt-4">
            <h2
              id="section-how-it-works"
              className="text-2xl sm:text-3xl font-bold text-slate-900 font-display pb-3 border-b border-slate-200"
            >
              2. How NEXSTORM Works
            </h2>

            <p className="text-base leading-relaxed text-slate-700">
              NEXSTORM processes real-world geospatial and meteorological data through a
              deterministic six-stage pipeline that translates raw environmental observations into
              actionable decision support:
            </p>

            <ol className="space-y-4 pl-6 list-decimal text-base leading-relaxed text-slate-700">
              <li>
                <strong>Satellite &amp; Terrain Data Acquisition:</strong> The platform ingests
                numerical weather forecasts from global meteorological models (ECMWF and GFS via
                Open-Meteo), terrain elevation rasters from satellite earth observation (Copernicus DEM
                GLO-30 at 30m resolution), surface land-cover classifications (ESA WorldCover at 10m
                resolution), building footprint polygons (Google Open Buildings V3), and road network
                geometries (OpenStreetMap).
              </li>
              <li>
                <strong>Topographic Depression Detection &amp; Spatial Preprocessing:</strong> Geographic
                coordinates are reprojected from WGS84 into metric UTM Zone 43N (EPSG:32643) to eliminate
                cartographic distance distortion. The city boundary is subdivided into a uniform 250m ×
                250m Cartesian analysis grid (62,500 m² per cell). Hydrological fill-and-spill
                algorithms identify closed terrain hollows where surface water naturally pools, while
                land-cover rasters calculate impervious surface fractions.
              </li>
              <li>
                <strong>Hydrological Susceptibility &amp; Rainfall Trigger Computation:</strong> For
                each grid cell, a static susceptibility score (S) is calculated from depression depth,
                slope flatness, and structural built-up density. Concurrently, dynamic rainfall
                accumulations across rolling 1-hour, 3-hour, 24-hour, and 72-hour windows are evaluated
                against 15-year historical monsoon climatology thresholds to derive the dynamic Rainfall
                Trigger Index (RTI).
              </li>
              <li>
                <strong>Urban Feature Intersection (Buildings &amp; Corridors):</strong> Over 360,000
                building footprints and 14,855 road segments in Amritsar are spatially joined with the
                underlying 250m susceptibility grid. Road segments inherit maximum cell susceptibility
                scores, with known historical depression traps (such as railway underpasses) receiving
                baseline hazard offsets.
              </li>
              <li>
                <strong>Ground-Truth &amp; Multimodal Evidence Fusion:</strong> When citizens submit
                field observations or geotagged smartphone photos, multimodal AI vision models extract
                qualitative physical proxies (e.g. road passability, curb ponding, doorstep inundation)
                and fuse them mathematically into composite scores while enforcing strict spatial
                proximity bounds and asymmetric safety floors.
              </li>
              <li>
                <strong>Real-Time Civic Intelligence Dashboard:</strong> Processed assessments are
                delivered via interactive Leaflet map interfaces, individual building dossiers,
                customizable storm hyetograph simulators, and flood-aware A* route comparisons with
                transparent data provenance metadata.
              </li>
            </ol>
          </section>

          {/* 3. Our Data Sources */}
          <section aria-labelledby="section-data-sources" className="space-y-5 pt-4">
            <h2
              id="section-data-sources"
              className="text-2xl sm:text-3xl font-bold text-slate-900 font-display pb-3 border-b border-slate-200"
            >
              3. Our Data Sources
            </h2>

            <p className="text-base leading-relaxed text-slate-700">
              NEXSTORM is powered exclusively by verifiable public datasets, satellite remote sensing,
              and documented archival records. The platform does not synthesize or invent data. The table
              below summarizes all operational datasets:
            </p>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white my-4 shadow-xs">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                  <tr>
                    <th className="py-3 px-4">Dataset Name &amp; Link</th>
                    <th className="py-3 px-4">Type &amp; Resolution</th>
                    <th className="py-3 px-4">Update Cadence</th>
                    <th className="py-3 px-4">Operational Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <a
                        href="https://open-meteo.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:text-blue-900 underline font-medium"
                      >
                        Open-Meteo Weather API
                      </a>
                    </td>
                    <td className="py-3 px-4">ECMWF &amp; GFS numerical forecasts</td>
                    <td className="py-3 px-4">6-hour forecast cycle (cached)</td>
                    <td className="py-3 px-4">
                      Supplies hourly precipitation series for dynamic Rainfall Trigger Index (RTI).
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <a
                        href="https://spacedata.copernicus.eu"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:text-blue-900 underline font-medium"
                      >
                        Copernicus DEM GLO-30
                      </a>
                    </td>
                    <td className="py-3 px-4">ESA 30m Digital Elevation Model</td>
                    <td className="py-3 px-4">Static satellite raster</td>
                    <td className="py-3 px-4">
                      Derives slope flatness, closed depression sinks (fill-and-spill), and low points.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <a
                        href="https://esa-worldcover.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:text-blue-900 underline font-medium"
                      >
                        ESA WorldCover 2021
                      </a>
                    </td>
                    <td className="py-3 px-4">10m global land cover raster</td>
                    <td className="py-3 px-4">Static earth observation raster</td>
                    <td className="py-3 px-4">
                      Calculates impervious built-up surface fractions (f_builtUp) per grid cell.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <a
                        href="https://sites.research.google/open-buildings/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:text-blue-900 underline font-medium"
                      >
                        Google Open Buildings V3
                      </a>
                    </td>
                    <td className="py-3 px-4">360,252 building polygon footprints</td>
                    <td className="py-3 px-4">Static vector geometries</td>
                    <td className="py-3 px-4">
                      Powers building-level exposure analysis, metric footprint areas, and dossiers.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <a
                        href="https://www.openstreetmap.org"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:text-blue-900 underline font-medium"
                      >
                        OpenStreetMap (OSM)
                      </a>
                    </td>
                    <td className="py-3 px-4">14,855 road segments, 37,924 edges</td>
                    <td className="py-3 px-4">Static topological graph</td>
                    <td className="py-3 px-4">
                      Enables flood-aware route comparison and identifies low-lying underpasses.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <a
                        href="https://sachet.ndma.gov.in"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:text-blue-900 underline font-medium"
                      >
                        NDMA SACHET CAP Feed
                      </a>
                    </td>
                    <td className="py-3 px-4">Official Common Alerting Protocol</td>
                    <td className="py-3 px-4">Live advisory stream</td>
                    <td className="py-3 px-4">
                      Integrates authoritative government weather advisories and flood warnings for Punjab.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      <a
                        href="https://www.mapillary.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 hover:text-blue-900 underline font-medium"
                      >
                        Mapillary Graph API v4
                      </a>
                    </td>
                    <td className="py-3 px-4">Street-level survey photography</td>
                    <td className="py-3 px-4">Historical baseline survey</td>
                    <td className="py-3 px-4">
                      Provides ground-level street photography for baseline vulnerability inspection.
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">Municipal &amp; News Archives</td>
                    <td className="py-3 px-4">15 documented historical inundation records</td>
                    <td className="py-3 px-4">Archival reference inventory</td>
                    <td className="py-3 px-4">
                      Calibrates empirical RTI thresholds and validates spatial hotspot detection.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-sm text-slate-700">
              <h4 className="font-bold text-slate-900">Verified Physical Data Boundaries:</h4>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
                <li>
                  <strong>Absence of Live IoT Rain Gauges:</strong> Meteorological inputs originate from
                  6-hour numerical model runs (ECMWF/GFS), not continuously connected minute-by-minute
                  physical rain gauges.
                </li>
                <li>
                  <strong>Satellite Cloud Blindness &amp; Revisit Cadence:</strong> Optical satellites
                  (e.g., Sentinel-2) are 100% blind under dense monsoon cloud cover. Radar satellites
                  (Sentinel-1 C-SAR) penetrate clouds but have a 12-day orbit revisit interval, making
                  orbital spaceborne sensors unviable for real-time 1-hour flash warnings.
                </li>
                <li>
                  <strong>Cross-City Readiness Gap:</strong> Amritsar is fully calibrated with 360,252 building
                  footprints and historical records (status: <code>evaluation_ready</code>). In contrast,
                  Jalandhar is an exploratory pilot with physical terrain and road data, but without indexed
                  building footprints (status: <code>evidence_insufficient</code>, live alerts suppressed).
                </li>
              </ul>
            </div>
          </section>

          {/* 4. Algorithms and Methodology */}
          <section aria-labelledby="section-methodology" className="space-y-5 pt-4">
            <h2
              id="section-methodology"
              className="text-2xl sm:text-3xl font-bold text-slate-900 font-display pb-3 border-b border-slate-200"
            >
              4. Algorithms and Methodology
            </h2>

            <p className="text-base leading-relaxed text-slate-700">
              NEXSTORM computes relative waterlogging risk through deterministic mathematical
              formulations, spatial matching, and multi-criteria indexing:
            </p>

            <div className="space-y-5 text-base text-slate-700 leading-relaxed">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  A. Metric Coordinate Transformation &amp; Spatial Discretization
                </h3>
                <p>
                  To eliminate cartographic distortion in distance and area calculations, geographic
                  coordinates are projected to Universal Transverse Mercator (UTM Zone 43N, EPSG:32643),
                  where scale distortion across Amritsar is below 0.05%. The municipal boundary is
                  partitioned into 1,998 uniform 250m × 250m Cartesian cells (62,500 m² each),
                  providing an area-consistent spatial basis for all calculations.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  B. Static Multi-Criteria Susceptibility Index (S)
                </h3>
                <p>
                  Static runoff accumulation propensity is evaluated for each cell as a linear weighted
                  sum of five normalized geospatial factors:
                </p>
                <div className="p-3.5 my-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-900 overflow-x-auto">
                  S = 0.30·f_depression + 0.30·f_builtUp + 0.15·f_lowPoint + 0.15·f_density + 0.10·f_flatness
                </div>
                <ul className="list-disc pl-6 space-y-1 text-sm text-slate-700">
                  <li>
                    <code>f_depression</code> (30%): Depth of closed topographic depressions computed via
                    hydrological fill-and-spill analysis on Copernicus 30m DEM.
                  </li>
                  <li>
                    <code>f_builtUp</code> (30%): Fraction of impervious surface area derived from ESA
                    WorldCover 10m raster, representing reduced natural soil infiltration.
                  </li>
                  <li>
                    <code>f_lowPoint</code> (15%): Binary indicator of whether the cell contains the
                    minimum elevation in its local 3×3 cell neighborhood.
                  </li>
                  <li>
                    <code>f_density</code> (15%): Structural density of building footprints and urban
                    fabric from OpenStreetMap and building geometries.
                  </li>
                  <li>
                    <code>f_flatness</code> (10%): Inverse slope score, reflecting terrain flatness where
                    gravitational drainage is impeded.
                  </li>
                </ul>
                <p className="mt-2 text-sm text-slate-600">
                  Susceptibility is partitioned into three operational bands: Low (S &lt; 0.33), Mid
                  (0.33 ≤ S ≤ 0.66), and High (S &gt; 0.66).
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  C. Dynamic Rainfall Trigger Index (RTI)
                </h3>
                <p>
                  Pluvial urban waterlogging is triggered by both rapid convective downpours and cumulative
                  soil saturation from antecedent rainfall. NEXSTORM evaluates rolling trailing accumulations
                  across four temporal windows:
                </p>
                <div className="p-3.5 my-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-900 overflow-x-auto">
                  RTI = max( P_1h / 3.5, P_3h / 8.9, P_24h / 64.5, (P_72h + antecedent_72h) / 44.8 )
                </div>
                <p className="text-sm text-slate-600">
                  Threshold denominators are calibrated against 15 monsoon seasons (2010–2024 JJAS ERA5-Land
                  reanalysis). The 24h threshold (64.5 mm) corresponds to the India Meteorological Department
                  (IMD) Heavy Rain standard. RTI is mapped into: None (&lt; 0.5), Elevated (0.5–1.0), Severe
                  (1.0–1.5), and Extreme (≥ 1.5).
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  D. 2D Susceptibility-Rainfall Risk Matrix
                </h3>
                <p>
                  Continuous RTI and susceptibility bands are combined deterministically through a 12-cell matrix:
                </p>
                <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white my-3">
                  <table className="w-full text-center border-collapse text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3.5 text-left">Susceptibility Band (S)</th>
                        <th className="py-2.5 px-3.5">RTI: None (&lt;0.5)</th>
                        <th className="py-2.5 px-3.5">RTI: Elevated (0.5–1.0)</th>
                        <th className="py-2.5 px-3.5">RTI: Severe (1.0–1.5)</th>
                        <th className="py-2.5 px-3.5">RTI: Extreme (≥1.5)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="py-2.5 px-3.5 text-left font-bold text-slate-800">Low (S &lt; 0.33)</td>
                        <td className="py-2.5 px-3.5 text-emerald-700">Low</td>
                        <td className="py-2.5 px-3.5 text-emerald-700">Low</td>
                        <td className="py-2.5 px-3.5 text-emerald-700">Low</td>
                        <td className="py-2.5 px-3.5 text-amber-700">Moderate</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 text-left font-bold text-slate-800">Mid (0.33 ≤ S ≤ 0.66)</td>
                        <td className="py-2.5 px-3.5 text-emerald-700">Low</td>
                        <td className="py-2.5 px-3.5 text-emerald-700">Low</td>
                        <td className="py-2.5 px-3.5 text-amber-700">Moderate</td>
                        <td className="py-2.5 px-3.5 text-rose-700">High</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3.5 text-left font-bold text-slate-800">High (S &gt; 0.66)</td>
                        <td className="py-2.5 px-3.5 text-emerald-700">Low</td>
                        <td className="py-2.5 px-3.5 text-amber-700">Moderate</td>
                        <td className="py-2.5 px-3.5 text-rose-700">High</td>
                        <td className="py-2.5 px-3.5 text-rose-700">High</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">
                  E. Multimodal Vision &amp; Mathematical Risk Fusion
                </h3>
                <p>
                  When ground-level smartphone photos are submitted, multimodal AI vision models (Google
                  Gemini 1.5 Flash, OpenAI GPT-4o-mini, or deterministic rules) extract qualitative physical
                  proxies (e.g. road passability, curb ponding, doorstep inundation) validated strictly with Zod.
                </p>
                <div className="p-3.5 my-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm text-slate-900 overflow-x-auto">
                  R_final = clamp( (1 - w·q)·R_base + (w·q)·R_visual, 0, 100 )
                </div>
                <p className="text-sm text-slate-600">
                  Reliability <code>q</code> combines distance decay (≤25m for roads, ≤35m for buildings)
                  and temporal freshness (&lt;24h for active storms). An asymmetric safety floor enforces
                  that dry photos can reduce base modeled risk by at most 15% (<code>R_final ≥ 0.85·R_base</code>),
                  ensuring a localized dry spot cannot override upstream catchment deluge risk.
                </p>
              </div>
            </div>
          </section>

          {/* 5. Understanding Risk Assessments */}
          <section aria-labelledby="section-understanding-risk" className="space-y-5 pt-4">
            <h2
              id="section-understanding-risk"
              className="text-2xl sm:text-3xl font-bold text-slate-900 font-display pb-3 border-b border-slate-200"
            >
              5. Understanding Risk Assessments
            </h2>

            <p className="text-base leading-relaxed text-slate-700">
              Risk scores represent relative spatial propensity for surface runoff pooling, not guaranteed
              disaster outcomes. The three operational tiers indicate:
            </p>

            <ul className="space-y-3 pl-6 list-disc text-base leading-relaxed text-slate-700">
              <li>
                <strong>Low Risk:</strong> Current and projected precipitation is within normal natural
                and built drainage absorption capacity. Surface runoff is minimal and confined to roadside
                gutters and stormwater inlets.
              </li>
              <li>
                <strong>Moderate Risk:</strong> Runoff volume exceeds absorption in localized depressions
                and high-impervious sectors. Water ponding is expected; caution is advised for low-clearance
                vehicles and pedestrian crossings.
              </li>
              <li>
                <strong>High Risk:</strong> Intense convective or prolonged rainfall over vulnerable
                catchments. Water accumulation exceeds local drainage limits. Waterlogging is expected
                across low-lying corridors and underpass chokepoints.
              </li>
            </ul>

            <h3 className="text-lg font-bold text-slate-900 pt-2">
              Distinguishing Data Categories:
            </h3>

            <ul className="space-y-2 pl-6 list-disc text-sm text-slate-700">
              <li>
                <strong>Measured Ground Data:</strong> Historical municipal flood logs, audited news
                reports, and corroborated citizen field observations.
              </li>
              <li>
                <strong>Model-Derived Estimates:</strong> Open-Meteo numerical weather forecast series
                and Copernicus DEM digital elevation slopes.
              </li>
              <li>
                <strong>Deterministic Heuristics:</strong> Multi-criteria factor weights, matrix
                combination rules, and underpass chokepoint hazard offsets.
              </li>
              <li>
                <strong>AI-Generated Interpretations:</strong> Qualitative visual classifications
                (passability, water extent) extracted with bounded confidence scores.
              </li>
            </ul>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 space-y-1.5 mt-2">
              <span className="font-bold text-slate-900 block">Scientific Boundary &amp; Disclaimers:</span>
              <p className="leading-relaxed">
                NEXSTORM does <strong>NOT</strong> predict flood depth in centimeters, forecast basement
                flooding, or simulate underground pipe hydraulic surcharge. It does <strong>NOT</strong> issue
                official emergency or evacuation orders. Always consult authoritative advisories from the India
                Meteorological Department (IMD) and National Disaster Management Authority (NDMA SACHET).
              </p>
            </div>
          </section>

          {/* 6. Buildings and Routes */}
          <section aria-labelledby="section-buildings-routes" className="space-y-5 pt-4">
            <h2
              id="section-buildings-routes"
              className="text-2xl sm:text-3xl font-bold text-slate-900 font-display pb-3 border-b border-slate-200"
            >
              6. Buildings and Routes
            </h2>

            <div className="space-y-5 text-base text-slate-700 leading-relaxed">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">Building Exposure Assessment</h3>
                <p>
                  NEXSTORM integrates 360,252 individual building footprints from Google Open Buildings
                  V3 across Amritsar. Each structure is spatially intersected with the 250m susceptibility
                  grid and Copernicus DEM terrain depressions. Interactive building dossiers report metric
                  footprint area ($m^2$), terrain elevation above sea level, and surrounding catchment
                  susceptibility ($s \in [0, 1]$).
                </p>
                <p className="mt-1 text-sm text-slate-600 italic">
                  Important Distinction: Building exposure reflects the runoff pooling propensity of the
                  surrounding terrain parcel. It does NOT predict indoor water ingress or structural damage,
                  as building plinth heights above street grade are not captured in public cadastral datasets.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1.5">Road-Segment Risk &amp; Flood-Aware Routing</h3>
                <p>
                  The road network model incorporates 14,855 road segments and 37,924 edges in Amritsar
                  derived from OpenStreetMap. Each segment inherits the maximum susceptibility of its
                  intersecting cells. Known historical sump traps (such as the Rego Bridge railway underpass
                  bowl) are assigned an automatic +20 point hazard offset.
                </p>
                <p className="mt-2">
                  The origin-to-destination routing engine utilizes A* and Dijkstra pathfinding over the
                  topologically noded graph. Candidate routes (for example, connecting Amritsar Railway
                  Station to Sri Guru Ram Dass Jee International Airport) are compared across:
                </p>
                <ul className="list-disc pl-6 space-y-1 text-sm mt-1 text-slate-700">
                  <li>Distance through high and moderate susceptibility corridors</li>
                  <li>Number of low-lying underpass chokepoints along the path</li>
                  <li>Active ground-truth citizen reports and verified flooded road segments</li>
                  <li>Visual flood impedance penalties (+25 to +30 points for verified photo evidence)</li>
                </ul>
                <p className="mt-2 text-sm text-slate-600">
                  Routes receive a composite exposure penalty score (0–100) and recommendation tier
                  (<code>recommended</code>, <code>caution</code>, or <code>avoid</code>). Travel times are
                  estimated using a constant 30 km/h baseline velocity without dynamic vehicular traffic
                  congestion feeds.
                </p>
              </div>
            </div>
          </section>

          {/* 7. Technical Implementation */}
          <section aria-labelledby="section-technical" className="space-y-5 pt-4">
            <h2
              id="section-technical"
              className="text-2xl sm:text-3xl font-bold text-slate-900 font-display pb-3 border-b border-slate-200"
            >
              7. Technical Implementation
            </h2>

            <p className="text-base leading-relaxed text-slate-700">
              NEXSTORM is constructed as a modern, modular web application combining a Next.js full-stack
              architecture with an offline geospatial data engineering pipeline:
            </p>

            <ul className="space-y-3 pl-6 list-disc text-base leading-relaxed text-slate-700">
              <li>
                <strong>Frontend &amp; Visualization:</strong> Next.js 16 (App Router with Turbopack),
                React 19, TypeScript in strict mode, and Tailwind CSS v4. Map visualization uses Leaflet.js
                with unwatermarked OpenStreetMap standard tiles requiring zero proprietary map tokens.
              </li>
              <li>
                <strong>Hydrological Engine &amp; APIs:</strong> In-memory TypeScript risk matrix engine
                evaluating 51 ensemble members across 2,500 cells and 48 forecast hours in under 40ms.
                Dedicated Next.js Route Handlers serve weather feeds, risk grids, buildings, and routing.
              </li>
              <li>
                <strong>Geospatial Processing Pipeline:</strong> Offline Python 3.11 pipeline in{' '}
                <code>pipeline/</code> leveraging GeoPandas, Shapely, Rasterio, and SciPy for DEM raster
                stitching, metric UTM reprojection, and building footprint joins.
              </li>
              <li>
                <strong>Validation &amp; Storage Architecture:</strong> Zod validation on all API
                boundaries; SHA-256 frozen configuration verification; Supabase PostgreSQL/PostGIS in
                production with serialized file-based queue mutexes for zero-dependency local development.
              </li>
            </ul>
          </section>

          {/* 8. Limitations and Future Improvements */}
          <section aria-labelledby="section-limitations" className="space-y-5 pt-4">
            <h2
              id="section-limitations"
              className="text-2xl sm:text-3xl font-bold text-slate-900 font-display pb-3 border-b border-slate-200"
            >
              8. Limitations and Future Improvements
            </h2>

            <div className="space-y-5 text-base text-slate-700 leading-relaxed">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Verified Current Limitations:</h3>
                <ul className="list-disc pl-6 space-y-1.5 text-sm text-slate-700">
                  <li>
                    <strong>No Underground Storm Sewer Hydraulics:</strong> The platform evaluates surface
                    topography and runoff accumulation. It does not model subterranean pipe diameters,
                    inlet catch-basin clogging, backflow surcharges, or municipal pumping stations.
                  </li>
                  <li>
                    <strong>Macro-Cell Spatial Smoothing:</strong> The 250m grid resolution averages
                    micro-topography across each 62,500 m² cell, smoothing out minor localized road curbs,
                    speed bumps, and localized drainage ditches.
                  </li>
                  <li>
                    <strong>Absence of Real-Time Traffic Feeds:</strong> Route travel duration uses an
                    idealized 30 km/h baseline velocity rather than live vehicle congestion feeds.
                  </li>
                  <li>
                    <strong>Building Plinth Height Unknown:</strong> Google Open Buildings captures 2D
                    footprints; finished ground-floor elevations above street grade are unrecorded.
                  </li>
                  <li>
                    <strong>Multi-City Calibration Disparity:</strong> Amritsar is fully calibrated with 15
                    documented historical waterlogging records across 7 verified storms. Jalandhar remains in
                    an exploratory status (<code>evidence_insufficient</code>) with building footprints
                    unindexed and alert dispatches suppressed.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-bold text-blue-950 mb-2">Planned Future Improvements:</h3>
                <ul className="list-disc pl-6 space-y-1.5 text-sm text-slate-700">
                  <li>
                    Integration of municipal storm drain vector blueprints and pump station SCADA telemetry.
                  </li>
                  <li>
                    High-resolution drone LiDAR surveys and sub-meter digital surface models (DSM) for
                    street-level micro-drainage analysis.
                  </li>
                  <li>
                    Automated IoT ultrasonic water-level sensor nodes deployed at historical underpass sumps.
                  </li>
                  <li>
                    Expansion of calibrated models to Ludhiana, Patiala, and Jalandhar once official municipal
                    flood incident logs are obtained.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* 9. The Team */}
          <section aria-labelledby="section-the-team" className="space-y-4 pt-6 border-t border-slate-200">
            <h2
              id="section-the-team"
              className="text-2xl sm:text-3xl font-bold text-slate-900 font-display pb-3 border-b border-slate-200"
            >
              The Team
            </h2>
            <p className="text-base sm:text-lg leading-relaxed text-slate-700">
              NEXSTORM is built by a team passionate about technology, geospatial intelligence, and creating
              practical solutions to real-world challenges. The team behind the project is Saksham Gupta,
              Roopanshi Sharma, Jasmine Kaur, and Manvi.
            </p>
          </section>
        </article>
      </div>
    </section>
  )
}
