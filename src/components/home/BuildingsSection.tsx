'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { Activity } from 'lucide-react'
import type { AreaData } from './BuildingMapCanvas'

// Dynamically import map canvas with SSR disabled
const DynamicBuildingMapCanvas = dynamic(
  () => import('./BuildingMapCanvas').then((mod) => mod.BuildingMapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] rounded-2xl flex flex-col items-center justify-center bg-slate-100 text-slate-500 border border-slate-200">
        <Activity className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <span className="text-sm font-semibold">Initializing Amritsar building exposure map...</span>
      </div>
    ),
  }
)

export const AMRITSAR_AREAS: Record<string, AreaData> = {
  'hall-gate': {
    key: 'hall-gate',
    code: 'ID: ASR-BLD-0104',
    name: 'Hall Gate Commercial Basin',
    areaTag: 'AREA: HALL GATE COMMERCIAL BASIN (AMRITSAR WALLED CITY)',
    center: [31.6315, 74.874],
    zoom: 17,
    sink: [31.6298, 74.8758],
    baseScore: 88,
    risk: 'High Exposure',
    riskClass: 'text-rose-700',
    baseGradient: -1.9,
    gradientText: '-1.9% Sump Basin',
    baseElevation: 226.8,
    drain: 'Depression Sink',
    drainClass: 'text-rose-700',
    flowText:
      'Surface sheetflow descends into Hall Bazaar low-elevation depression (226.8m MSL). Subsurface drainage hydraulics unmodeled.',
    velocity: '1,420 m²',
    drainCap: 's = 0.88',
    actionStatus: 'Unmodeled',
    statusMsg: 'Copernicus DEM 30m topographic depression. Plinth elevation & indoor depth unmodeled.',
    photoUrl: '/assets/locations/hall-gate.jpg',
  },
  'heritage-street': {
    key: 'heritage-street',
    code: 'ID: ASR-BLD-0012',
    name: 'Heritage Street & Golden Temple Axis',
    areaTag: 'AREA: HERITAGE STREET PEDESTRIAN CORRIDOR (AMRITSAR)',
    center: [31.62, 74.8765],
    zoom: 17,
    sink: [31.6185, 74.8785],
    baseScore: 62,
    risk: 'Moderate Exposure',
    riskClass: 'text-amber-700',
    baseGradient: 0.3,
    gradientText: '+0.3% Flat Gutter',
    baseElevation: 228.4,
    drain: 'Moderate Sump',
    drainClass: 'text-amber-700',
    flowText:
      'Paved pedestrian corridor channels sheetflow along lateral gutters toward historic walled city depression.',
    velocity: '2,150 m²',
    drainCap: 's = 0.62',
    actionStatus: 'Unmodeled',
    statusMsg: 'Pedestrian corridor aligned with historic Katra Ahluwalia terrain depression.',
    photoUrl: '/assets/locations/heritage-street.jpg',
  },
  'mall-road': {
    key: 'mall-road',
    code: 'ID: ASR-BLD-0820',
    name: 'Mall Road & Civil Lines District',
    areaTag: 'AREA: CIVIL LINES RETAIL PRECINCT (AMRITSAR)',
    center: [31.6425, 74.8685],
    zoom: 17,
    sink: [31.6408, 74.871],
    baseScore: 28,
    risk: 'Low Exposure',
    riskClass: 'text-emerald-700',
    baseGradient: 1.4,
    gradientText: '+1.4% Crowned Axis',
    baseElevation: 232.1,
    drain: 'Crowned Slope',
    drainClass: 'text-emerald-700',
    flowText:
      'Positive road crown rapidly conveys rainfall away from storefronts toward circular drainage outfall.',
    velocity: '980 m²',
    drainCap: 's = 0.28',
    actionStatus: 'Unmodeled',
    statusMsg: 'Elevated road crown conveys runoff away from building foundations.',
    photoUrl: '/assets/locations/mall-road.jpg',
  },
  'ranjit-avenue': {
    key: 'ranjit-avenue',
    code: 'ID: ASR-BLD-3401',
    name: 'Ranjit Avenue Sector D Complex',
    areaTag: 'AREA: RANJIT AVENUE MODERN SECTOR (AMRITSAR)',
    center: [31.655, 74.855],
    zoom: 17,
    sink: [31.6575, 74.8525],
    baseScore: 16,
    risk: 'Minimal Risk',
    riskClass: 'text-emerald-700',
    baseGradient: 2.2,
    gradientText: '+2.2% Engineered Ridge',
    baseElevation: 234.6,
    drain: 'Engineered Ridge',
    drainClass: 'text-emerald-700',
    flowText:
      'Modern planned sector engineered with positive grading sloping away from building foundations.',
    velocity: '1,850 m²',
    drainCap: 's = 0.16',
    actionStatus: 'Unmodeled',
    statusMsg: 'Modern planned sector with high relative ground elevation (234.6m MSL).',
    photoUrl: '/assets/locations/ranjit-avenue.jpg',
  },
  'gndu-science': {
    key: 'gndu-science',
    code: 'ID: ASR-BLD-1192',
    name: 'GNDU University Science Block',
    areaTag: 'AREA: GURU NANAK DEV UNIVERSITY CAMPUS (AMRITSAR)',
    center: [31.6375, 74.825],
    zoom: 17,
    sink: [31.635, 74.822],
    baseScore: 19,
    risk: 'Minimal Risk',
    riskClass: 'text-emerald-700',
    baseGradient: 1.8,
    gradientText: '+1.8% Campus Ridge',
    baseElevation: 233.8,
    drain: 'Parkland Contour',
    drainClass: 'text-emerald-700',
    flowText:
      'Spacious campus parkland topography sheds surface runoff naturally toward peripheral unpaved retention greens.',
    velocity: '3,420 m²',
    drainCap: 's = 0.19',
    actionStatus: 'Unmodeled',
    statusMsg: 'Elevated university campus terrain with high permeable soil ratio.',
    photoUrl: '/assets/locations/gndu-science.jpg',
  },
  'putlighar-market': {
    key: 'putlighar-market',
    code: 'ID: ASR-BLD-2108',
    name: 'Putlighar GT Road Commercial Hub',
    areaTag: 'AREA: PUTLIGHAR GT ROAD CORRIDOR (AMRITSAR)',
    center: [31.631, 74.843],
    zoom: 17,
    sink: [31.6295, 74.8415],
    baseScore: 82,
    risk: 'High Exposure',
    riskClass: 'text-rose-700',
    baseGradient: -1.6,
    gradientText: '-1.6% Railway Basin',
    baseElevation: 227.4,
    drain: 'Embankment Bottleneck',
    drainClass: 'text-rose-700',
    flowText:
      'Direct storm catchment trapped against railway embankment culverts with historical storm pooling up to 50cm.',
    velocity: '1,650 m²',
    drainCap: 's = 0.82',
    actionStatus: 'Unmodeled',
    statusMsg: 'Copernicus DEM 30m confirms local depression pinned by southern railway line.',
    photoUrl: '/assets/locations/putlighar-market.jpg',
  },
  'batala-road': {
    key: 'batala-road',
    code: 'ID: ASR-BLD-4091',
    name: 'Batala Road & Vijay Nagar Sump',
    areaTag: 'AREA: BATALA ROAD INDUSTRIAL CORRIDOR (AMRITSAR)',
    center: [31.652, 74.896],
    zoom: 17,
    sink: [31.6505, 74.898],
    baseScore: 85,
    risk: 'High Exposure',
    riskClass: 'text-rose-700',
    baseGradient: -2.3,
    gradientText: '-2.3% Low Sump',
    baseElevation: 226.2,
    drain: 'Natural Sink',
    drainClass: 'text-rose-700',
    flowText:
      'Northern low-lying depression receiving heavy sheetflow from surrounding high-density residential wards.',
    velocity: '1,980 m²',
    drainCap: 's = 0.85',
    actionStatus: 'Unmodeled',
    statusMsg: 'Lowest local ground elevation in northern Amritsar industrial sector (226.2m MSL).',
    photoUrl: '/assets/locations/batala-road.jpg',
  },
  'durgiana-temple': {
    key: 'durgiana-temple',
    code: 'ID: ASR-BLD-0315',
    name: 'Durgiana Temple & Gol Bagh Basin',
    areaTag: 'AREA: DURGIANA TEMPLE ENVIRONS (AMRITSAR)',
    center: [31.627, 74.869],
    zoom: 17,
    sink: [31.6255, 74.871],
    baseScore: 68,
    risk: 'Moderate Exposure',
    riskClass: 'text-amber-700',
    baseGradient: -0.8,
    gradientText: '-0.8% Moat Basin',
    baseElevation: 227.1,
    drain: 'Historic Moat Depression',
    drainClass: 'text-amber-700',
    flowText:
      'Historic walled city perimeter moat basin collecting stormwater from Lohgarh and Hathi Gate corridors.',
    velocity: '2,750 m²',
    drainCap: 's = 0.68',
    actionStatus: 'Unmodeled',
    statusMsg: 'Topographic depression adjacent to Gol Bagh park and heritage temple precinct.',
    photoUrl: '/assets/locations/durgiana-temple.jpg',
  },
  'majitha-medical': {
    key: 'majitha-medical',
    code: 'ID: ASR-BLD-1520',
    name: 'Majitha Road Medical Enclave (GMC)',
    areaTag: 'AREA: MAJITHA ROAD HEALTH CORRIDOR (AMRITSAR)',
    center: [31.651, 74.878],
    zoom: 17,
    sink: [31.649, 74.88],
    baseScore: 24,
    risk: 'Low Exposure',
    riskClass: 'text-emerald-700',
    baseGradient: 1.2,
    gradientText: '+1.2% Crowned Grade',
    baseElevation: 231.5,
    drain: 'Graded Collector',
    drainClass: 'text-emerald-700',
    flowText:
      'Elevated medical hospital complex with positive asphalt crown discharging directly into storm drain trunk line.',
    velocity: '4,100 m²',
    drainCap: 's = 0.24',
    actionStatus: 'Unmodeled',
    statusMsg: 'Critical healthcare asset zone with well-maintained roadside drainage outfalls.',
    photoUrl: '/assets/locations/majitha-medical.jpg',
  },
  'lawrence-road': {
    key: 'lawrence-road',
    code: 'ID: ASR-BLD-0945',
    name: 'Lawrence Road & Novelty Chowk',
    areaTag: 'AREA: LAWRENCE ROAD COMMERCIAL CORRIDOR (AMRITSAR)',
    center: [31.639, 74.876],
    zoom: 17,
    sink: [31.6375, 74.8785],
    baseScore: 32,
    risk: 'Low Exposure',
    riskClass: 'text-emerald-700',
    baseGradient: 0.9,
    gradientText: '+0.9% Road Crown',
    baseElevation: 230.8,
    drain: 'Lateral Curb Gutter',
    drainClass: 'text-emerald-700',
    flowText:
      'Continuous paved commercial artery with positive camber shedding rainfall toward Novelty Chowk storm outfalls.',
    velocity: '1,280 m²',
    drainCap: 's = 0.32',
    actionStatus: 'Unmodeled',
    statusMsg: 'Commercial street corridor with moderate elevation (230.8m MSL).',
    photoUrl: '/assets/locations/lawrence-road.jpg',
  },
}

export function BuildingsSection() {
  const [activeAreaKey, setActiveAreaKey] = useState<string>('hall-gate')
  const area = AMRITSAR_AREAS[activeAreaKey] || AMRITSAR_AREAS['hall-gate']

  const [probeState, setProbeState] = useState({
    lat: area.center[0],
    lng: area.center[1],
    score: area.baseScore,
    elevation: area.baseElevation,
    gradient: area.baseGradient,
    distToSink: 0,
    isUserClick: false,
  })

  const handleProbeUpdate = (data: {
    lat: number
    lng: number
    dynamicScore: number
    dynamicElevation: number
    dynamicGradient: number
    distToSinkMeters: number
    isUserClick: boolean
  }) => {
    setProbeState({
      lat: data.lat,
      lng: data.lng,
      score: data.dynamicScore,
      elevation: data.dynamicElevation,
      gradient: data.dynamicGradient,
      distToSink: data.distToSinkMeters,
      isUserClick: data.isUserClick,
    })
  }

  const handleSelectArea = (key: string) => {
    setActiveAreaKey(key)
    const newArea = AMRITSAR_AREAS[key]
    if (newArea) {
      setProbeState({
        lat: newArea.center[0],
        lng: newArea.center[1],
        score: newArea.baseScore,
        elevation: newArea.baseElevation,
        gradient: newArea.baseGradient,
        distToSink: 0,
        isUserClick: false,
      })
    }
  }

  let riskLabel = 'High Exposure'
  let riskClass = 'text-rose-700'
  if (probeState.score <= 35) {
    riskLabel = 'Minimal Risk'
    riskClass = 'text-emerald-700'
  } else if (probeState.score <= 70) {
    riskLabel = 'Moderate Exposure'
    riskClass = 'text-amber-700'
  }

  const placePhotoUrl = area.photoUrl || '/assets/hall_gate_orig.jpg'
  const gmapsPlaceSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(area.name + ' Amritsar')}`

  return (
    <section className="tab-view active-view" id="view-buildings">
      <div className="page-wrapper">
        {/* Section Header */}
        <div className="section-title-wrap">
          <div className="trust-pill">
            <span className="pill-sparkle">🏛</span>
            <span className="pill-text">Pillar B — Urban Structure Footprint Exposure</span>
          </div>
          <h2 className="sub-section-heading">Geospatial Building Exposure Map</h2>
          <p className="sub-section-desc">
            Select any location under <strong>Critical Hotspot Structures</strong> to inspect modeled
            catchment exposure, or click directly on the map to inspect spatial coordinates and localized
            terrain depressions.
          </p>
        </div>

        {/* 2-Column Map Workspace */}
        <div className="building-workspace-grid">
          {/* Left: Hotspot Selection Column */}
          <div className="building-selector-column">
            <div className="neuro-card p-7">
              <div className="flex items-center justify-between mb-2">
                <h3 className="column-heading text-slate-900">Critical Hotspot Structures</h3>
                <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                  {Object.keys(AMRITSAR_AREAS).length} Locations
                </span>
              </div>
              <p className="column-subtext mb-3">
                Click any location below — the map instantly focuses onto that single building asset:
              </p>

              <div className="building-selector-list max-h-[460px] overflow-y-auto pr-1 space-y-2.5">
                {Object.values(AMRITSAR_AREAS).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`building-item ${activeAreaKey === item.key ? 'active-building' : ''}`}
                    onClick={() => handleSelectArea(item.key)}
                  >
                    <div className="flex justify-between items-center">
                      <strong className="item-name text-slate-900">{item.name}</strong>
                      <span
                        className={`risk-badge ${
                          item.baseScore > 70
                            ? 'badge-high'
                            : item.baseScore > 35
                              ? 'badge-med'
                              : 'badge-low'
                        }`}
                      >
                        {item.risk} ({item.baseScore}%)
                      </span>
                    </div>
                    <div className="item-meta">
                      <span className="text-slate-600">Footprint: {item.velocity}</span>
                      <span className="text-blue-700 font-medium">Elevation: {item.baseElevation}m MSL</span>
                      <span className="text-slate-500 truncate">Zone: {item.areaTag.replace('AREA: ', '')}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scientific Integrity Warning Notice */}
            <div className="neuro-card p-6 border-l-4 border-l-blue-700">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
                Amritsar Scientific Integrity Protocol
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                NEXSTORM couples Copernicus 30m DEM elevation sinks with 360,252 Google Open
                Buildings footprints. Indoor flood depth, plinth elevations, and underground pipe
                hydraulics are unmodeled to maintain strict scientific honesty.
              </p>
            </div>
          </div>

          {/* Right: Real Map Viewport Column */}
          <div className="building-map-column">
            <div className="neuro-card p-6 map-container-card">
              {/* Map Top Bar & Active Area Indicator */}
              <div className="map-toolbar">
                <div className="flex items-center gap-2">
                  <span className="map-live-dot"></span>
                  <span className="meta-tag text-blue-700" id="currentAreaTitle">
                    {area.areaTag}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                  <span>Interactive: Click anywhere on map to drop dynamic probe node</span>
                </div>
              </div>

              {/* Map Viewport with Floating HUD Overlay */}
              <div className="map-viewport relative" id="buildingMapWrapper">
                <DynamicBuildingMapCanvas
                  activeArea={area}
                  onProbeUpdate={handleProbeUpdate}
                />

                {/* Dynamic Map HUD Overlay Panel — With Authentic Landmark Photography */}
                <div className="map-hud-dossier !p-0 !overflow-hidden !w-[380px] max-w-[calc(100%-40px)] shadow-2xl" id="mapHudDossier">
                  {/* Authentic Building Landmark Image Banner */}
                  <div className="relative w-full h-[130px] bg-slate-900 overflow-hidden">
                    <img
                      src={placePhotoUrl}
                      alt={area.name}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      onError={(e) => {
                        const target = e.currentTarget as HTMLImageElement
                        target.src = '/assets/hall_gate_orig.jpg'
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none"></div>

                    {/* Top Left Tag: Area Code */}
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono text-white border border-white/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span id="hudCode">{area.code}</span>
                    </div>

                    {/* Top Right Tag: Dynamic Flood Exposure */}
                    <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md text-[10.5px] font-mono font-bold border border-white/20">
                      <span className={probeState.score > 70 ? 'text-rose-400' : probeState.score > 35 ? 'text-amber-400' : 'text-emerald-400'}>
                        {probeState.score}% Flood Exposure
                      </span>
                    </div>

                    {/* Bottom Overlay on Image: Name & Google Maps Link */}
                    <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                      <div className="min-w-0 pr-2">
                        <h4 className="text-white font-['Outfit'] font-bold text-sm sm:text-base leading-tight drop-shadow-sm truncate" id="hudName">
                          {area.name}
                        </h4>
                        <span className="text-[10px] text-slate-300 font-mono block mt-0.5 truncate">
                          {area.areaTag.replace('AREA: ', '')}
                        </span>
                      </div>
                      <a
                        href={gmapsPlaceSearchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-0.5 rounded bg-blue-600/90 hover:bg-blue-600 text-white text-[10px] font-semibold flex items-center gap-1 shadow-sm transition-all cursor-pointer shrink-0"
                        title="Open exact place listing on Google Maps"
                      >
                        Maps ↗
                      </a>
                    </div>
                  </div>

                  <div className="p-4 space-y-2.5">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                          <span
                            className="text-[11px] font-mono text-blue-900 font-semibold"
                            id="hudCoords"
                          >
                            {probeState.lat.toFixed(5)}° N, {probeState.lng.toFixed(5)}° E
                          </span>
                          <span
                            className={`text-[9px] uppercase tracking-wider font-bold ml-auto ${
                              probeState.isUserClick ? 'text-blue-700' : 'text-slate-500'
                            }`}
                            id="hudProbeStatus"
                          >
                            {probeState.isUserClick ? 'NODE RELOCATED' : 'PROBE DOCKED'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-2xl font-black ${riskClass}`} id="hudScore">
                          {probeState.score}
                          <span className="text-xs text-slate-400 font-normal">/100</span>
                        </span>
                        <span className={`block text-[10px] font-bold ${riskClass}`} id="hudRiskLabel">
                          {riskLabel}
                        </span>
                      </div>
                    </div>

                  {/* Live Dynamic Spatial Telemetry Grid */}
                  <div className="grid grid-cols-3 gap-2 my-2 py-2 border-y border-slate-200 text-left">
                    <div>
                      <span className="text-[10px] text-slate-500 block">Gradient</span>
                      <strong className="text-xs text-slate-900" id="hudGradient">
                        {probeState.gradient > 0 ? `+${probeState.gradient}` : probeState.gradient}%{' '}
                        {probeState.gradient < 0 ? 'Sink' : 'Slope'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Elevation</span>
                      <strong className="text-xs text-slate-900" id="hudElevation">
                        {probeState.elevation}m MSL
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">Drain Status</span>
                      <strong className={`text-xs font-bold ${area.drainClass}`} id="hudDrain">
                        {area.drain}
                      </strong>
                    </div>
                  </div>

                  {/* Dynamic Vector Flow Indicator Note */}
                  <div className="hud-flow-notice">
                    <span className="text-blue-700 font-bold">&rarr;</span>
                    <span className="text-xs text-slate-700" id="hudFlowText">
                      {probeState.isUserClick
                        ? `Dynamic probe node placed at ${probeState.lat.toFixed(4)}°N. Local sheetflow vector traces ${probeState.distToSink}m runoff directly toward localized catchment sink.`
                        : area.flowText}
                    </span>
                  </div>
                </div>
              </div>
            </div>

              {/* Clean, Centralized Telemetry Bar Under Map */}
              <div className="map-central-telemetry">
                <div className="central-telemetry-inner">
                  <div className="telemetry-metric-unit">
                    <span className="telemetry-metric-val text-slate-900" id="centralQPeak">
                      {area.velocity}
                    </span>
                    <span className="telemetry-metric-label text-slate-500">Metric Footprint Area</span>
                  </div>

                  <div className="telemetry-sep-divider"></div>

                  <div className="telemetry-metric-unit">
                    <span className="telemetry-metric-val text-amber-700" id="centralDrainCap">
                      {area.drainCap}
                    </span>
                    <span className="telemetry-metric-label text-slate-500">Catchment Susceptibility</span>
                  </div>

                  <div className="telemetry-sep-divider"></div>

                  <div className="telemetry-metric-unit">
                    <span className="telemetry-metric-val text-slate-700" id="centralActionStatus">
                      {area.actionStatus}
                    </span>
                    <span className="telemetry-metric-label text-slate-500">Subsurface Hydraulics</span>
                  </div>
                </div>

                {/* Status Indicator */}
                <div className="telemetry-status-pill">
                  <span className="pulse-emerald-dot"></span>
                  <span id="centralStatusMsg" className="text-xs font-semibold text-slate-700">
                    {area.statusMsg}
                  </span>
                </div>
              </div>
            </div>

            {/* Premium Below-Map Insight: Building Risk Matrix */}
            <div className="below-map-insight">
              <div className="insight-header">
                <span className="insight-icon">📊</span>
                <div>
                  <span className="meta-tag text-indigo-700">BUILDING EXPOSURE SYNTHESIS</span>
                  <h4 className="insight-title">Macro-Catchment Exposure Distribution — Amritsar Hotspots</h4>
                </div>
              </div>
              <div className="insight-grid">
                <div className="insight-stat">
                  <span className="insight-stat-value text-rose-700">3,214</span>
                  <span className="insight-stat-label">High-Exposure Footprints</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-rose-500" style={{ width: '26%' }}></div>
                  </div>
                </div>
                <div className="insight-stat">
                  <span className="insight-stat-value text-amber-700">5,842</span>
                  <span className="insight-stat-label">Moderate-Exposure Footprints</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-amber-500" style={{ width: '47%' }}></div>
                  </div>
                </div>
                <div className="insight-stat">
                  <span className="insight-stat-value text-emerald-700">3,424</span>
                  <span className="insight-stat-label">Low-Exposure Footprints</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-emerald-500" style={{ width: '27%' }}></div>
                  </div>
                </div>
              </div>
              <div className="insight-footnote">
                <span className="text-slate-500">Data Pipeline:</span>
                <span className="text-blue-700 font-semibold">Copernicus DEM 30m</span>
                <span className="insight-dot">&bull;</span>
                <span className="text-emerald-700 font-semibold">Google Open Buildings V3</span>
                <span className="insight-dot">&bull;</span>
                <span className="text-indigo-700 font-semibold">ERA5 Reanalysis</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
