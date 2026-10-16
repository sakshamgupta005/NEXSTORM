'use client'

import React, { useState } from 'react'
import { Activity, ShieldCheck, AlertCircle, Droplets, ArrowUpRight, CheckCircle2 } from 'lucide-react'

type RainfallScenario = 'baseline' | 'monsoon' | 'cloudburst'

interface HotspotItem {
  name: string
  elevation: string
  depth: Record<RainfallScenario, string>
  status: Record<RainfallScenario, { label: string; color: string; bg: string }>
}

const ZONES: HotspotItem[] = [
  {
    name: 'Hall Gate Underpass',
    elevation: '218.4m',
    depth: { baseline: '4.2 cm', monsoon: '26.8 cm', cloudburst: '44.5 cm' },
    status: {
      baseline: { label: 'Optimal', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
      monsoon: { label: 'Severe Sump', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
      cloudburst: { label: 'Inundated', color: 'text-rose-800', bg: 'bg-rose-100 border-rose-300' },
    },
  },
  {
    name: 'Batala Road Basin',
    elevation: '217.9m',
    depth: { baseline: '2.0 cm', monsoon: '18.4 cm', cloudburst: '36.2 cm' },
    status: {
      baseline: { label: 'Optimal', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
      monsoon: { label: 'Moderate Risk', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
      cloudburst: { label: 'Severe Risk', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
    },
  },
  {
    name: 'Mall Road Low-Lying Sump',
    elevation: '221.2m',
    depth: { baseline: '0.8 cm', monsoon: '11.5 cm', cloudburst: '24.0 cm' },
    status: {
      baseline: { label: 'Clear', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
      monsoon: { label: 'Elevated Flow', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
      cloudburst: { label: 'Chokepoint', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    },
  },
  {
    name: 'Golden Temple Heritage Ring',
    elevation: '226.5m',
    depth: { baseline: '0.0 cm', monsoon: '3.1 cm', cloudburst: '8.4 cm' },
    status: {
      baseline: { label: 'Clear', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
      monsoon: { label: 'Safe Runoff', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
      cloudburst: { label: 'Managed', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
    },
  },
]

export function CityHydroMonitor() {
  const [scenario, setScenario] = useState<RainfallScenario>('monsoon')

  const scenarioMeta = {
    baseline: {
      rainRate: '15 mm/h',
      discharge: '3.2 m³/s',
      affectedBasins: '2 of 14',
      statusText: 'Baseline Flow — Normal Drainage Capacity',
      statusColor: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    monsoon: {
      rainRate: '48 mm/h',
      discharge: '14.8 m³/s',
      affectedBasins: '9 of 14',
      statusText: 'Monsoon Convective Surge — Active Waterlogging',
      statusColor: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    cloudburst: {
      rainRate: '85 mm/h',
      discharge: '29.4 m³/s',
      affectedBasins: '14 of 14',
      statusText: 'Severe Cloudburst — Deterministic Rerouting',
      statusColor: 'text-rose-700 bg-rose-50 border-rose-200',
    },
  }

  const current = scenarioMeta[scenario]

  return (
    <div 
      className="w-full rounded-2xl bg-white border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.05)] p-5 sm:p-6 transition-all duration-300 relative overflow-hidden"
    >
      {/* Top Header Row with Live Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-slate-800 font-mono">
              Amritsar Hydro-Catchment Sentinel
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Copernicus 30m DEM • Real-time Deterministic Runoff
          </p>
        </div>

        {/* Clean Scenario Intensity Segmented Control */}
        <div className="flex items-center p-1 rounded-lg bg-slate-100/90 border border-slate-200/60 text-[11px] font-medium">
          {(['baseline', 'monsoon', 'cloudburst'] as RainfallScenario[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setScenario(mode)}
              className={`px-2.5 py-1 rounded-md transition-all duration-150 cursor-pointer capitalize font-semibold ${
                scenario === mode
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Main Hydrology Metric Cards */}
      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col justify-between">
          <span className="text-[10.5px] font-medium text-slate-500 uppercase tracking-tight">
            Rainfall Rate
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono tracking-tight">
              {current.rainRate}
            </span>
            <span className="text-[10px] text-slate-500 block">Peak Inflow</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col justify-between">
          <span className="text-[10.5px] font-medium text-slate-500 uppercase tracking-tight">
            Runoff Flux
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono tracking-tight">
              {current.discharge}
            </span>
            <span className="text-[10px] text-slate-500 block">Peak Basin Flow</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 flex flex-col justify-between">
          <span className="text-[10.5px] font-medium text-slate-500 uppercase tracking-tight">
            Sump Basins
          </span>
          <div className="mt-1">
            <span className="text-base sm:text-lg font-bold text-slate-900 font-mono tracking-tight">
              {current.affectedBasins}
            </span>
            <span className="text-[10px] text-slate-500 block">Critical Depressions</span>
          </div>
        </div>
      </div>

      {/* Modeled Topographic Depression Locations in Amritsar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-800">
            Critical Drainage Corridors
          </span>
          <span className="text-[10.5px] font-mono text-slate-500">
            Copernicus DEM Sinks
          </span>
        </div>

        <div className="space-y-1.5">
          {ZONES.map((zone) => {
            const status = zone.status[scenario]
            const depth = zone.depth[scenario]

            return (
              <div
                key={zone.name}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/60 hover:bg-slate-50 border border-slate-100/90 transition-all duration-150"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <div>
                    <span className="text-xs font-medium text-slate-900 block leading-tight">
                      {zone.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      Elevation: {zone.elevation}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold font-mono text-slate-800">
                    {depth}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom Dispatch Status Bar */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>A* Routing Engine: Sub-2ms Pathfinding</span>
        </div>
        <span className="font-mono text-[10px] text-slate-400">
          Grid Res: 250m
        </span>
      </div>
    </div>
  )
}
