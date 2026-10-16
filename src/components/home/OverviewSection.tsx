'use client'

import React from 'react'
import type { TabKey } from './FrontendNavbar'
import { SystemTimelineSection } from './SystemTimelineSection'
import { PillarSpotlightCard } from './PillarSpotlightCard'

interface OverviewSectionProps {
  onSwitchTab: (tab: TabKey) => void
}

export function OverviewSection({ onSwitchTab }: OverviewSectionProps) {
  return (
    <main className="tab-view active-view" id="view-overview">
      {/* Top Hero Block with Full-Bleed Water Wave Background */}
      <section className="relative w-full overflow-hidden flex flex-col justify-between min-h-[560px] sm:min-h-[620px] lg:min-h-[680px]">
        {/* Full-coverage Water Wave Background Graphic */}
        <div 
          className="absolute inset-0 w-full h-full pointer-events-none select-none z-0"
          aria-hidden="true"
        >
          <img
            src="/hero-water-wave.png"
            alt="Hydrological Inundation Wave"
            className="w-full h-full object-cover object-bottom sm:object-[80%_bottom] lg:object-bottom mix-blend-multiply"
          />
        </div>

        {/* Hero Content Container Aligned to Navbar Width */}
        <div className="relative z-10 max-w-[1440px] w-full mx-auto px-6 sm:px-12 pt-4 sm:pt-8 pb-12 sm:pb-16 flex-1 flex flex-col justify-center items-center">
          <div className="max-w-4xl w-full animate-hero-1 mx-auto text-center flex flex-col items-center -mt-6 sm:-mt-10 lg:-mt-14">
            {/* Trust Pill with Live Satellite Radar Ping */}
            <div className="trust-pill !self-center !mx-auto inline-flex items-center gap-2.5 px-4 sm:px-5 py-1.5 sm:py-2 mb-3 sm:mb-4 hover:shadow-xs transition-shadow">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-700"></span>
              </span>
              <span className="pill-text font-bold text-sm sm:text-base text-slate-800">Scientific Multi-Tier Geospatial Intelligence</span>
            </div>

            <h1 className="hero-heading text-5xl sm:text-7xl md:text-8xl lg:text-[88px] xl:text-[96px] font-extrabold tracking-[-0.04em] text-slate-900 leading-[1.01] mb-2 sm:mb-3 text-center">
              <span className="inline-block whitespace-normal sm:whitespace-nowrap">Urban Flood Risk</span>
              <br />
              <span className="heading-accent inline-block whitespace-normal sm:whitespace-nowrap font-medium tracking-[-0.03em] text-slate-500 mt-0.5 sm:mt-1">
                Engineered for Reality
              </span>
              <span className="sr-only">NEXSTORM Urban Resilience System</span>
            </h1>

            {/* Concise, Ultra-Premium Paragraph with Multi-Font & Color Accents */}
            <p className="text-xl sm:text-2xl md:text-[28px] lg:text-[32px] font-light text-slate-600 leading-snug sm:leading-relaxed mb-0 tracking-tight max-w-3xl mx-auto text-center font-sans">
              Deterministic terrain modeling across{' '}
              <span className="font-mono text-slate-800 font-medium bg-slate-200/60 px-2 py-0.5 rounded text-[0.85em] border border-slate-300/60">
                Copernicus 30m
              </span>{' '}
              contours to pinpoint{' '}
              <span className="font-semibold text-slate-900 underline decoration-slate-300 decoration-1 underline-offset-4">
                street-level waterlogging
              </span>{' '}
              in real time.
            </p>
          </div>
        </div>

        {/* Sleek Bottom Transition Bar with Logo Badge and Hairline Divider */}
        <div className="relative z-10 w-full border-t border-slate-300/60 bg-transparent">
          <div className="max-w-[1440px] mx-auto px-6 sm:px-12 py-3 flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-[11px] shadow-xs">
              N
            </div>
            <span className="text-[11px] font-mono font-bold tracking-wider text-slate-600 uppercase">
              CORE SYSTEM ARCHITECTURE
            </span>
            <div className="flex-1 h-px bg-slate-300/60 ml-2" />
          </div>
        </div>
      </section>

      <div className="page-wrapper pt-8 sm:pt-10">
        {/* Expansive 3-Pillar Architectural Deep-Dive Section */}
        <section className="deep-dive-section !border-t-0 !border-none">
          <div className="section-title-wrap">
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
            <PillarSpotlightCard
              index="01"
              tag="AREA SUSCEPTIBILITY"
              title="Pillar A — Area Susceptibility"
              description="Combines Copernicus DEM terrain slope, low-lying depression indices, and historical waterlogging hotspots into a persistent susceptibility grid across metropolitan zones."
              actionLabel="Launch 250m Grid Console"
              actionHref="/city/amritsar"
              metricText="1,998 Cells"
              theme="grey"
            />
            <PillarSpotlightCard
              index="02"
              tag="BUILDING EXPOSURE"
              title="Pillar B — Building Footprint Exposure"
              description="Evaluates individual structure polygons against localized terrain depressions and macro-catchment overlap in UTM 43N without fabricating synthetic damage."
              actionLabel="Inspect Building Footprints"
              onActionClick={() => onSwitchTab('buildings')}
              metricText="360k+ Buildings"
              theme="grey"
            />
            <PillarSpotlightCard
              index="03"
              tag="ROAD INUNDATION"
              title="Pillar C — Road Inundation & Routing"
              description="Associates connected road network segments with terrain elevation sinks and underpass sumps, computing sub-2ms flood-aware route comparison."
              actionLabel="Evaluate Road Corridors"
              onActionClick={() => onSwitchTab('roads')}
              metricText="14,855 Segments"
              theme="grey"
            />
          </div>
        </section>

        {/* Dynamic Timeline Section with Generous Spacing Below 3 Pillars */}
        <div className="w-full mt-28 sm:mt-40 border-t border-slate-200/80 pt-12 sm:pt-16">
          <SystemTimelineSection />
        </div>
      </div>
    </main>
  )
}
