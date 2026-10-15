'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { Activity } from 'lucide-react'
import type { RouteType } from './RoadMapCanvas'

const DynamicRoadMapCanvas = dynamic(
  () => import('./RoadMapCanvas').then((mod) => mod.RoadMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] rounded-2xl flex flex-col items-center justify-center bg-slate-100 text-slate-500 border border-slate-200">
        <Activity className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
        <span className="text-sm font-semibold">Initializing Amritsar road navigation network...</span>
      </div>
    ),
  }
)

export function RoadsSection() {
  const [activeRoute, setActiveRoute] = useState<RouteType>('safe')
  const [focusHazardTrigger, setFocusHazardTrigger] = useState<number>(0)

  const isSafe = activeRoute === 'safe'

  return (
    <section className="tab-view active-view" id="view-roads">
      <div className="page-wrapper">
        {/* Section Header */}
        <div className="section-title-wrap">
          <div className="trust-pill">
            <span className="pill-sparkle">🛣</span>
            <span className="pill-text">
              Pillar C — Road Network Inundation &amp; Flood-Aware Navigation
            </span>
          </div>
          <h2 className="sub-section-heading">Dynamic Road Inundation &amp; Routing Map</h2>
          <p className="sub-section-desc">
            Compare alternative travel corridors across the metropolitan network. Route vectors
            illuminate dynamically on the map, exposing submerged underpass traps and guiding
            vehicles onto elevated flood-safe trajectories.
          </p>
        </div>

        {/* Road Route Workspace Grid */}
        <div className="roads-workspace-grid">
          {/* Left: Route Evaluator & Controls */}
          <div className="route-selector-column">
            <div className="neuro-card p-7">
              <h3 className="column-heading text-slate-900">
                Flood-Aware Route Comparison (Amritsar)
              </h3>

              <div className="flex flex-col gap-5 mt-4">
                <div>
                  <label className="input-field-label text-slate-600">
                    Journey Origin (Amritsar Hub)
                  </label>
                  <div className="input-box-neuro">
                    <span className="text-blue-700 text-sm">📍</span>
                    <input
                      type="text"
                      value="Amritsar Junction Railway Station (ASR)"
                      readOnly
                      className="input-clean text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="input-field-label text-slate-600">Journey Destination</label>
                  <div className="input-box-neuro">
                    <span className="text-emerald-700 text-sm">🏁</span>
                    <input
                      type="text"
                      value="Sri Guru Ram Dass Jee International Airport (ATQ)"
                      readOnly
                      className="input-clean text-slate-900"
                    />
                  </div>
                </div>

                {/* Route Choices Stack */}
                <div className="route-choices-stack">
                  <button
                    type="button"
                    className={`route-choice-card ${isSafe ? 'active-route' : ''}`}
                    onClick={() => setActiveRoute('safe')}
                    id="routeChoiceSafe"
                  >
                    <div className="flex justify-between items-center">
                      <strong className="text-sm font-bold text-emerald-800">
                        Route A: Amritsar Bypass Elevated Flyover
                      </strong>
                      <span className="risk-badge badge-low">Recommended Safe</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>15.6 km • 22 mins</span>
                      <span className="text-emerald-700 font-bold">Minimal Waterlogging (6%)</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`route-choice-card ${!isSafe ? 'active-route' : ''}`}
                    onClick={() => setActiveRoute('hazardous')}
                    id="routeChoiceHazardous"
                  >
                    <div className="flex justify-between items-center">
                      <strong className="text-sm font-bold text-rose-800">
                        Route B: GT Road via Rego Bridge Sump
                      </strong>
                      <span className="risk-badge badge-high">High Inundation Trap</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>11.2 km • +40 min delay</span>
                      <span className="text-rose-700 font-bold">Underpass Sump Hazard (88%)</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Active Corridors Hazard Monitor */}
            <div className="neuro-card p-7">
              <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">
                Critical Amritsar Corridors (Active Storm)
              </h4>
              <div className="flex flex-col gap-3">
                <div
                  className="segment-pill cursor-pointer"
                  id="jumpToUnderpassHazard"
                  onClick={() => {
                    setActiveRoute('hazardous')
                    setFocusHazardTrigger((prev) => prev + 1)
                  }}
                  title="Click to jump to underpass on map"
                >
                  <div className="hazard-dot dot-critical"></div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">
                      Rego Bridge Railway Underpass Sump
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Historical severe water accumulation basin (&gt;45cm water trap)
                    </div>
                  </div>
                  <span className="risk-badge badge-high">CRITICAL</span>
                </div>

                <div className="segment-pill">
                  <div className="hazard-dot dot-warning"></div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">
                      Bhandari Bridge Approach &amp; Hall Gate Outfall
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Restricted discharge into canal outfall, curb overflow likely
                    </div>
                  </div>
                  <span className="risk-badge badge-med">WARNING</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Interactive Dynamic Road Navigation Map */}
          <div className="route-map-column">
            <div className="neuro-card p-6 map-container-card">
              <div className="map-toolbar">
                <div className="flex items-center gap-2">
                  <span className="map-live-dot"></span>
                  <span
                    className={`meta-tag font-bold ${
                      isSafe ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                    id="currentRouteTitle"
                  >
                    {isSafe
                      ? 'CORRIDOR: ROUTE A (AMRITSAR ELEVATED BYPASS)'
                      : 'CORRIDOR: ROUTE B (REGO BRIDGE UNDERPASS SUMP)'}
                  </span>
                </div>
                <div className="map-layer-pills">
                  <span
                    className={`layer-pill ${isSafe ? 'active-layer' : ''} cursor-pointer`}
                    onClick={() => setActiveRoute('safe')}
                  >
                    <span className="pill-swatch swatch-safe"></span> Route A Safe Corridor
                  </span>
                  <span
                    className={`layer-pill ${!isSafe ? 'active-layer' : ''} cursor-pointer`}
                    onClick={() => setActiveRoute('hazardous')}
                  >
                    <span className="pill-swatch swatch-hazard"></span> Route B Sump Trap
                  </span>
                </div>
              </div>

              {/* Real Leaflet Road Map Canvas */}
              <div className="map-viewport relative" id="roadMapWrapper">
                <DynamicRoadMapCanvas
                  activeRoute={activeRoute}
                  focusHazardTrigger={focusHazardTrigger}
                />

                {/* Dynamic Route HUD Overlay Panel */}
                <div className="map-hud-dossier" id="roadHudDossier">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span
                        className={`text-[10px] font-bold tracking-wider ${
                          isSafe ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                        id="roadHudCode"
                      >
                        {isSafe ? 'RECOMMENDED ROUTE: A' : 'CRITICAL FLOOD HAZARD: ROUTE B'}
                      </span>
                      <h4 className="text-base font-bold text-slate-900" id="roadHudTitle">
                        {isSafe
                          ? 'Northern Bypass & Elevated Highway'
                          : 'Rego Bridge Underpass Sump & GT Road'}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-2xl font-black ${
                          isSafe ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                        id="roadHudScore"
                      >
                        {isSafe ? '94' : '22'}
                        <span className="text-xs text-slate-400 font-normal">/100</span>
                      </span>
                      <span
                        className={`block text-[10px] font-bold ${
                          isSafe ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                        id="roadHudSafetyLabel"
                      >
                        {isSafe ? 'High Safety Confidence' : 'Severe Inundation Trap'}
                      </span>
                    </div>
                  </div>

                  {/* Road Specific Stats */}
                  <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-slate-200 text-left">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Distance</span>
                      <strong className="text-xs text-slate-900" id="roadHudDist">
                        {isSafe ? '15.6 km' : '11.2 km'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Travel Time</span>
                      <strong className="text-xs text-slate-900" id="roadHudTime">
                        {isSafe ? '22 mins (Clear)' : '+40 min Delay (Trapped)'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Sump Traps</span>
                      <strong
                        className={`text-xs font-bold ${
                          isSafe ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                        id="roadHudSinks"
                      >
                        {isSafe ? '0 on Trajectory' : '2 Sump Traps (>45cm)'}
                      </strong>
                    </div>
                  </div>

                  <div className="hud-flow-notice">
                    <span className={`font-bold ${isSafe ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isSafe ? '✓' : '⚠️'}
                    </span>
                    <span className="text-xs text-slate-700" id="roadHudAdvisory">
                      {isSafe
                        ? 'Traverses northern elevated bypass embankment slope (+1.2%), completely bypassing flash water accumulation at Rego Bridge.'
                        : 'Descends into Rego Bridge railway underpass bowl where storm runoff converges from Hall Gate. Vehicle stalling and complete road submergence expected.'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Below-Map Insight: Road Corridor Analysis */}
            <div className="below-map-insight">
              <div className="insight-header">
                <span className="insight-icon">🛤</span>
                <div>
                  <span className="meta-tag text-emerald-700">CORRIDOR ANALYSIS</span>
                  <h4 className="insight-title">
                    Flood-Aware Routing Intelligence — Amritsar Network
                  </h4>
                </div>
              </div>
              <div className="insight-grid">
                <div className="insight-stat">
                  <span className="insight-stat-value text-rose-700">4</span>
                  <span className="insight-stat-label">Active Underpass Sump Traps</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-rose-500" style={{ width: '35%' }}></div>
                  </div>
                </div>
                <div className="insight-stat">
                  <span className="insight-stat-value text-amber-700">14,853</span>
                  <span className="insight-stat-label">Monitored Road Segments</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-amber-500" style={{ width: '60%' }}></div>
                  </div>
                </div>
                <div className="insight-stat">
                  <span className="insight-stat-value text-emerald-700">3</span>
                  <span className="insight-stat-label">Elevated Safe Corridors</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-emerald-500" style={{ width: '45%' }}></div>
                  </div>
                </div>
              </div>
              <div className="insight-footnote">
                <span className="text-slate-500">Sources:</span>
                <span className="text-blue-700 font-semibold">OSM Road Network</span>
                <span className="insight-dot">&bull;</span>
                <span className="text-emerald-700 font-semibold">Municipal Drainage Maps</span>
                <span className="insight-dot">&bull;</span>
                <span className="text-indigo-700 font-semibold">Historical Incident Data</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
