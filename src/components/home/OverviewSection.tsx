'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Layers, Building2, Route, ArrowRight, ArrowUpRight, CheckCircle2, Play } from 'lucide-react'
import type { TabKey } from './FrontendNavbar'

interface OverviewSectionProps {
  onSwitchTab: (tab: TabKey) => void
}

export function OverviewSection({ onSwitchTab }: OverviewSectionProps) {
  // Interactive Hazard Precipitation Coupling Slider (Scenario Simulation)
  const [hazardPct, setHazardPct] = useState<number>(78)

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const pct = Math.min(Math.max(Math.round((clickX / rect.width) * 100), 5), 100)
    setHazardPct(pct)
  }

  let hazardBadgeText = 'Severe Storm Stress Test'
  let hazardBadgeStyle = { color: '#92400e', backgroundColor: '#fef3c7', borderColor: '#fde68a' }
  if (hazardPct <= 35) {
    hazardBadgeText = 'Dry Baseline Test'
    hazardBadgeStyle = { color: '#166534', backgroundColor: '#dcfce7', borderColor: '#bbf7d0' }
  } else if (hazardPct <= 70) {
    hazardBadgeText = 'Heavy Rainfall Stress Test'
    hazardBadgeStyle = { color: '#9a3412', backgroundColor: '#ffedd5', borderColor: '#fed7aa' }
  }

  return (
    <main className="tab-view active-view" id="view-overview">
      <div className="page-wrapper">
        {/* Top Hero Block with Real Flood Imagery Background */}
        <div className="hero-image-banner">
          <div className="hero-grid">
            {/* Left: Model Logic & Scientific Explanation */}
            <section className="hero-left-content">
              <div className="trust-pill">
                <span className="pill-sparkle">✦</span>
                <span className="pill-text">Scientific Multi-Tier Geospatial Intelligence</span>
              </div>

              <h1 className="hero-heading">
                Urban Flood Risk<br />
                <span className="heading-accent">Engineered for Reality</span>
                <span className="sr-only">NEXSTORM Urban Resilience System</span>
              </h1>

              <p className="hero-lead">
                Traditional weather forecasts report broad city-wide rainfall averages that fail to
                identify which streets become impassable or which basements face inundation.
                NEXSTORM executes deterministic spatial matching across real elevation contours,
                rainfall intensity, and drainage infrastructure.
              </p>

              <div className="hero-single-pill">
                <div className="beacon-pulse-dot"></div>
                <span className="pill-primary-tag">Operational Coupling</span>
                <span className="pill-dot-sep">&bull;</span>
                <span className="pill-sub-info">
                  Amritsar 250m Grid &bull; Copernicus 30m DEM Sinks &bull; Verified Historical Replay
                </span>
              </div>

              <div className="hero-button-row">
                <button
                  type="button"
                  className="btn-solid-primary cursor-pointer"
                  id="exploreBuildingsCta"
                  onClick={() => onSwitchTab('buildings')}
                >
                  <span>Inspect Building Exposure</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
                <button
                  type="button"
                  className="btn-neumorphic btn-secondary-action cursor-pointer"
                  id="exploreRoadsCta"
                  onClick={() => onSwitchTab('roads')}
                >
                  <span>Evaluate Road Routes</span>
                  <Play className="w-3.5 h-3.5 ml-1 fill-current" />
                </button>
                <Link
                  href="/city/amritsar"
                  className="btn-neumorphic px-5 py-3 text-xs font-bold text-slate-800 hover:text-blue-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Launch 250m Grid Console</span>
                  <ArrowUpRight className="w-4 h-4 text-blue-600" />
                </Link>
              </div>

              {/* Differentiated Color Metrics Row */}
              <div className="metrics-row">
                <div className="metric-block">
                  <span className="metric-number text-slate-900">360,252+</span>
                  <span className="metric-caption text-blue-700 font-semibold">
                    Mapped Urban Footprints
                  </span>
                </div>
                <div className="metric-block">
                  <span className="metric-number text-emerald-800">1,998</span>
                  <span className="metric-caption text-emerald-700 font-semibold">
                    Amritsar 250m Grid Cells
                  </span>
                </div>
                <div className="metric-block">
                  <span className="metric-number text-indigo-900">3-Tier</span>
                  <span className="metric-caption text-indigo-700 font-semibold">
                    Area • Building • Road
                  </span>
                </div>
              </div>
            </section>

            {/* Right: Modern Telemetry Cards */}
            <section
              className="hero-right-visualizer"
              aria-label="Live Model Telemetry Cards"
            >
              <div className="visualizer-cards-stack">
                {/* Card 1: Topographical Elevation Layer */}
                <div className="neuro-card visualizer-card">
                  <div className="card-header-flex">
                    <div className="icon-square-box">
                      <Layers className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <span className="meta-tag text-blue-700">LAYER 01: TERRAIN HYDROLOGY</span>
                      <h4 className="card-subhead text-slate-900">
                        Digital Elevation Model (Copernicus 30m)
                      </h4>
                    </div>
                  </div>
                  <div className="card-content-block">
                    <div className="data-indicator-row">
                      <span className="indicator-title text-slate-600">
                        Topographic Depressions in Amritsar
                      </span>
                      <span className="indicator-highlight text-blue-700 font-bold">
                        14 Verified Catchment Sinks
                      </span>
                    </div>
                    <div className="skeleton-shimmer bar-wide"></div>
                    <div className="skeleton-shimmer bar-half"></div>
                  </div>
                </div>

                {/* Card 2: Dynamic Scenario Stress Test Slider */}
                <div className="neuro-card visualizer-card">
                  <div className="flex justify-between items-baseline mb-3">
                    <div>
                      <span className="meta-tag text-indigo-700">
                        SCENARIO SIMULATOR: PRECIPITATION TEST
                      </span>
                      <div className="hazard-readout text-slate-900" id="hazardVal">
                        {hazardPct.toFixed(1)}%
                      </div>
                      <span className="readout-label text-slate-500">
                        Simulated Hyetograph Intensity
                      </span>
                    </div>
                    <span
                      className="status-chip chip-warning border px-2.5 py-1 rounded-full text-xs font-bold"
                      id="hazardRiskBadge"
                      style={hazardBadgeStyle}
                    >
                      {hazardBadgeText}
                    </span>
                  </div>

                  <div
                    className="progress-track cursor-pointer"
                    id="hazardTrack"
                    onClick={handleTrackClick}
                    title="Click or drag to test storm intensity"
                  >
                    <div
                      className="progress-fill"
                      id="hazardFill"
                      style={{ width: `${hazardPct}%` }}
                    >
                      <div className="progress-thumb"></div>
                    </div>
                  </div>

                  <div className="track-scale">
                    <span className="text-emerald-700 font-medium text-xs">0 mm/h (Dry Baseline)</span>
                    <span className="text-amber-700 font-medium text-xs">35 mm/h (Heavy Rain)</span>
                    <span className="text-rose-700 font-medium text-xs">80 mm/h (Cloudburst)</span>
                  </div>
                </div>

                {/* Card 3: Multi-Source Evidence Cross-Verification */}
                <div className="neuro-card visualizer-card">
                  <div className="card-header-flex">
                    <div className="dot-indicators-row">
                      <span className="signal-dot dot-verified" title="Meteorological feed active"></span>
                      <span className="signal-dot dot-active" title="Topographic sink aligned"></span>
                      <span className="signal-dot dot-stream" title="Road network matched"></span>
                    </div>
                    <div>
                      <span className="meta-tag text-emerald-700">
                        LAYER 03: GROUND TRUTH VALIDATION
                      </span>
                      <h4 className="card-subhead text-slate-900">
                        Tri-Source Evidence Verification
                      </h4>
                    </div>
                  </div>
                  <ul className="evidence-bullets-list">
                    <li>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-slate-600 text-xs">
                        Spatial intersection between road corridors &amp; low-elevation sinks
                      </span>
                    </li>
                    <li>
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="text-slate-600 text-xs">
                        Strict separation of static hazard, geographic exposure &amp; physical vulnerability
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Expansive 3-Pillar Architectural Deep-Dive Section */}
        <section className="deep-dive-section">
          <div className="section-title-wrap">
            <span className="meta-tag text-blue-700">CORE SYSTEM ARCHITECTURE</span>
            <h2 className="sub-section-heading">
              The Three Pillars of Urban Waterlogging Intelligence
            </h2>
            <p className="sub-section-desc">
              NEXSTORM evaluates the city as a unified ecosystem of interdependent geographic
              layers, ensuring every assessment is explainable, transparent, and grounded in
              real-world measurements.
            </p>
          </div>

          <div className="three-pillars-grid">
            {/* Pillar A */}
            <div className="neuro-card pillar-card">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="pillar-title text-slate-900">Pillar A — Area Susceptibility</h3>
              <p className="pillar-body text-slate-600 text-sm leading-relaxed">
                Combines Copernicus DEM terrain slope, low-lying depression indices, and historical
                waterlogging hotspots into a persistent susceptibility grid across metropolitan
                zones. Distinguishes baseline vulnerability from dynamic weather hazard.
              </p>
              <div className="pillar-footer pt-4 border-t border-slate-100 flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Resolution: 250m grid (1,998 cells)</span>
                <span className="text-blue-700 font-bold">&bull; Verified DEM</span>
              </div>
            </div>

            {/* Pillar B */}
            <div className="neuro-card pillar-card">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-4">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="pillar-title text-slate-900">
                Pillar B — Building Footprint Exposure
              </h3>
              <p className="pillar-body text-slate-600 text-sm leading-relaxed">
                Evaluates individual structure polygons against localized terrain depressions and
                macro-catchment overlap in UTM 43N. Explicitly avoids fabricating plinth heights or
                indoor damage to maintain scientific honesty.
              </p>
              <div className="pillar-footer pt-4 border-t border-slate-100 flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Coverage: 360,252 structures</span>
                <span className="text-emerald-700 font-bold">&bull; Google Open Buildings</span>
              </div>
            </div>

            {/* Pillar C */}
            <div className="neuro-card pillar-card">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 mb-4">
                <Route className="w-5 h-5" />
              </div>
              <h3 className="pillar-title text-slate-900">
                Pillar C — Road Inundation &amp; Routing
              </h3>
              <p className="pillar-body text-slate-600 text-sm leading-relaxed">
                Associates connected road network segments with terrain elevation sinks and
                underpass sumps. Computes sub-2ms A* flood-aware route comparison prioritizing lower
                modeled exposure corridors.
              </p>
              <div className="pillar-footer pt-4 border-t border-slate-100 flex justify-between text-xs font-semibold">
                <span className="text-slate-500">Network: 14,853 segments (28,418 nodes)</span>
                <span className="text-indigo-700 font-bold">&bull; A* Pathfinding</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

