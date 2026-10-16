'use client'

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfidenceBadge } from '@/components/risk/ConfidenceBadge'
import { ProvenanceBadge } from '@/components/risk/ProvenanceBadge'
import type { Confidence, Provenance, RiskClass } from '@/lib/risk/types'
import { CloudRain, AlertTriangle, ShieldCheck, Grid, Zap } from 'lucide-react'
import { RISK_COLORS } from '@/components/map/Legend'

interface RiskSummaryCardsProps {
  totalCells: number
  classDistribution?: Record<RiskClass, number>
  classShare?: Record<RiskClass, number>
  rainfallSummary?: {
    max1h: number
    max24h: number
    maxRti: number
  }
  rtiBand?: string
  confidence?: Confidence
  memberCount?: number
  provenance?: Provenance[]
  mode?: string
}

export function RiskSummaryCards({
  totalCells,
  classDistribution,
  classShare,
  rainfallSummary,
  rtiBand = 'normal',
  confidence = 'unavailable',
  memberCount = 1,
  provenance = [],
  mode = 'scenario',
}: RiskSummaryCardsProps) {
  // Normalizes whether counts are passed as absolute integers or normalized fractions (<= 1.0)
  const resolveCount = (val: number, total: number) =>
    val <= 1 && total > 1 ? Math.round(val * total) : Math.round(val)

  const highCount = resolveCount(classDistribution?.high ?? 0, totalCells)
  const modCount = resolveCount(classDistribution?.moderate ?? 0, totalCells)
  const lowCount = resolveCount(classDistribution?.low ?? 0, totalCells)

  const highPct = Math.round((classShare?.high ?? 0) * 100)
  const modPct = Math.round((classShare?.moderate ?? 0) * 100)
  const lowPct = Math.round((classShare?.low ?? 0) * 100)

  return (
    <div className="space-y-7">
      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
        {/* Card 1: Evaluated Grid & High Risk */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-6 sm:p-7 space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">High Risk Cells</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
              {highCount}
            </span>
            <span className="text-xs text-slate-500 font-semibold">({highPct}%)</span>
          </div>
          <div className="text-xs text-slate-500 leading-relaxed">
            Out of {totalCells.toLocaleString()} evaluated cells
          </div>
        </div>

        {/* Card 2: Peak Rainfall */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-6 sm:p-7 space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Rainfall Peak</span>
            <CloudRain className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
              {rainfallSummary?.max1h ?? 0}
            </span>
            <span className="text-xs text-slate-500 font-semibold">mm/h</span>
          </div>
          <div className="text-xs text-slate-500 leading-relaxed">
            24h Total: <span className="font-mono font-semibold">{rainfallSummary?.max24h ?? 0} mm</span>
          </div>
        </div>

        {/* Card 3: Peak RTI & Band */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-6 sm:p-7 space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Peak RTI</span>
            <Zap className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 font-mono">
              {rainfallSummary?.maxRti ?? 0}
            </span>
            <Badge
              variant={
                rtiBand === 'extreme' || rtiBand === 'severe'
                  ? 'danger'
                  : rtiBand === 'elevated'
                  ? 'warning'
                  : 'outline'
              }
              className="text-[10px] uppercase px-2 py-0.5"
            >
              {rtiBand}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 leading-relaxed">
            Provisional threshold basis
          </div>
        </div>

        {/* Card 4: Confidence Status */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs p-6 sm:p-7 space-y-3">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Forecast Confidence</span>
            <ShieldCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="pt-0.5">
            <ConfidenceBadge confidence={confidence} memberCount={memberCount} />
          </div>
          <div className="text-xs text-slate-500 leading-relaxed">
            {mode === 'replay'
              ? 'Historical deterministic reanalysis'
              : mode === 'scenario'
              ? 'Simulated hyetograph stress-test'
              : 'Ensemble agreement spread'}
          </div>
        </div>
      </div>

      {/* Class Distribution Breakdown Bar */}
      <div className="p-6 sm:p-7 rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs text-xs space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800">
          <span className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-slate-400" />
            <span>Risk Class Breakdown (Current Scrubber Hour)</span>
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {totalCells.toLocaleString()} Cells Mapped
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS.high.fill }} />
              High
            </span>
            <span className="font-mono font-bold text-rose-800 dark:text-rose-200 text-xs sm:text-sm">
              {highCount} ({highPct}%)
            </span>
          </div>

          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS.moderate.fill }} />
              Moderate
            </span>
            <span className="font-mono font-bold text-amber-800 dark:text-amber-200 text-xs sm:text-sm">
              {modCount} ({modPct}%)
            </span>
          </div>

          <div className="p-4 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-900/40 flex items-center justify-between">
            <span className="text-xs font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS.low.fill }} />
              Low
            </span>
            <span className="font-mono font-bold text-sky-800 dark:text-sky-200 text-xs sm:text-sm">
              {lowCount} ({lowPct}%)
            </span>
          </div>
        </div>
      </div>

      {/* Provenance Badge Panel */}
      {provenance.length > 0 && (
        <ProvenanceBadge provenance={provenance} />
      )}
    </div>
  )
}
