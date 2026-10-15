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
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-3.5 shadow-md space-y-3"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          {activeLayer === 'susceptibility'
            ? 'Topographic Susceptibility Scale (s)'
            : 'Waterlogging Risk Classification'}
        </h4>
        <span className="text-[10px] text-slate-400 font-mono">
          {activeLayer === 'susceptibility' ? 'Static Terrain [0, 1]' : 'Sequential Scale'}
        </span>
      </div>

      {activeLayer === 'susceptibility' ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded border flex items-center justify-center font-bold text-[9px] text-white"
                style={{ backgroundColor: RISK_COLORS.high.fill, borderColor: RISK_COLORS.high.stroke }}
                aria-hidden="true"
              >
                H
              </span>
              <span className="font-semibold text-rose-700 dark:text-rose-400">
                High Susceptibility (s &gt; 0.66)
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Depression / Flat</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded border flex items-center justify-center font-bold text-[9px] text-white"
                style={{ backgroundColor: RISK_COLORS.moderate.fill, borderColor: RISK_COLORS.moderate.stroke }}
                aria-hidden="true"
              >
                M
              </span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                Moderate Susceptibility (0.33–0.66)
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Intermediate</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded border flex items-center justify-center font-bold text-[9px] text-white"
                style={{ backgroundColor: RISK_COLORS.low.fill, borderColor: RISK_COLORS.low.stroke }}
                aria-hidden="true"
              >
                L
              </span>
              <span className="font-semibold text-sky-700 dark:text-sky-400">
                Low Susceptibility (s &lt; 0.33)
              </span>
            </div>
            <span className="text-[11px] text-slate-500">Elevated / Sloped</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* High Risk */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded border flex items-center justify-center font-bold text-[9px] text-white"
                style={{ backgroundColor: RISK_COLORS.high.fill, borderColor: RISK_COLORS.high.stroke }}
                aria-hidden="true"
              >
                H
              </span>
              <span className="font-semibold text-rose-700 dark:text-rose-400">
                High Risk [HIGH]
              </span>
            </div>
            <span className="font-mono text-xs font-semibold">{highPct}%</span>
          </div>

          {/* Moderate Risk */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded border flex items-center justify-center font-bold text-[9px] text-white"
                style={{ backgroundColor: RISK_COLORS.moderate.fill, borderColor: RISK_COLORS.moderate.stroke }}
                aria-hidden="true"
              >
                M
              </span>
              <span className="font-semibold text-amber-700 dark:text-amber-400">
                Moderate Risk [MOD]
              </span>
            </div>
            <span className="font-mono text-xs font-semibold">{modPct}%</span>
          </div>

          {/* Low Risk */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded border flex items-center justify-center font-bold text-[9px] text-white"
                style={{ backgroundColor: RISK_COLORS.low.fill, borderColor: RISK_COLORS.low.stroke }}
                aria-hidden="true"
              >
                L
              </span>
              <span className="font-semibold text-sky-700 dark:text-sky-400">
                Low Risk [LOW]
              </span>
            </div>
            <span className="font-mono text-xs font-semibold">{lowPct}%</span>
          </div>

          {/* Progress bar visualizer */}
          <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
            <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              <span>Grid Area Coverage</span>
              <span>Total: 100%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
              <div style={{ width: `${highPct}%`, backgroundColor: RISK_COLORS.high.fill }} title={`High: ${highPct}%`} />
              <div style={{ width: `${modPct}%`, backgroundColor: RISK_COLORS.moderate.fill }} title={`Moderate: ${modPct}%`} />
              <div style={{ width: `${lowPct}%`, backgroundColor: RISK_COLORS.low.fill }} title={`Low: ${lowPct}%`} />
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-slate-400 leading-tight">
        *Risk classes represent relative modelled risk, not measured flood depth or elevation in cm. Combining static susceptibility (s) with event Rainfall Threshold Index (RTI).
      </p>
    </div>
  )
}
