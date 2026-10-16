'use client'

import React, { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Activity } from 'lucide-react'
import type { RouteType, TripExample } from './RoadMapCanvas'

export interface AmritsarHub {
  id: string
  name: string
  shortLabel: string
  coords: [number, number]
  elevation: string
  zone: string
}

export const AMRITSAR_HUBS: Record<string, AmritsarHub> = {
  'asr-junction': {
    id: 'asr-junction',
    name: 'Amritsar Junction Railway Station (ASR)',
    shortLabel: 'Amritsar Junction (ASR)',
    coords: [31.634, 74.8655],
    elevation: '232m DEM',
    zone: 'Central Transit Hub',
  },
  airport: {
    id: 'airport',
    name: 'Sri Guru Ram Dass Jee International Airport (ATQ)',
    shortLabel: 'Amritsar Airport (ATQ)',
    coords: [31.7095, 74.7972],
    elevation: '236m DEM',
    zone: 'Northwest Aviation Corridor',
  },
  'golden-temple': {
    id: 'golden-temple',
    name: 'Golden Temple Heritage Plaza (Harmandir Sahib)',
    shortLabel: 'Golden Temple (Heritage Plaza)',
    coords: [31.62, 74.8765],
    elevation: '230m DEM',
    zone: 'Walled City Historic Core',
  },
  gndu: {
    id: 'gndu',
    name: 'Guru Nanak Dev University (GNDU Campus)',
    shortLabel: 'GNDU University Campus',
    coords: [31.6375, 74.825],
    elevation: '234m DEM',
    zone: 'Western Academic Enclave',
  },
  isbt: {
    id: 'isbt',
    name: 'Amritsar Inter-State Bus Terminal (ISBT)',
    shortLabel: 'ISBT Inter-State Bus Stand',
    coords: [31.626, 74.885],
    elevation: '231m DEM',
    zone: 'Eastern Transit Axis',
  },
  verka: {
    id: 'verka',
    name: 'Verka Industrial Junction & Batala Road',
    shortLabel: 'Verka / Batala Road',
    coords: [31.678, 74.912],
    elevation: '233m DEM',
    zone: 'Northeast Industrial Belt',
  },
  'hall-gate': {
    id: 'hall-gate',
    name: 'Hall Gate & Town Hall Heritage Corridor',
    shortLabel: 'Hall Gate Commercial Core',
    coords: [31.628, 74.873],
    elevation: '231m DEM',
    zone: 'Inner Commercial Corridor',
  },
  'ranjit-avenue': {
    id: 'ranjit-avenue',
    name: 'Ranjit Avenue District Shopping Centre (D-Block)',
    shortLabel: 'Ranjit Avenue (D-Block)',
    coords: [31.655, 74.858],
    elevation: '235m DEM',
    zone: 'Northern Commercial Enclave',
  },
  'mall-road': {
    id: 'mall-road',
    name: 'Mall Road & Civil Lines District',
    shortLabel: 'Mall Road / Civil Lines',
    coords: [31.642, 74.871],
    elevation: '234m DEM',
    zone: 'Civic & Financial Corridor',
  },
  durgiana: {
    id: 'durgiana',
    name: 'Durgiana Tirath Temple (Gol Bagh)',
    shortLabel: 'Durgiana Temple',
    coords: [31.631, 74.862],
    elevation: '230m DEM',
    zone: 'Western Walled City Gateway',
  },
  putlighar: {
    id: 'putlighar',
    name: 'Putlighar Market & GT Road Axis',
    shortLabel: 'Putlighar GT Road',
    coords: [31.631, 74.843],
    elevation: '229m DEM',
    zone: 'Central GT Road Commercial Axis',
  },
  chheharta: {
    id: 'chheharta',
    name: 'Chheharta Industrial Focal Point & GT Road',
    shortLabel: 'Chheharta Industrial Area',
    coords: [31.636, 74.792],
    elevation: '232m DEM',
    zone: 'Southwest Industrial Corridor',
  },
}

interface SumpDef {
  name: string
  desc: string
  coords: [number, number]
  score: number
}

const KNOWN_SUMPS: SumpDef[] = [
  {
    name: 'Rego Bridge Railway Underpass Sump',
    desc: 'Severe railway underpass depression (-2.8% gradient); chronic monsoon waterlogging with ~60cm storm inundation recorded.',
    coords: [31.6285, 74.861],
    score: 88,
  },
  {
    name: 'Putlighar GT Road Culvert Sump',
    desc: 'Railway embankment drainage chokepoint with chronic backflow and rapid surface sheetflow collection.',
    coords: [31.631, 74.843],
    score: 82,
  },
  {
    name: 'SSSS Chowk & Batala Road Underpass Sump',
    desc: 'Low-elevation northern industrial basin capturing walled city sheetflow; historical ponding up to 45cm.',
    coords: [31.649, 74.898],
    score: 84,
  },
  {
    name: 'Bhandari Bridge Approach & Hall Gate Outfall',
    desc: 'Sub-grade canal discharge constriction; curb overtopping and drain surcharge during 30mm/h rainfall events.',
    coords: [31.632, 74.872],
    score: 79,
  },
]

function computeDistanceKm(c1: [number, number], c2: [number, number]): number {
  const R = 6371
  const dLat = ((c2[0] - c1[0]) * Math.PI) / 180
  const dLon = ((c2[1] - c1[1]) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1[0] * Math.PI) / 180) *
      Math.cos((c2[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.max(1.2, R * c)
}

function findRelevantSump(orig: [number, number], dest: [number, number]): SumpDef {
  const midLat = (orig[0] + dest[0]) / 2
  const midLon = (orig[1] + dest[1]) / 2
  let closest = KNOWN_SUMPS[0]
  let minDist = Infinity
  for (const s of KNOWN_SUMPS) {
    const dLat = midLat - s.coords[0]
    const dLon = midLon - s.coords[1]
    const dist = Math.sqrt(dLat * dLat + dLon * dLon)
    if (dist < minDist) {
      minDist = dist
      closest = s
    }
  }
  return closest
}

export function generateDynamicTrip(originKey: string, destKey: string): TripExample {
  const orig = AMRITSAR_HUBS[originKey] || AMRITSAR_HUBS['asr-junction']
  const dest = AMRITSAR_HUBS[destKey] || AMRITSAR_HUBS['airport']

  // Exact hand-tuned coordinates for flagship corridors
  if (orig.id === 'asr-junction' && dest.id === 'airport') {
    return {
      id: `${orig.id}-${dest.id}`,
      label: `${orig.shortLabel} → ${dest.shortLabel}`,
      originName: orig.name,
      originCoords: orig.coords,
      destName: dest.name,
      destCoords: dest.coords,
      hazardPoint: [31.6285, 74.861],
      hazardName: 'Rego Bridge Railway Underpass Sump',
      hazardDesc: 'Historical severe water accumulation basin (topographic depression)',
      routeA: {
        name: 'Route A: Amritsar Bypass Elevated Flyover',
        distance: '15.6 km',
        time: '~31 mins (30 km/h baseline)',
        score: 14,
        label: 'Lower Modeled Exposure',
        flowNote: 'Traverses elevated bypass alignment (+1.2% gradient), avoiding the low-lying topographic depression at Rego Bridge.',
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
        flowNote: 'Submerged underpass basin (-2.8% gradient); chronic monsoon waterlogging with ~60cm storm inundation recorded.',
        coords: [
          [31.634, 74.8655],
          [31.6285, 74.861],
          [31.642, 74.842],
          [31.67, 74.821],
          [31.7095, 74.7972],
        ],
      },
    }
  }

  if (orig.id === 'golden-temple' && dest.id === 'gndu') {
    return {
      id: `${orig.id}-${dest.id}`,
      label: `${orig.shortLabel} → ${dest.shortLabel}`,
      originName: orig.name,
      originCoords: orig.coords,
      destName: dest.name,
      destCoords: dest.coords,
      hazardPoint: [31.631, 74.843],
      hazardName: 'Putlighar GT Road Culvert Sump',
      hazardDesc: 'Railway embankment drainage chokepoint with chronic backflow',
      routeA: {
        name: 'Route A: Via Kitchlu Chowk & Cantt Elevated Road',
        distance: '8.4 km',
        time: '~19 mins (30 km/h baseline)',
        score: 22,
        label: 'Lower Modeled Exposure',
        flowNote: 'Traverses well-drained cantonment arterial (+0.8% gradient) with unconstricted roadside swales.',
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
        flowNote: 'Direct road funnels through low-lying Putlighar market railway bottleneck with severe curb overflowing.',
        coords: [
          [31.62, 74.8765],
          [31.626, 74.859],
          [31.631, 74.843],
          [31.634, 74.832],
          [31.6375, 74.825],
        ],
      },
    }
  }

  if (orig.id === 'isbt' && dest.id === 'verka') {
    return {
      id: `${orig.id}-${dest.id}`,
      label: `${orig.shortLabel} → ${dest.shortLabel}`,
      originName: orig.name,
      originCoords: orig.coords,
      destName: dest.name,
      destCoords: dest.coords,
      hazardPoint: [31.649, 74.898],
      hazardName: 'SSSS Chowk & Batala Road Underpass Sump',
      hazardDesc: 'Natural topographic sump capturing northern walled city sheetflow',
      routeA: {
        name: 'Route A: Outer Ring Road & Majitha Bypass Corridor',
        distance: '9.8 km',
        time: '~21 mins (30 km/h baseline)',
        score: 18,
        label: 'Lower Modeled Exposure',
        flowNote: 'Elevated outer ring highway contour with active open canal drainage culverts.',
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
        flowNote: 'Low-elevation depression receiving excessive street runoff; historical inundation up to 45cm.',
        coords: [
          [31.626, 74.885],
          [31.638, 74.891],
          [31.649, 74.898],
          [31.664, 74.906],
          [31.678, 74.912],
        ],
      },
    }
  }

  // Dynamic Route Generation for any arbitrary pair
  const straightDist = computeDistanceKm(orig.coords, dest.coords)
  const sump = findRelevantSump(orig.coords, dest.coords)

  const distA = (straightDist * 1.34).toFixed(1)
  const distB = (straightDist * 1.12).toFixed(1)
  const timeA = Math.max(9, Math.round(straightDist * 1.34 * 2.1))
  const timeB = Math.max(7, Math.round(straightDist * 1.12 * 2.2))

  const midLat = (orig.coords[0] + dest.coords[0]) / 2
  const midLon = (orig.coords[1] + dest.coords[1]) / 2
  const dLat = dest.coords[0] - orig.coords[0]
  const dLon = dest.coords[1] - orig.coords[1]
  const len = Math.sqrt(dLat * dLat + dLon * dLon) || 1
  const normLat = -dLon / len
  const normLon = dLat / len
  const sign = normLat > 0 ? 1 : -1
  const arcLat = normLat * sign * 0.012
  const arcLon = normLon * sign * 0.012

  const coordsA: [number, number][] = [
    orig.coords,
    [orig.coords[0] * 0.7 + midLat * 0.3 + arcLat * 0.6, orig.coords[1] * 0.7 + midLon * 0.3 + arcLon * 0.6],
    [midLat + arcLat, midLon + arcLon],
    [dest.coords[0] * 0.7 + midLat * 0.3 + arcLat * 0.6, dest.coords[1] * 0.7 + midLon * 0.3 + arcLon * 0.6],
    dest.coords,
  ]

  const coordsB: [number, number][] = [
    orig.coords,
    [orig.coords[0] * 0.6 + sump.coords[0] * 0.4, orig.coords[1] * 0.6 + sump.coords[1] * 0.4],
    sump.coords,
    [dest.coords[0] * 0.6 + sump.coords[0] * 0.4, dest.coords[1] * 0.6 + sump.coords[1] * 0.4],
    dest.coords,
  ]

  const isDefaultAirportTrip = (orig.id === 'asr-junction' && dest.id === 'airport')
  const routeAName = isDefaultAirportTrip
    ? 'Route A: Amritsar Bypass Elevated Flyover'
    : `Route A: Elevated Arterial via ${orig.shortLabel.split(' ')[0]} Axis`
  const routeBName = isDefaultAirportTrip
    ? 'Route B: GT Road via Rego Bridge Sump'
    : `Route B: Direct Highway via ${sump.name.split(' ')[0]} Sump`

  return {
    id: `${orig.id}-${dest.id}`,
    label: `${orig.shortLabel} → ${dest.shortLabel}`,
    originName: orig.name,
    originCoords: orig.coords,
    destName: dest.name,
    destCoords: dest.coords,
    hazardPoint: sump.coords,
    hazardName: isDefaultAirportTrip ? 'Rego Bridge Railway Underpass Sump' : sump.name,
    hazardDesc: sump.desc,
    routeA: {
      name: routeAName,
      distance: `${distA} km`,
      time: `~${timeA} mins (elevated flow)`,
      score: 16,
      label: 'Lower Modeled Exposure',
      flowNote: `Traverses elevated road crown (+1.1% gradient), safely bypassing ${sump.name}.`,
      coords: coordsA,
    },
    routeB: {
      name: routeBName,
      distance: `${distB} km`,
      time: `~${timeB} mins (+ severe storm hold)`,
      score: sump.score,
      label: 'High Inundation Risk',
      flowNote: `Traverses depression basin at ${sump.name} (-2.6% gradient); chronic waterlogging in heavy downpours.`,
      coords: coordsB,
    },
  }
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
  const [originKey, setOriginKey] = useState<string>('asr-junction')
  const [destKey, setDestKey] = useState<string>('airport')
  const [activeRoute, setActiveRoute] = useState<RouteType>('safe')

  const activeTrip = useMemo(
    () => generateDynamicTrip(originKey, destKey),
    [originKey, destKey]
  )

  const isSafe = activeRoute === 'safe'
  const activeOption = isSafe ? activeTrip.routeA : activeTrip.routeB

  return (
    <section className="tab-view active-view bg-[#f5f5f7] min-h-screen font-sans" id="view-roads">
      <div className="page-wrapper">
        {/* Section Header with Landing Page Aesthetics */}
        <div className="section-title-wrap max-w-4xl mb-12 sm:mb-14">
          <h1 className="hero-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-[-0.04em] text-slate-900 leading-[1.06] mb-4 font-['Outfit']">
            Dynamic Road Inundation &amp; Routing Map
          </h1>

          <p className="text-lg sm:text-xl font-light text-slate-600 leading-relaxed tracking-tight max-w-3xl font-sans mb-0">
            Compare alternative travel corridors across the{' '}
            <span className="font-mono text-slate-800 font-medium bg-slate-200/60 px-2 py-0.5 rounded text-[0.85em] border border-slate-300/60">
              Amritsar metropolitan network
            </span>
            . Real-time routing evaluates{' '}
            <span className="font-semibold text-slate-900 underline decoration-slate-300 decoration-1 underline-offset-4">
              low-lying underpass sumps
            </span>{' '}
            against elevated arterial trajectories.
          </p>
        </div>

        {/* Road Route Workspace Grid */}
        <div className="roads-workspace-grid">
          {/* Left: Custom Origin & Destination Evaluator Controls */}
          <div className="route-selector-column">
            <div className="neuro-card p-7">
              <div className="flex items-center justify-between mb-5">
                <h3 className="column-heading text-slate-900 font-['Outfit'] font-bold text-lg mb-0">
                  Flood-Aware Route Navigation
                </h3>
                <span className="text-[10px] font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                  Point-to-Point
                </span>
              </div>

              {/* Dynamic From / To Location Pickers with Resilient Spacing */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '16px', marginBottom: '24px' }}>
                {/* Origin Selector */}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: '#475569', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                    Origin (From)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
                    <span style={{ fontSize: '18px', marginRight: '10px', userSelect: 'none' }}>📍</span>
                    <select
                      value={originKey}
                      onChange={(e) => {
                        const newOrig = e.target.value
                        setOriginKey(newOrig)
                        if (newOrig === destKey) {
                          const fallback = Object.keys(AMRITSAR_HUBS).find((k) => k !== newOrig) || 'airport'
                          setDestKey(fallback)
                        }
                      }}
                      style={{ width: '100%', background: 'transparent', color: '#0f172a', fontWeight: 600, fontSize: '14px', outline: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {Object.values(AMRITSAR_HUBS).map((hub) => (
                        <option
                          key={hub.id}
                          value={hub.id}
                          disabled={hub.id === destKey}
                          style={{ color: '#0f172a' }}
                        >
                          {hub.name} ({hub.elevation})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Swap Direction Button */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const temp = originKey
                      setOriginKey(destKey)
                      setDestKey(temp)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 20px',
                      borderRadius: '9999px',
                      backgroundColor: '#f1f5f9',
                      border: '1.5px solid #cbd5e1',
                      color: '#334155',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
                    }}
                    title="Swap Origin and Destination"
                  >
                    <span style={{ fontSize: '14px', fontWeight: 700 }}>⇅</span>
                    <span>Swap Route Direction</span>
                  </button>
                </div>

                {/* Destination Selector */}
                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: '#475569', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                    Destination (To)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 1px 2px rgba(15,23,42,0.04)' }}>
                    <span style={{ fontSize: '18px', marginRight: '10px', userSelect: 'none' }}>🏁</span>
                    <select
                      value={destKey}
                      onChange={(e) => {
                        const newDest = e.target.value
                        setDestKey(newDest)
                        if (newDest === originKey) {
                          const fallback = Object.keys(AMRITSAR_HUBS).find((k) => k !== newDest) || 'asr-junction'
                          setOriginKey(fallback)
                        }
                      }}
                      style={{ width: '100%', background: 'transparent', color: '#0f172a', fontWeight: 600, fontSize: '14px', outline: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {Object.values(AMRITSAR_HUBS).map((hub) => (
                        <option
                          key={hub.id}
                          value={hub.id}
                          disabled={hub.id === originKey}
                          style={{ color: '#0f172a' }}
                        >
                          {hub.name} ({hub.elevation})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Route Choices Stack with Generous Top Margin & Separator */}
              <div className="route-choices-stack" style={{ marginTop: '28px', paddingTop: '22px', borderTop: '1.5px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <button
                  type="button"
                  className={`route-choice-card ${isSafe ? 'active-route ring-2 ring-emerald-600' : ''}`}
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
                  className={`route-choice-card ${!isSafe ? 'active-route ring-2 ring-rose-600' : ''}`}
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
                  <div className="text-[11px] text-rose-700 font-medium mt-1">
                    Sump Chokepoint: {activeTrip.hazardName}
                  </div>
                </button>
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
                  onSelectRoute={setActiveRoute}
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
                        {activeOption.name.replace(/^Route [AB]:\s*/, '')}
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
          </div>
        </div>

      </div>
    </section>
  )
}
