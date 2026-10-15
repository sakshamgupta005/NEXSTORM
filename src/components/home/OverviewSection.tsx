'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import type { TabKey } from './FrontendNavbar'

interface OverviewSectionProps {
  onSwitchTab: (tab: TabKey) => void
}

export function OverviewSection({ onSwitchTab }: OverviewSectionProps) {
  // Interactive Hazard Precipitation Coupling Slider
  const [hazardPct, setHazardPct] = useState<number>(78)

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const pct = Math.min(Math.max(Math.round((clickX / rect.width) * 100), 5), 100)
    setHazardPct(pct)
  }

  let hazardBadgeText = 'Severe Storm Alert'
  let hazardBadgeStyle = { color: '#92400e', backgroundColor: '#fef3c7' }
  if (hazardPct <= 35) {
    hazardBadgeText = 'Dry Ground Conditions'
    hazardBadgeStyle = { color: '#065f46', backgroundColor: '#d1fae5' }
  } else if (hazardPct <= 70) {
    hazardBadgeText = 'Moderate Surface Runoff'
    hazardBadgeStyle = { color: '#b45309', backgroundColor: '#fed7aa' }
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
                <span className="sr-only">Hackathon Starter Foundation</span>
              </h1>

              <p className="hero-lead">
                Traditional weather apps report broad city-wide rainfall averages that fail to
                identify which streets become impassable or which basements face inundation.
                NEXSTORM executes deterministic spatial matching across real elevation contours,
                rainfall intensity, and drainage infrastructure.
              </p>

              <div className="hero-single-pill">
                <div className="beacon-pulse-dot"></div>
                <span className="pill-primary-tag">Live Spatial Coupling</span>
                <span className="pill-dot-sep">&bull;</span>
                <span className="pill-sub-info">
                  Amritsar Pilot Grid &bull; Copernicus 30m DEM Sinks &bull; ERA5 Stream Synced
                </span>
              </div>

              <div className="hero-button-row">
                <button
                  type="button"
                  className="btn-solid-primary"
                  id="exploreBuildingsCta"
                  onClick={() => onSwitchTab('buildings')}
                >
                  <span>Inspect Building Exposure</span>
                  <span className="btn-arrow">&rarr;</span>
                </button>
                <button
                  type="button"
                  className="btn-neumorphic btn-secondary-action"
                  id="exploreRoadsCta"
                  onClick={() => onSwitchTab('roads')}
                >
                  <span>Evaluate Road Routes</span>
                  <span className="play-icon">▶</span>
                </button>
                <Link
                  href="/city/amritsar"
                  className="btn-neumorphic px-5 py-3 text-xs font-bold text-slate-800 hover:text-blue-700 transition flex items-center gap-1.5"
                >
                  <span>Launch 250m Grid Console</span>
                  <span className="text-blue-600">&nearr;</span>
                </Link>
              </div>

              {/* Differentiated Color Metrics Row */}
              <div className="metrics-row">
                <div className="metric-block">
                  <span className="metric-number text-slate-900">17,961+</span>
                  <span className="metric-caption text-blue-700 font-semibold">
                    Mapped Urban Footprints
                  </span>
                </div>
                <div className="metric-block">
                  <span className="metric-number text-emerald-800">250m²</span>
                  <span className="metric-caption text-emerald-700 font-semibold">
                    Continuous Grid Cells
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

            {/* Right: Neumorphic Floating Visualizer Cards */}
            <section
              className="hero-right-visualizer"
              aria-label="Live Model Telemetry Cards"
            >
              <div className="visualizer-cards-stack">
                {/* Card 1: Topographical Elevation Layer */}
                <div className="neuro-card visualizer-card float-anim-1">
                  <div className="card-header-flex">
                    <div className="icon-square-box">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#2563eb"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                      </svg>
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
                        Identified Topographic Depressions
                      </span>
                      <span className="indicator-highlight text-blue-700 font-bold">
                        14 Verified Catchment Sinks
                      </span>
                    </div>
                    <div className="skeleton-shimmer bar-wide"></div>
                    <div className="skeleton-shimmer bar-half"></div>
                  </div>
                </div>

                {/* Card 2: Dynamic Hazard Slider Card */}
                <div className="neuro-card visualizer-card float-anim-2">
                  <div className="flex justify-between items-baseline mb-3">
                    <div>
                      <span className="meta-tag text-indigo-700">
                        LAYER 02: DYNAMIC PRECIPITATION COUPLING
                      </span>
                      <div className="hazard-readout text-slate-900" id="hazardVal">
                        {hazardPct.toFixed(1)}%
                      </div>
                      <span className="readout-label text-slate-500">
                        Storm Hazard Severity Coefficient
                      </span>
                    </div>
                    <span
                      className="status-chip chip-warning"
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
                    <span className="text-emerald-700 font-medium">0 mm/hr (Dry)</span>
                    <span className="text-amber-700 font-medium">35 mm/hr (Heavy Rain)</span>
                    <span className="text-rose-700 font-medium">80 mm/hr (Cloudburst)</span>
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
                      <span className="bullet-check text-emerald-700 font-bold">✓</span>
                      <span className="text-slate-600">
                        Spatial overlap between urban roads &amp; low-elevation sinks
                      </span>
                    </li>
                    <li>
                      <span className="bullet-check text-blue-700 font-bold">✓</span>
                      <span className="text-slate-600">
                        Strict separation of static hazard, geographic exposure &amp; vulnerability
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
              <div className="pillar-icon">🗺</div>
              <h3 className="pillar-title text-slate-900">Pillar A — Area Susceptibility</h3>
              <p className="pillar-body text-slate-600">
                Combines Copernicus DEM terrain slope, low-lying depression indices, and historical
                waterlogging hotspots into a persistent susceptibility grid across metropolitan
                zones. Distinguishes baseline vulnerability from dynamic weather hazard.
              </p>
              <div className="pillar-footer">
                <span className="text-slate-500">Resolution: 250m² grid</span>
                <span className="text-blue-700 font-bold">&bull; Verified DEM</span>
              </div>
            </div>

            {/* Pillar B */}
            <div className="neuro-card pillar-card">
              <div className="pillar-icon">🏛</div>
              <h3 className="pillar-title text-slate-900">
                Pillar B — Building Footprint Exposure
              </h3>
              <p className="pillar-body text-slate-600">
                Evaluates individual structure polygons against localized terrain depressions and
                drainage outfall capacity. Explicitly reports missing physical vulnerability data to
                eliminate false precision.
              </p>
              <div className="pillar-footer">
                <span className="text-slate-500">Coverage: 17,961+ structures</span>
                <span className="text-emerald-700 font-bold">&bull; Footprint Vectors</span>
              </div>
            </div>

            {/* Pillar C */}
            <div className="neuro-card pillar-card">
              <div className="pillar-icon">🛣</div>
              <h3 className="pillar-title text-slate-900">
                Pillar C — Road Inundation &amp; Routing
              </h3>
              <p className="pillar-body text-slate-600">
                Associates connected road network segments with terrain elevation sinks and
                underpass sumps. Provides flood-aware navigation that reroutes transit away from
                waterlogged corridors before vehicles become trapped.
              </p>
              <div className="pillar-footer">
                <span className="text-slate-500">Network: 14,853 segments</span>
                <span className="text-indigo-700 font-bold">&bull; Flood Routing</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
