'use client'

import React from 'react'
import type { TabKey } from './FrontendNavbar'

interface AboutSectionProps {
  onSwitchTab: (tab: TabKey) => void
}

export function AboutSection({ onSwitchTab }: AboutSectionProps) {
  return (
    <section className="tab-view active-view" id="view-about">
      <div className="page-wrapper max-w-5xl mx-auto">
        {/* About Header Card */}
        <div className="neuro-card p-12 flex flex-col gap-8 text-center">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl shadow-inner text-blue-700 font-bold">
            ⚡
          </div>

          <div>
            <span className="meta-tag text-blue-700">PROJECT NEXSTORM VISION</span>
            <h2 className="text-3xl font-bold text-slate-900 mt-2">
              Scientific Urban Waterlogging Intelligence
            </h2>
            <p className="text-sm text-slate-600 max-w-2xl mx-auto mt-3 leading-relaxed">
              NEXSTORM is founded on the conviction that urban climate resilience requires
              deterministic, explainable hydrological spatial matching rather than black-box guesses.
              Developed as an open scientific framework for metropolitan infrastructure, it unites
              remote sensing, terrain modeling, and community ground-truth into a unified civic
              safeguard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-2">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
              <h4 className="text-sm font-bold text-slate-900 mb-2">Metropolitan Scale First</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Dedicated initial focus on high-density urban terrain, historical municipal records,
                and drainage bottlenecks before regional expansion.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
              <h4 className="text-sm font-bold text-slate-900 mb-2">Zero Fabricated Data</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Powered strictly by verifiable Copernicus DEM, ESA WorldCover, ERA5 reanalysis, and
                independently audited community observations.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200">
              <h4 className="text-sm font-bold text-slate-900 mb-2">Explainable Reasoning</h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Every risk score is transparently traceable back to contributing elevation
                gradients, rainfall volume, and drainage outfalls.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Timeline: How Our System Works */}
        <div className="system-timeline-section mt-12">
          <div className="section-title-wrap text-center" style={{ maxWidth: '100%' }}>
            <span className="meta-tag text-indigo-700">SYSTEM PIPELINE</span>
            <h2 className="sub-section-heading" style={{ fontSize: '36px' }}>
              How NEXSTORM Works
            </h2>
            <p className="sub-section-desc" style={{ maxWidth: '680px', margin: '0 auto' }}>
              From raw satellite data to actionable civic intelligence — a 6-stage deterministic
              pipeline processing real-world geospatial evidence.
            </p>
          </div>

          <div className="timeline-track">
            <div className="timeline-line"></div>

            {/* Stage 1 */}
            <div className="timeline-node timeline-visible">
              <div className="timeline-marker">
                <span className="timeline-step-num">01</span>
              </div>
              <div className="timeline-content">
                <span className="timeline-phase-tag text-blue-700">DATA INGESTION</span>
                <h4 className="timeline-title">Satellite &amp; Terrain Data Acquisition</h4>
                <p className="timeline-desc">
                  Copernicus 30m Digital Elevation Model tiles are ingested, georeferenced, and
                  mosaic-stitched for the entire Amritsar metropolitan bounding box. ERA5
                  precipitation reanalysis streams are synced at 6-hour intervals.
                </p>
                <div className="timeline-tech-badges">
                  <span className="tech-badge">Copernicus DEM</span>
                  <span className="tech-badge">ERA5 Reanalysis</span>
                  <span className="tech-badge">WGS84</span>
                </div>
              </div>
            </div>

            {/* Stage 2 */}
            <div className="timeline-node timeline-visible">
              <div className="timeline-marker">
                <span className="timeline-step-num">02</span>
              </div>
              <div className="timeline-content">
                <span className="timeline-phase-tag text-indigo-700">TERRAIN ANALYSIS</span>
                <h4 className="timeline-title">Topographic Depression Detection</h4>
                <p className="timeline-desc">
                  Fill-and-spill algorithms identify all closed depressions in the urban terrain
                  surface where water would naturally pool. Each depression is indexed by depth,
                  area, and connectivity to the nearest drainage outfall.
                </p>
                <div className="timeline-tech-badges">
                  <span className="tech-badge">Fill-Spill Algorithm</span>
                  <span className="tech-badge">Hydrological Sinks</span>
                  <span className="tech-badge">GeoTIFF</span>
                </div>
              </div>
            </div>

            {/* Stage 3 */}
            <div className="timeline-node timeline-visible">
              <div className="timeline-marker">
                <span className="timeline-step-num">03</span>
              </div>
              <div className="timeline-content">
                <span className="timeline-phase-tag text-emerald-700">SPATIAL MATCHING</span>
                <h4 className="timeline-title">Urban Feature Overlay &amp; Intersection</h4>
                <p className="timeline-desc">
                  OSM building footprints and road network segments are spatially intersected with
                  identified terrain depressions. Each structure receives a proximity score to the
                  nearest verified catchment sink.
                </p>
                <div className="timeline-tech-badges">
                  <span className="tech-badge">OSM Overpass API</span>
                  <span className="tech-badge">Spatial Join</span>
                  <span className="tech-badge">PostGIS</span>
                </div>
              </div>
            </div>

            {/* Stage 4 */}
            <div className="timeline-node timeline-visible">
              <div className="timeline-marker">
                <span className="timeline-step-num">04</span>
              </div>
              <div className="timeline-content">
                <span className="timeline-phase-tag text-amber-700">RISK COMPUTATION</span>
                <h4 className="timeline-title">Tri-Factor Deterministic Scoring</h4>
                <p className="timeline-desc">
                  Each feature is scored across three independent axes: Hazard (precipitation
                  intensity), Exposure (elevation intersection with sinks), and Vulnerability
                  (structural characteristics). The composite index is explainable and auditable.
                </p>
                <div className="timeline-tech-badges">
                  <span className="tech-badge">H×E×V Framework</span>
                  <span className="tech-badge">Deterministic</span>
                  <span className="tech-badge">Auditable</span>
                </div>
              </div>
            </div>

            {/* Stage 5 */}
            <div className="timeline-node timeline-visible">
              <div className="timeline-marker">
                <span className="timeline-step-num">05</span>
              </div>
              <div className="timeline-content">
                <span className="timeline-phase-tag text-rose-700">VALIDATION</span>
                <h4 className="timeline-title">Ground-Truth Cross-Verification</h4>
                <p className="timeline-desc">
                  Computed risk scores are cross-referenced against verified historical
                  waterlogging incident reports, municipal pump station deployment logs, and
                  community-submitted observations to calibrate confidence levels.
                </p>
                <div className="timeline-tech-badges">
                  <span className="tech-badge">Historical Incidents</span>
                  <span className="tech-badge">Municipal Records</span>
                  <span className="tech-badge">Community Reports</span>
                </div>
              </div>
            </div>

            {/* Stage 6 */}
            <div className="timeline-node timeline-visible">
              <div className="timeline-marker">
                <span className="timeline-step-num">06</span>
              </div>
              <div className="timeline-content">
                <span className="timeline-phase-tag text-blue-700">DELIVERY</span>
                <h4 className="timeline-title">Real-Time Civic Intelligence Dashboard</h4>
                <p className="timeline-desc">
                  Processed risk assessments are rendered on interactive geospatial maps with
                  dynamic probe nodes, animated vector flows, and live telemetry — enabling
                  municipal teams and citizens to make informed decisions before, during, and
                  after storm events.
                </p>
                <div className="timeline-tech-badges">
                  <span className="tech-badge">Leaflet.js</span>
                  <span className="tech-badge">Live Telemetry</span>
                  <span className="tech-badge">Dynamic HUD</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 pb-12 flex justify-center">
          <button
            type="button"
            className="btn-solid-primary"
            id="backToOverviewBtn"
            onClick={() => onSwitchTab('overview')}
          >
            Return to Overview &amp; Model Architecture
          </button>
        </div>
      </div>
    </section>
  )
}
