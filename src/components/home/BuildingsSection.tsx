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

const AMRITSAR_AREAS: Record<string, AreaData> = {
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
    drain: 'Severe Choke',
    drainClass: 'text-rose-700',
    flowText:
      'Surface sheetflow descending into Hall Bazaar low-elevation depression. Historic brick storm ducts operating at full surcharge.',
    velocity: '2.84 m/s',
    drainCap: '88%',
    actionStatus: 'Dispatched',
    statusMsg: 'Amritsar Municipal Corporation active dewatering deployed at Hall Gate basin',
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
      'Paved pedestrian corridor channels sheetflow along lateral gutters toward Katra Ahluwalia subterranean detention duct.',
    velocity: '1.65 m/s',
    drainCap: '65%',
    actionStatus: 'Monitoring',
    statusMsg: 'Subterranean detention chambers opened at Town Hall interchange',
  },
  'mall-road': {
    key: 'mall-road',
    code: 'ID: ASR-BLD-0820',
    name: 'Mall Road & Civil Lines District',
    areaTag: 'AREA: MALL ROAD & CIVIL LINES CORRIDOR (AMRITSAR)',
    center: [31.6425, 74.8685],
    zoom: 17,
    sink: [31.6408, 74.871],
    baseScore: 28,
    risk: 'Low Hazard',
    riskClass: 'text-emerald-700',
    baseGradient: 1.4,
    gradientText: '+1.4% Crowned Axis',
    baseElevation: 232.1,
    drain: 'High-Flow Trunk',
    drainClass: 'text-emerald-700',
    flowText:
      'Positive road crown rapidly conveys rainfall away from storefronts into Court Road high-flow storm trunk with outfall to circular drain.',
    velocity: '1.10 m/s',
    drainCap: '42%',
    actionStatus: 'Standby',
    statusMsg: 'Automated monitoring active; storm pumps on standby',
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
    drain: 'Permeable Bioswales',
    drainClass: 'text-emerald-700',
    flowText:
      'Modern planned sector engineered with permeable perimeter swales and detention park basins sloping away from building foundations.',
    velocity: '0.62 m/s',
    drainCap: '24%',
    actionStatus: 'Green',
    statusMsg: 'Bioswales actively absorbing runoff; zero municipal pumping required',
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
            Click any location under <strong>Critical Hotspot Structures</strong>. The map
            automatically navigates to that single focused area. Click directly on the map to drop
            dynamic risk nodes with animated vector arrows and real-time exposure telemetry.
          </p>
        </div>

        {/* 2-Column Map Workspace */}
        <div className="building-workspace-grid">
          {/* Left: Hotspot Selection Column */}
          <div className="building-selector-column">
            <div className="neuro-card p-7">
              <h3 className="column-heading text-slate-900">Critical Hotspot Structures</h3>
              <p className="column-subtext">
                Click any location below — the map instantly focuses onto that single area:
              </p>

              <div className="building-selector-list">
                {/* Item 1: Hall Gate Basin */}
                <button
                  type="button"
                  className={`building-item ${activeAreaKey === 'hall-gate' ? 'active-building' : ''}`}
                  onClick={() => handleSelectArea('hall-gate')}
                >
                  <div className="flex justify-between items-center">
                    <strong className="item-name text-slate-900">Hall Gate Commercial Basin</strong>
                    <span className="risk-badge badge-high">High Exposure (88%)</span>
                  </div>
                  <div className="item-meta">
                    <span className="text-slate-600">Footprint: 1,420 m²</span>
                    <span className="text-blue-700 font-medium">Elevation: 226.8m MSL</span>
                    <span className="text-slate-500">Zone: Amritsar Walled City Basin</span>
                  </div>
                </button>

                {/* Item 2: Heritage Street */}
                <button
                  type="button"
                  className={`building-item ${activeAreaKey === 'heritage-street' ? 'active-building' : ''}`}
                  onClick={() => handleSelectArea('heritage-street')}
                >
                  <div className="flex justify-between items-center">
                    <strong className="item-name text-slate-900">
                      Heritage Street &amp; Golden Temple Axis
                    </strong>
                    <span className="risk-badge badge-med">Moderate Exposure (62%)</span>
                  </div>
                  <div className="item-meta">
                    <span className="text-slate-600">Footprint: 2,150 m²</span>
                    <span className="text-blue-700 font-medium">Elevation: 228.4m MSL</span>
                    <span className="text-slate-500">Zone: Heritage Pedestrian Axis</span>
                  </div>
                </button>

                {/* Item 3: Mall Road District */}
                <button
                  type="button"
                  className={`building-item ${activeAreaKey === 'mall-road' ? 'active-building' : ''}`}
                  onClick={() => handleSelectArea('mall-road')}
                >
                  <div className="flex justify-between items-center">
                    <strong className="item-name text-slate-900">
                      Mall Road &amp; Civil Lines Corridor
                    </strong>
                    <span className="risk-badge badge-low">Low Hazard (28%)</span>
                  </div>
                  <div className="item-meta">
                    <span className="text-slate-600">Footprint: 980 m²</span>
                    <span className="text-emerald-700 font-medium">Elevation: 232.1m MSL</span>
                    <span className="text-slate-500">Zone: Civil Lines Commercial</span>
                  </div>
                </button>

                {/* Item 4: Ranjit Avenue */}
                <button
                  type="button"
                  className={`building-item ${activeAreaKey === 'ranjit-avenue' ? 'active-building' : ''}`}
                  onClick={() => handleSelectArea('ranjit-avenue')}
                >
                  <div className="flex justify-between items-center">
                    <strong className="item-name text-slate-900">
                      Ranjit Avenue Sector D Complex
                    </strong>
                    <span className="risk-badge badge-low">Minimal Risk (16%)</span>
                  </div>
                  <div className="item-meta">
                    <span className="text-slate-600">Footprint: 1,850 m²</span>
                    <span className="text-emerald-700 font-medium">Elevation: 234.6m MSL</span>
                    <span className="text-slate-500">Zone: Engineered Modern Sector</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Scientific Integrity Warning Notice */}
            <div className="neuro-card p-6 border-l-4 border-l-blue-700">
              <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2">
                Amritsar Scientific Integrity Protocol
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                NEXSTORM couples Copernicus 30m DEM elevation sinks with Amritsar Municipal
                Corporation trunk drainage maps. Sump backwater levels are computed deterministically.
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

                {/* Dynamic Map HUD Overlay Panel */}
                <div className="map-hud-dossier" id="mapHudDossier">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span
                        className="text-[10px] font-bold text-blue-700 tracking-wider"
                        id="hudCode"
                      >
                        {area.code}
                      </span>
                      <h4 className="text-base font-bold text-slate-900" id="hudName">
                        {area.name}
                      </h4>
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

              {/* Clean, Centralized Telemetry Bar Under Map */}
              <div className="map-central-telemetry">
                <div className="central-telemetry-inner">
                  <div className="telemetry-metric-unit">
                    <span className="telemetry-metric-val text-slate-900" id="centralQPeak">
                      {area.velocity}
                    </span>
                    <span className="telemetry-metric-label text-slate-500">Runoff Velocity</span>
                  </div>

                  <div className="telemetry-sep-divider"></div>

                  <div className="telemetry-metric-unit">
                    <span className="telemetry-metric-val text-amber-700" id="centralDrainCap">
                      {area.drainCap}
                    </span>
                    <span className="telemetry-metric-label text-slate-500">Drain Surcharge</span>
                  </div>

                  <div className="telemetry-sep-divider"></div>

                  <div className="telemetry-metric-unit">
                    <span className="telemetry-metric-val text-emerald-700" id="centralActionStatus">
                      {area.actionStatus}
                    </span>
                    <span className="telemetry-metric-label text-slate-500">Mitigation Squad</span>
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
                  <h4 className="insight-title">Structural Risk Distribution — Amritsar Metropolitan</h4>
                </div>
              </div>
              <div className="insight-grid">
                <div className="insight-stat">
                  <span className="insight-stat-value text-rose-700">3,214</span>
                  <span className="insight-stat-label">High-Risk Structures</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-rose-500" style={{ width: '26%' }}></div>
                  </div>
                </div>
                <div className="insight-stat">
                  <span className="insight-stat-value text-amber-700">5,842</span>
                  <span className="insight-stat-label">Moderate-Risk Structures</span>
                  <div className="insight-bar">
                    <div className="insight-bar-fill bg-amber-500" style={{ width: '47%' }}></div>
                  </div>
                </div>
                <div className="insight-stat">
                  <span className="insight-stat-value text-emerald-700">3,424</span>
                  <span className="insight-stat-label">Low-Risk Structures</span>
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
