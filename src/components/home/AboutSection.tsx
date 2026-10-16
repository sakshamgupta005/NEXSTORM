'use client'

import React from 'react'
import type { TabKey } from './FrontendNavbar'

interface AboutSectionProps {
  onSwitchTab: (tab: TabKey) => void
}

export function AboutSection({ onSwitchTab }: AboutSectionProps) {
  return (
    <section className="tab-view active-view" id="view-about">
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        {/* Header Badge & Title */}
        <div className="mb-12">
          <span className="inline-block text-xs font-semibold tracking-wider text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full px-3.5 py-1 mb-4 uppercase">
            About NEXSTORM
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Scientific Urban Waterlogging Intelligence
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-600 max-w-xl mx-auto font-medium">
            Deterministic spatial modeling and open meteorological science to protect Indian cities from heavy rainfall hazards.
          </p>
        </div>

        {/* Narrative Flow in Clean, Stylized Centered Paragraphs */}
        <div className="space-y-10 text-slate-700 text-base md:text-lg leading-relaxed md:leading-8 font-normal">
          {/* Section 1: The Mission */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              The Mission
            </h2>
            <p>
              NEXSTORM was founded to address one of India’s most critical urban vulnerabilities: seasonal waterlogging caused by heavy monsoon downpours, rapid surface concreting, and aging drainage networks. Instead of relying on generalized citywide weather forecasts or opaque black-box estimates, we deliver high-resolution, street-level early warnings built strictly on physics-based hydrological modeling and verified terrain facts.
            </p>
          </div>

          <div className="w-12 h-px bg-slate-200 mx-auto" />

          {/* Section 2: How NEXSTORM Works */}
          <div className="space-y-3">
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">
              How NEXSTORM Works
            </h2>
            <p>
              Our entire system operates on a transparent, physics-based sequence. Rather than relying on uncalibrated AI guesses, we process real planetary radar, elevation grids, and urban infrastructure geometries into deterministic risk calculations that explain exactly why and where water accumulates.
            </p>
          </div>

          <div className="w-12 h-px bg-slate-200 mx-auto" />

          {/* Section 3: Satellite & Terrain Data Acquisition */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              Satellite &amp; Terrain Data Acquisition
            </h2>
            <p>
              We ingest and mosaic-stitch Copernicus 30m Digital Elevation Models (DEM) alongside European Space Agency (ESA) WorldCover 10m land-use datasets to establish baseline topography and surface permeability. Meteorological conditions are continuously tracked via ECMWF ERA5 atmospheric reanalysis combined with synchronized high-frequency precipitation forecast feeds.
            </p>
          </div>

          <div className="w-12 h-px bg-slate-200 mx-auto" />

          {/* Section 4: Topographic Depression Detection */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              Topographic Depression Detection
            </h2>
            <p>
              Because water flows to the lowest point, we run fill-and-spill hydrological algorithms across the terrain surface to detect all closed topographic depressions. Every natural basin, street dip, and hydrological sink is cataloged by depth, surface area, retention volume, and distance to the nearest municipal drainage outfall.
            </p>
          </div>

          <div className="w-12 h-px bg-slate-200 mx-auto" />

          {/* Section 5: Urban Feature Matching & Tri-Factor Risk Scoring */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              Urban Feature Matching &amp; Tri-Factor Risk Scoring
            </h2>
            <p>
              Identified depressions are spatially joined with hundreds of thousands of building footprints from Google Open Buildings and road centerlines from OpenStreetMap. Each feature is deterministically scored using the Hazard × Exposure × Vulnerability (H×E×V) framework, comparing surface water accumulation directly against building plinth heights and roadway elevations.
            </p>
          </div>

          <div className="w-12 h-px bg-slate-200 mx-auto" />

          {/* Section 6: Real-Time Civic Intelligence Dashboard */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase">
              Real-Time Civic Intelligence Dashboard
            </h2>
            <p>
              All computed intelligence is delivered through interactive maps, localized building dossiers, and flood-aware navigation routes. By cross-calibrating algorithmic predictions with verified municipal incident archives and citizen ground-truth observations, NEXSTORM provides actionable, life-saving clarity for residents and city administrators during severe rainfall events.
            </p>
          </div>
        </div>

        {/* Centralized Action Button */}
        <div className="mt-14 pt-8 border-t border-slate-200 flex justify-center">
          <button
            type="button"
            className="btn-solid-primary cursor-pointer text-sm font-semibold py-2.5 px-6 rounded-xl transition-all shadow-sm"
            id="backToOverviewBtn"
            onClick={() => onSwitchTab('overview')}
          >
            Return to Overview &amp; Live Map
          </button>
        </div>
      </div>
    </section>
  )
}

