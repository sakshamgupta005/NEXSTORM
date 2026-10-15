'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { Activity } from 'lucide-react'
import type { RouteType, TripExample } from './RoadMapCanvas'

export const TRIP_EXAMPLES: Record<string, TripExample> = {
  'asr-airport': {
    id: 'asr-airport',
    label: 'ASR Junction → Airport (ATQ)',
    originName: 'Amritsar Junction Railway Station (ASR)',
    originCoords: [31.634, 74.8655],
    destName: 'Sri Guru Ram Dass Jee International Airport (ATQ)',
    destCoords: [31.7095, 74.7972],
    hazardPoint: [31.6285, 74.861],
    hazardName: 'Rego Bridge Railway Underpass Sump',
    hazardDesc: 'Historical severe water accumulation basin (topographic depression)',
    routeA: {
      name: 'Route A: Amritsar Bypass Elevated Flyover',
      distance: '15.6 km',
      time: '~31 mins (30 km/h baseline)',
      score: 14,
      label: 'Lower Modeled Exposure',
      flowNote:
        'Traverses elevated bypass alignment (+1.2% gradient), avoiding the low-lying topographic depression at Rego Bridge.',
      coords: [
        [31.634, 74.8655],
        [31.649, 74.872],
        [31.668, 74.865],
        [31.688, 74.835],
        [31.702, 74.81],
        [31.7095, 74.7972],
      ],
    },
    routeB: {
      name: 'Route B: GT Road via Rego Bridge Sump',
      distance: '11.2 km',
      time: '~22 mins (+ unmodeled flood delay)',
      score: 88,
      label: 'High Inundation Risk',
      flowNote:
        'Submerged underpass basin (-2.8% gradient); chronic monsoon waterlogging with ~60cm storm inundation recorded.',
      coords: [
        [31.634, 74.8655],
        [31.6285, 74.861],
        [31.642, 74.842],
        [31.67, 74.821],
        [31.7095, 74.7972],
      ],
    },
  },
  'golden-temple-gndu': {
    id: 'golden-temple-gndu',
    label: 'Golden Temple → GNDU University',
    originName: 'Golden Temple Heritage Plaza (Katra Ahluwalia)',
    originCoords: [31.62, 74.8765],
    destName: 'Guru Nanak Dev University (GNDU Campus Gate)',
    destCoords: [31.6375, 74.825],
    hazardPoint: [31.631, 74.843],
    hazardName: 'Putlighar GT Road Culvert Sump',
    hazardDesc: 'Railway embankment drainage chokepoint with chronic backflow',
    routeA: {
      name: 'Route A: Via Kitchlu Chowk & Cantt Elevated Road',
      distance: '8.4 km',
      time: '~19 mins (30 km/h baseline)',
      score: 22,
      label: 'Lower Modeled Exposure',
      flowNote:
        'Traverses well-drained cantonment arterial (+0.8% gradient) with unconstricted roadside swales.',
      coords: [
        [31.62, 74.8765],
        [31.632, 74.868],
        [31.645, 74.858],
        [31.642, 74.838],
        [31.6375, 74.825],
      ],
    },
    routeB: {
      name: 'Route B: Direct GT Road through Putlighar Sump',
      distance: '6.8 km',
      time: '~16 mins (+ severe street pooling)',
      score: 78,
      label: 'High Inundation Risk',
      flowNote:
        'Direct road funnels through low-lying Putlighar market railway bottleneck with severe curb overflowing.',
      coords: [
        [31.62, 74.8765],
        [31.626, 74.859],
        [31.631, 74.843],
        [31.634, 74.832],
        [31.6375, 74.825],
      ],
    },
  },
  'isbt-verka': {
    id: 'isbt-verka',
    label: 'ISBT Bus Stand → Batala Rd / Verka',
    originName: 'Amritsar Inter-State Bus Terminal (ISBT)',
    originCoords: [31.626, 74.885],
    destName: 'Verka Industrial Junction & Batala Road',
    destCoords: [31.678, 74.912],
    hazardPoint: [31.649, 74.898],
    hazardName: 'SSSS Chowk & Batala Road Underpass Sump',
    hazardDesc: 'Natural topographic sump capturing northern walled city sheetflow',
    routeA: {
      name: 'Route A: Outer Ring Road & Majitha Bypass Corridor',
      distance: '9.8 km',
      time: '~21 mins (30 km/h baseline)',
      score: 18,
      label: 'Lower Modeled Exposure',
      flowNote:
        'Elevated outer ring highway contour with active open canal drainage culverts.',
      coords: [
        [31.626, 74.885],
        [31.641, 74.915],
        [31.662, 74.922],
        [31.678, 74.912],
      ],
    },
    routeB: {
      name: 'Route B: Direct Batala Road via SSSS Chowk Sump',
      distance: '7.2 km',
      time: '~17 mins (+ unmodeled flood delay)',
      score: 84,
      label: 'High Inundation Risk',
      flowNote:
        'Low-elevation depression receiving excessive street runoff; historical inundation up to 45cm.',
      coords: [
        [31.626, 74.885],
        [31.638, 74.891],
        [31.649, 74.898],
        [31.664, 74.906],
        [31.678, 74.912],
      ],
    },
  },
}

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
  const [activeTripKey, setActiveTripKey] = useState<string>('asr-airport')
  const [activeRoute, setActiveRoute] = useState<RouteType>('safe')
  const [focusHazardTrigger, setFocusHazardTrigger] = useState<number>(0)

  const activeTrip = TRIP_EXAMPLES[activeTripKey] || TRIP_EXAMPLES['asr-airport']
  const isSafe = activeRoute === 'safe'
  const activeOption = isSafe ? activeTrip.routeA : activeTrip.routeB

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
            Compare alternative travel corridors across the metropolitan network. Route trajectories
            illustrate modeled waterlogging exposure, identifying low-lying underpasses and lower-exposure
            arterial alternatives.
          </p>
        </div>

        {/* Road Route Workspace Grid */}
        <div className="roads-workspace-grid">
          {/* Left: Route Evaluator & Controls */}
          <div className="route-selector-column">
            <div className="neuro-card p-7">
              <div className="flex items-center justify-between mb-3">
                <h3 className="column-heading text-slate-900">
                  Flood-Aware Route Comparison
                </h3>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                  3 Trip Pairs
                </span>
              </div>

              {/* Trip Pair Selector Tabs */}
              <div className="mb-4">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Select Trip Corridor Example:
                </label>
                <div className="flex flex-col gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                  {Object.values(TRIP_EXAMPLES).map((trip) => (
                    <button
                      key={trip.id}
                      type="button"
                      onClick={() => {
                        setActiveTripKey(trip.id)
                        setActiveRoute('safe')
                      }}
                      className={`text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between ${
                        activeTripKey === trip.id
                          ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                      }`}
                    >
                      <span>{trip.label}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {trip.id === 'asr-airport' ? '15.6 km' : trip.id === 'golden-temple-gndu' ? '8.4 km' : '9.8 km'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4 mt-2">
                <div>
                  <label className="input-field-label text-slate-600">
                    Journey Origin (Amritsar Hub)
                  </label>
                  <div className="input-box-neuro">
                    <span className="text-blue-700 text-sm">📍</span>
                    <input
                      type="text"
                      value={activeTrip.originName}
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
                      value={activeTrip.destName}
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
                        {activeTrip.routeA.name}
                      </strong>
                      <span className="risk-badge badge-low">
                        {activeTrip.routeA.label}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>{activeTrip.routeA.distance} • {activeTrip.routeA.time}</span>
                      <span className="text-emerald-700 font-bold">Exposure: {activeTrip.routeA.score}/100</span>
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
                        {activeTrip.routeB.name}
                      </strong>
                      <span className="risk-badge badge-high">
                        {activeTrip.routeB.label}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500 mt-2">
                      <span>{activeTrip.routeB.distance} • {activeTrip.routeB.time}</span>
                      <span className="text-rose-700 font-bold">Exposure: {activeTrip.routeB.score}/100</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Active Corridors Hazard Monitor (Expanded Examples) */}
            <div className="neuro-card p-7">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Critical Amritsar Corridors
                </h4>
                <span className="text-[10px] font-mono text-slate-500">5 Monitored</span>
              </div>
              <div className="flex flex-col gap-2.5 max-h-[360px] overflow-y-auto pr-1">
                {/* Corridor 1: Rego Bridge */}
                <div
                  className="segment-pill cursor-pointer"
                  id="jumpToUnderpassHazard"
                  onClick={() => {
                    setActiveTripKey('asr-airport')
                    setActiveRoute('hazardous')
                    setFocusHazardTrigger((prev) => prev + 1)
                  }}
                  title="Click to select trip and focus on Rego Bridge Underpass"
                >
                  <div className="hazard-dot dot-warning"></div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">
                      Rego Bridge Railway Underpass Sump
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Severe railway underpass depression (-2.8% gradient); chronic water accumulation
                    </div>
                  </div>
                  <span className="risk-badge badge-high">WARNING</span>
                </div>

                {/* Corridor 2: Bhandari Bridge */}
                <div className="segment-pill">
                  <div className="hazard-dot dot-warning"></div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">
                      Bhandari Bridge Approach &amp; Hall Gate Outfall
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Canal outfall discharge constriction; curb overtopping during 30mm/h events
                    </div>
                  </div>
                  <span className="risk-badge badge-med">WATCH</span>
                </div>

                {/* Corridor 3: SSSS Chowk */}
                <div
                  className="segment-pill cursor-pointer"
                  onClick={() => {
                    setActiveTripKey('isbt-verka')
                    setActiveRoute('hazardous')
                    setFocusHazardTrigger((prev) => prev + 1)
                  }}
                  title="Click to select trip and focus on SSSS Chowk"
                >
                  <div className="hazard-dot dot-warning"></div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">
                      SSSS Chowk &amp; Batala Road Underpass
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Northern industrial corridor low-point; natural basin collecting street runoff
                    </div>
                  </div>
                  <span className="risk-badge badge-high">WARNING</span>
                </div>

                {/* Corridor 4: Putlighar GT Road */}
                <div
                  className="segment-pill cursor-pointer"
                  onClick={() => {
                    setActiveTripKey('golden-temple-gndu')
                    setActiveRoute('hazardous')
                    setFocusHazardTrigger((prev) => prev + 1)
                  }}
                  title="Click to select trip and focus on Putlighar Sump"
                >
                  <div className="hazard-dot dot-warning"></div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">
                      Putlighar GT Road Railway Culvert Sump
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Railway embankment bottleneck; backflow during cloudbursts
                    </div>
                  </div>
                  <span className="risk-badge badge-med">WATCH</span>
                </div>

                {/* Corridor 5: Kitchlu Chowk */}
                <div className="segment-pill">
                  <div className="hazard-dot dot-safe"></div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-slate-900">
                      Kitchlu Chowk &amp; Court Road Elevated Axis
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Positive pavement crown (+1.1%); lateral sheetflow drains into storm lines
                    </div>
                  </div>
                  <span className="risk-badge badge-low">ADVISORY</span>
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
                      ? 'CORRIDOR: ROUTE A (LOWER EXPOSURE ALIGNMENT)'
                      : 'CORRIDOR: ROUTE B (HIGH EXPOSURE DEPRESSION)'}
                  </span>
                </div>
                <div className="map-layer-pills">
                  <span
                    className={`layer-pill ${isSafe ? 'active-layer' : ''} cursor-pointer`}
                    onClick={() => setActiveRoute('safe')}
                  >
                    <span className="pill-swatch swatch-safe"></span> Route A (Lower Exposure)
                  </span>
                  <span
                    className={`layer-pill ${!isSafe ? 'active-layer' : ''} cursor-pointer`}
                    onClick={() => setActiveRoute('hazardous')}
                  >
                    <span className="pill-swatch swatch-hazard"></span> Route B (High Risk Sump)
                  </span>
                </div>
              </div>

              {/* Real Leaflet Road Map Canvas */}
              <div className="map-viewport relative" id="roadMapWrapper">
                <DynamicRoadMapCanvas
                  activeTrip={activeTrip}
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
                        {isSafe ? 'RECOMMENDED: ROUTE A (LOWER EXPOSURE)' : 'ADVISORY: ROUTE B (AVOID)'}
                      </span>
                      <h4 className="text-base font-bold text-slate-900" id="roadHudTitle">
                        {activeTripKey === 'asr-airport'
                          ? (isSafe ? 'Northern Bypass & Elevated Alignment' : 'Rego Bridge Underpass & GT Road')
                          : activeOption.name.replace(/^Route [AB]:\s*/, '')}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-2xl font-black ${
                          isSafe ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                        id="roadHudScore"
                      >
                        {activeOption.score}
                        <span className="text-xs text-slate-400 font-normal">/100</span>
                      </span>
                      <span
                        className={`block text-[10px] font-bold ${
                          isSafe ? 'text-emerald-800' : 'text-rose-700'
                        }`}
                        id="roadHudSafetyLabel"
                      >
                        {activeOption.label}
                      </span>
                    </div>
                  </div>

                  {/* Road Specific Stats */}
                  <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-slate-200 text-left">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Distance</span>
                      <strong className="text-xs text-slate-900" id="roadHudDist">
                        {activeOption.distance}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Travel Time</span>
                      <strong className="text-xs text-slate-900" id="roadHudTime">
                        {activeOption.time}
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
                        {isSafe ? '0 on Trajectory' : '1 Severe Sump (>40cm)'}
                      </strong>
                    </div>
                  </div>

                  <div className="hud-flow-notice">
                    <span className={`font-bold ${isSafe ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {isSafe ? '✓' : '⚠️'}
                    </span>
                    <span className="text-xs text-slate-700" id="roadHudAdvisory">
                      {activeOption.flowNote}
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
                  <span className="insight-stat-label">Historical Underpass Sumps</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-rose-500" style={{ width: '35%' }}></div>
                  </div>
                </div>
                <div className="insight-stat">
                  <span className="insight-stat-value text-amber-700">14,855</span>
                  <span className="insight-stat-label">Modeled Road Segments</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-amber-500" style={{ width: '60%' }}></div>
                  </div>
                </div>
                <div className="insight-stat">
                  <span className="insight-stat-value text-emerald-700">3</span>
                  <span className="insight-stat-label">Low-Exposure Arterials</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-emerald-500" style={{ width: '45%' }}></div>
                  </div>
                </div>
              </div>
              <div className="insight-footnote">
                <span className="text-slate-500">Sources:</span>
                <span className="text-blue-700 font-semibold">OSM Road Network</span>
                <span className="insight-dot">&bull;</span>
                <span className="text-emerald-700 font-semibold">Copernicus 30m DEM</span>
                <span className="insight-dot">&bull;</span>
                <span className="text-indigo-700 font-semibold">Historical Incident Archive</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
