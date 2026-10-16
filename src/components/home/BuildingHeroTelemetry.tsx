'use client'

import React from 'react'
import type { AreaData } from './BuildingMapCanvas'

interface BuildingProfileItem {
  key: string
  name: string
  exposureLabel: string
  score: number
  riskClass: 'low' | 'med' | 'high'
  footprint: string
  elevation: string
  zoneOrPlinth: string
}

const MONITORED_PROFILES: BuildingProfileItem[] = [
  {
    key: 'hall-gate',
    name: 'Hall Gate Commercial Basin',
    exposureLabel: 'High Exposure',
    score: 88,
    riskClass: 'high',
    footprint: '1,420 m²',
    elevation: '226.8m MSL',
    zoneOrPlinth: 'Plinth: -1.9% Sump Basin • Heavy sheetflow convergence',
  },
  {
    key: 'batala-road',
    name: 'Batala Road Industrial Corridor',
    exposureLabel: 'High Exposure',
    score: 85,
    riskClass: 'high',
    footprint: '1,980 m²',
    elevation: '226.2m MSL',
    zoneOrPlinth: 'Plinth: -2.3% Low Sump • Northern local depression',
  },
  {
    key: 'putlighar-market',
    name: 'Putlighar GT Road Commercial Hub',
    exposureLabel: 'High Exposure',
    score: 82,
    riskClass: 'high',
    footprint: '1,650 m²',
    elevation: '227.4m MSL',
    zoneOrPlinth: 'Plinth: -1.6% Embankment • Railway culvert bottleneck',
  },
  {
    key: 'durgiana-temple',
    name: 'Durgiana Temple Environs',
    exposureLabel: 'Moderate Exposure',
    score: 68,
    riskClass: 'med',
    footprint: '2,750 m²',
    elevation: '227.1m MSL',
    zoneOrPlinth: 'Plinth: -0.8% Moat Basin • Heritage precinct catchment',
  },
  {
    key: 'heritage-street',
    name: 'Heritage Street Pedestrian Axis',
    exposureLabel: 'Moderate Exposure',
    score: 62,
    riskClass: 'med',
    footprint: '2,150 m²',
    elevation: '228.4m MSL',
    zoneOrPlinth: 'Plinth: +0.3% Flat Gutter • Historic walled city depression',
  },
  {
    key: 'lawrence-road',
    name: 'Lawrence Road & Novelty Chowk',
    exposureLabel: 'Low Exposure',
    score: 32,
    riskClass: 'low',
    footprint: '1,280 m²',
    elevation: '230.8m MSL',
    zoneOrPlinth: 'Plinth: +0.9% Road Crown • Lateral curb gutter outfall',
  },
  {
    key: 'mall-road',
    name: 'Mall Road & Civil Lines District',
    exposureLabel: 'Low Exposure',
    score: 28,
    riskClass: 'low',
    footprint: '980 m²',
    elevation: '232.1m MSL',
    zoneOrPlinth: 'Plinth: +1.4% Crowned Axis • Rapid runoff shedding',
  },
  {
    key: 'majitha-medical',
    name: 'Majitha Road Medical Enclave (GMC)',
    exposureLabel: 'Low Exposure',
    score: 24,
    riskClass: 'low',
    footprint: '4,100 m²',
    elevation: '231.5m MSL',
    zoneOrPlinth: 'Plinth: +1.2% Graded Collector • Hospital trunk line',
  },
  {
    key: 'gndu-science',
    name: 'GNDU University Science Block',
    exposureLabel: 'Minimal Risk',
    score: 19,
    riskClass: 'low',
    footprint: '3,420 m²',
    elevation: '233.8m MSL',
    zoneOrPlinth: 'Plinth: +1.8% Campus Ridge • Parkland soil absorption',
  },
  {
    key: 'ranjit-avenue',
    name: 'Ranjit Avenue Sector D Complex',
    exposureLabel: 'Minimal Risk',
    score: 16,
    riskClass: 'low',
    footprint: '1,850 m²',
    elevation: '234.6m MSL',
    zoneOrPlinth: 'Plinth: +2.2% Engineered Ridge • Planned positive slope',
  },
]

interface BuildingHeroTelemetryProps {
  activeArea: AreaData
  probeState?: {
    lat: number
    lng: number
    score: number
    elevation: number
    gradient: number
    distToSink: number
    isUserClick: boolean
  }
  onSelectArea?: (key: string) => void
}

export function BuildingHeroTelemetry({
  activeArea,
  onSelectArea,
}: BuildingHeroTelemetryProps) {
  return (
    <div
      className="w-full max-w-[460px] h-[390px] sm:h-[410px] rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.03)] flex flex-col overflow-hidden transition-all duration-200 hover:shadow-[0_8px_32px_-4px_rgba(15,23,42,0.09)]"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-['Outfit'] tracking-tight">
          Structural Exposure Profiles
        </h3>
        <span className="text-xs font-mono font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200/90 shrink-0">
          {MONITORED_PROFILES.length} Locations
        </span>
      </div>

      {/* Subtext */}
      <p className="text-xs text-slate-500 font-sans leading-relaxed mb-3">
        Click any location below — the map instantly focuses onto that single building asset:
      </p>

      {/* Scrollable List of Building Profile Cards */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2.5 pr-1.5 select-none">
        {MONITORED_PROFILES.map((item) => {
          const isActive = activeArea.key === item.key

          // Pill badge color schemes matching the provided screenshot style
          let badgeStyles = 'bg-[#dcfce7] text-[#15803d]' // Green for Low/Minimal
          if (item.riskClass === 'high') {
            badgeStyles = 'bg-[#fee2e2] text-[#b91c1c]' // Red for High
          } else if (item.riskClass === 'med') {
            badgeStyles = 'bg-[#fef3c7] text-[#b45309]' // Amber for Moderate
          }

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectArea?.(item.key)}
              className={`w-full text-left rounded-2xl p-3.5 transition-all duration-150 border cursor-pointer ${
                isActive
                  ? 'bg-slate-50/90 border-slate-900 shadow-xs ring-1 ring-slate-900/10'
                  : 'bg-white hover:bg-slate-50/70 border-slate-200/90 hover:border-slate-300'
              }`}
            >
              {/* Item Header: Name & Badge */}
              <div className="flex justify-between items-start gap-2">
                <span className="text-sm font-bold text-slate-900 font-['Outfit'] leading-snug">
                  {item.name}
                </span>
                <span
                  className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full shrink-0 font-sans ${badgeStyles}`}
                >
                  {item.exposureLabel} ({item.score}%)
                </span>
              </div>

              {/* Item Meta 1: Footprint & Elevation */}
              <div className="text-xs text-slate-600 font-sans mt-2 flex items-center gap-2.5 flex-wrap">
                <span>Footprint: {item.footprint}</span>
                <span className="text-slate-400">&bull;</span>
                <span className="font-medium text-slate-900">
                  Elevation: {item.elevation}
                </span>
              </div>

              {/* Item Meta 2: Plinth / Zone Vulnerability */}
              <div className="text-[11px] text-slate-500 font-sans mt-1 truncate">
                {item.zoneOrPlinth}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
