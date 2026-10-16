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
    <div className="space-y-6">
      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
        {/* Card 1: Evaluated Grid & High Risk */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 sm:p-6 space-y-2.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">High Risk Cells</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 font-mono">
              {highCount}
            </span>
            <span className="text-xs text-slate-600 font-bold">({highPct}%)</span>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            Out of {totalCells.toLocaleString()} evaluated cells
          </div>
        </div>

        {/* Card 2: Peak Rainfall */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 sm:p-6 space-y-2.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">Rainfall Peak</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
              <CloudRain className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-blue-700 font-mono">
              {rainfallSummary?.max1h ?? 0}
            </span>
            <span className="text-xs text-slate-600 font-semibold font-mono">mm/h</span>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            24h Total: <span className="font-mono font-bold text-slate-800">{rainfallSummary?.max24h ?? 0} mm</span>
          </div>
        </div>

        {/* Card 3: Peak RTI & Band */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 sm:p-6 space-y-2.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">Peak RTI</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
              <Zap className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
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
              className="text-[10px] font-bold uppercase px-2 py-0.5"
            >
              {rtiBand}
            </Badge>
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            Provisional calibrated threshold basis
          </div>
        </div>

        {/* Card 4: Confidence Status */}
        <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-5 sm:p-6 space-y-2.5">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase tracking-wider">Forecast Confidence</span>
            <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-slate-600" />
            </div>
          </div>
          <div className="pt-0.5">
            <ConfidenceBadge confidence={confidence} memberCount={memberCount} />
          </div>
          <div className="text-xs text-slate-600 leading-relaxed">
            {mode === 'replay'
              ? 'Historical deterministic reanalysis'
              : mode === 'scenario'
              ? 'Simulated hyetograph stress-test'
              : 'Ensemble agreement spread'}
          </div>
        </div>
      </div>

      {/* Class Distribution Breakdown Bar */}
      <div className="p-5 sm:p-6 rounded-2xl border border-slate-200/90 bg-white shadow-xs text-xs space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-slate-800 pb-2 border-b border-slate-100">
          <span className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-slate-500" />
            <span>Risk Class Breakdown (Current Scrubber Hour)</span>
          </span>
          <span className="text-xs text-slate-600 font-mono font-medium">
            {totalCells.toLocaleString()} Cells Mapped
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 flex items-center justify-between">
            <span className="text-xs font-bold text-rose-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS.high.fill }} />
              High
            </span>
            <span className="font-mono font-bold text-rose-900 text-xs sm:text-sm">
              {highCount} ({highPct}%)
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 flex items-center justify-between">
            <span className="text-xs font-bold text-amber-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS.moderate.fill }} />
              Moderate
            </span>
            <span className="font-mono font-bold text-amber-900 text-xs sm:text-sm">
              {modCount} ({modPct}%)
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: RISK_COLORS.low.fill }} />
              Low
            </span>
            <span className="font-mono font-bold text-emerald-900 text-xs sm:text-sm">
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
