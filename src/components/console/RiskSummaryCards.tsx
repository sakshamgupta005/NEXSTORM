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
  const highCount = classDistribution?.high ?? 0
  const modCount = classDistribution?.moderate ?? 0
  const lowCount = classDistribution?.low ?? 0

  const highPct = Math.round((classShare?.high ?? 0) * 100)
  const modPct = Math.round((classShare?.moderate ?? 0) * 100)
  const lowPct = Math.round((classShare?.low ?? 0) * 100)

  return (
    <div className="space-y-4">
      {/* 4 Primary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Evaluated Grid & High Risk */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">High Risk Cells</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                {highCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">({highPct}%)</span>
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              Out of {totalCells.toLocaleString()} evaluated cells
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Peak Rainfall */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Rainfall Peak</span>
              <CloudRain className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400 font-mono">
                {rainfallSummary?.max1h ?? 0}
              </span>
              <span className="text-xs text-slate-500 font-medium">mm/h</span>
            </div>
            <div className="text-[10px] text-slate-400">
              24h Total: <span className="font-mono">{rainfallSummary?.max24h ?? 0} mm</span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Peak RTI & Band */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Peak RTI</span>
              <Zap className="w-3.5 h-3.5 text-purple-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
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
                className="text-[9px] uppercase px-1.5 py-0"
              >
                {rtiBand}
              </Badge>
            </div>
            <div className="text-[10px] text-slate-400">
              Provisional threshold basis
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Confidence Status */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs">
          <CardContent className="p-3.5 space-y-1">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Forecast Confidence</span>
              <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="pt-1">
              <ConfidenceBadge confidence={confidence} memberCount={memberCount} />
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {mode === 'replay'
                ? 'Historical deterministic reanalysis'
                : mode === 'scenario'
                ? 'Simulated hyetograph stress-test'
                : 'Ensemble agreement spread'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Class Distribution Breakdown Bar */}
      <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 text-xs space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <Grid className="w-3.5 h-3.5 text-slate-400" />
            <span>Risk Class Breakdown (Current Scrubber Hour)</span>
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            {totalCells.toLocaleString()} Cells Mapped
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-1.5 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-900/40 flex items-center justify-between">
            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLORS.high.fill }} />
              High
            </span>
            <span className="font-mono font-bold text-rose-800 dark:text-rose-200 text-xs">
              {highCount} ({highPct}%)
            </span>
          </div>

          <div className="p-1.5 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-900/40 flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLORS.moderate.fill }} />
              Moderate
            </span>
            <span className="font-mono font-bold text-amber-800 dark:text-amber-200 text-xs">
              {modCount} ({modPct}%)
            </span>
          </div>

          <div className="p-1.5 rounded bg-sky-50 dark:bg-sky-950/30 border border-sky-200/50 dark:border-sky-900/40 flex items-center justify-between">
            <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLORS.low.fill }} />
              Low
            </span>
            <span className="font-mono font-bold text-sky-800 dark:text-sky-200 text-xs">
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
