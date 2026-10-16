import React from 'react'
import type { RiskClass } from '@/lib/risk/types'

interface LegendProps {
  classShare?: {
    low: number
    moderate: number
    high: number
  }
  activeLayer?: 'risk' | 'susceptibility'
}

export const RISK_COLORS: Record<RiskClass, { fill: string; stroke: string; label: string; textClass: string }> = {
  low: {
    fill: '#38bdf8', // Sky 400 (color-blind friendly low)
    stroke: '#0284c7',
    label: 'Low Risk',
    textClass: 'text-sky-700 dark:text-sky-400',
  },
  moderate: {
    fill: '#f59e0b', // Amber 500
    stroke: '#b45309',
    label: 'Moderate Risk',
    textClass: 'text-amber-700 dark:text-amber-400',
  },
  high: {
    fill: '#dc2626', // Red 600
    stroke: '#991b1b',
    label: 'High Risk',
    textClass: 'text-rose-700 dark:text-rose-400',
  },
}

export function Legend({ classShare, activeLayer = 'risk' }: LegendProps) {
  const lowPct = Math.round((classShare?.low ?? 0) * 100)
  const modPct = Math.round((classShare?.moderate ?? 0) * 100)
  const highPct = Math.round((classShare?.high ?? 0) * 100)

  return (
    <div
      data-testid="map-legend"
      className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 space-y-4"
    >
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
          {activeLayer === 'susceptibility'
            ? 'Topographic Susceptibility Scale (s)'
            : 'Waterlogging Risk Classification'}
        </h4>
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
          {activeLayer === 'susceptibility' ? 'Static Terrain [0, 1]' : 'Sequential Scale'}
        </span>
      </div>

      {activeLayer === 'susceptibility' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-md border flex items-center justify-center font-bold text-[10px] text-white shadow-xs shrink-0"
                style={{ backgroundColor: RISK_COLORS.high.fill, borderColor: RISK_COLORS.high.stroke }}
                aria-hidden="true"
              >
                H
              </span>
              <span className="font-semibold text-rose-700 dark:text-rose-400">
                High Susceptibility (s &gt; 0.66)
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Depression</span>
          </div>

          <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-md border flex items-center justify-center font-bold text-[10px] text-white shadow-xs shrink-0"
                style={{ backgroundColor: RISK_COLORS.moderate.fill, borderColor: RISK_COLORS.moderate.stroke }}
                aria-hidden="true"
              >
                M
              </span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                Moderate (0.33–0.66)
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Intermediate</span>
          </div>

          <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/60">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-md border flex items-center justify-center font-bold text-[10px] text-white shadow-xs shrink-0"
                style={{ backgroundColor: RISK_COLORS.low.fill, borderColor: RISK_COLORS.low.stroke }}
                aria-hidden="true"
              >
                L
              </span>
              <span className="font-semibold text-sky-700 dark:text-sky-400">
                Low Susceptibility (s &lt; 0.33)
              </span>
            </div>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Sloped</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* High Risk */}
            <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40">
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-md border flex items-center justify-center font-bold text-[10px] text-white shadow-xs shrink-0"
                  style={{ backgroundColor: RISK_COLORS.high.fill, borderColor: RISK_COLORS.high.stroke }}
                  aria-hidden="true"
                >
                  H
                </span>
                <span className="font-semibold text-rose-700 dark:text-rose-400">
                  High Risk [HIGH]
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-rose-900 dark:text-rose-200 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-900">
                {highPct}%
              </span>
            </div>

            {/* Moderate Risk */}
            <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40">
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-md border flex items-center justify-center font-bold text-[10px] text-white shadow-xs shrink-0"
                  style={{ backgroundColor: RISK_COLORS.moderate.fill, borderColor: RISK_COLORS.moderate.stroke }}
                  aria-hidden="true"
                >
                  M
                </span>
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  Moderate Risk [MOD]
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                {modPct}%
              </span>
            </div>

            {/* Low Risk */}
            <div className="flex items-center justify-between text-xs p-2 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-900/40">
              <div className="flex items-center gap-2">
                <span
                  className="w-5 h-5 rounded-md border flex items-center justify-center font-bold text-[10px] text-white shadow-xs shrink-0"
                  style={{ backgroundColor: RISK_COLORS.low.fill, borderColor: RISK_COLORS.low.stroke }}
                  aria-hidden="true"
                >
                  L
                </span>
                <span className="font-semibold text-sky-700 dark:text-sky-400">
                  Low Risk [LOW]
                </span>
              </div>
              <span className="font-mono text-xs font-bold text-sky-900 dark:text-sky-200 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-900">
                {lowPct}%
              </span>
            </div>
          </div>

          {/* Progress bar visualizer */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span>Grid Area Coverage</span>
              <span className="font-mono font-semibold">Total: 100%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800 shadow-inner">
              <div style={{ width: `${highPct}%`, backgroundColor: RISK_COLORS.high.fill }} title={`High: ${highPct}%`} />
              <div style={{ width: `${modPct}%`, backgroundColor: RISK_COLORS.moderate.fill }} title={`Moderate: ${modPct}%`} />
              <div style={{ width: `${lowPct}%`, backgroundColor: RISK_COLORS.low.fill }} title={`Low: ${lowPct}%`} />
            </div>
          </div>
        </div>
      )}

      {/* Expandable Evidence Semantics Drawer */}
      <details className="group pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
        <summary className="flex items-center justify-between font-bold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer select-none py-1">
          <span>NEXSTORM Evidence Semantics</span>
          <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 group-open:hidden">+ Expand</span>
          <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 hidden group-open:inline">− Collapse</span>
        </summary>
        <ul className="mt-2 space-y-1.5 pl-1 list-none text-slate-600 dark:text-slate-400">
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Susceptibility (s):</strong> Static terrain runoff accumulation potential [0, 1] based on DEM slope and WorldCover imperviousness.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Rainfall-Triggered Risk:</strong> Continuous matrix output of $s$ + precipitation accumulation ($RTI$). Not measured flood depth.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Building Exposure:</strong> Spatial overlap of footprints with macro-catchments. Does NOT model plinth elevation, basement presence, or structural damage.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Road Corridors & Routing:</strong> Topological network risk with underpass recognition. Assumes uncalibrated 30 km/h baseline without live traffic.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Community Reports:</strong> Citizen submissions. Corroborated reports indicate multiple citizen reports; verified records require authorized moderation.
          </li>
          <li>
            <strong className="text-slate-800 dark:text-slate-200">Unknown State:</strong> Missing, stale, or unmatched evidence is explicitly flagged as unknown, never assumed safe.
          </li>
        </ul>
      </details>
    </div>
  )
}
