'use client'

import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { TimelineHour, RtiBand } from '@/lib/risk/types'
import { Clock, ChevronLeft, ChevronRight, Activity, AlertTriangle } from 'lucide-react'

interface RainfallTimelineProps {
  timeline: TimelineHour[]
  rainfallValues?: number[]
  selectedHourIndex: number
  onSelectHour: (hourIndex: number) => void
  isLoading?: boolean
  beyondCalibration?: boolean
  beyondCalibrationReason?: string
}

const BAND_BADGES: Record<
  RtiBand,
  { label: string; className: string }
> = {
  none: {
    label: 'NONE',
    className: 'text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700',
  },
  elevated: {
    label: 'ELEVATED',
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30',
  },
  severe: {
    label: 'SEVERE',
    className: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
  },
  extreme: {
    label: 'EXTREME',
    className: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  },
}

export function RainfallTimeline({
  timeline,
  rainfallValues = [],
  selectedHourIndex,
  onSelectHour,
  isLoading = false,
  beyondCalibration = false,
  beyondCalibrationReason,
}: RainfallTimelineProps) {
  if (!timeline || timeline.length === 0) {
    return (
      <Card className="border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80">
        <CardContent className="py-6 text-center text-xs text-slate-500">
          No rainfall timeline series available.
        </CardContent>
      </Card>
    )
  }

  const safeHourIndex = Math.max(0, Math.min(selectedHourIndex, timeline.length - 1))
  const currentHour = timeline[safeHourIndex] || timeline[0]
  const currentBand = currentHour?.band || 'none'
  const bandBadge = BAND_BADGES[currentBand] || BAND_BADGES.none
  const currentRainfall = rainfallValues[safeHourIndex] ?? 0

  const formatTimestamp = (ts?: string) => {
    if (!ts) return `+${safeHourIndex}h`
    if (ts.startsWith('+')) return ts
    try {
      const d = new Date(ts)
      if (isNaN(d.getTime())) return ts
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ts
    }
  }

  return (
    <Card className="neuro-card">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Rainfall Horizon &amp; Risk Scrubber</span>
            </CardTitle>
            <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {timeline.length} Hours Evaluated
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">Selected Hour:</span>
            <Badge className={`font-mono text-[10px] font-bold ${bandBadge.className}`}>
              t={safeHourIndex} ({bandBadge.label})
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Beyond Calibration Warning Banner */}
        {beyondCalibration && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2 leading-relaxed"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <strong>Beyond Scientific Calibration:</strong>{' '}
              {beyondCalibrationReason ||
                'Maximum RTI exceeds 1.5x extreme threshold. Numerical outputs outside validated calibration range are exploratory.'}
            </div>
          </div>
        )}

        {/* Selected Hour Telemetry Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
            <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Hourly Rain</span>
            <span className="font-mono font-extrabold text-base text-blue-600 dark:text-blue-400">
              {currentRainfall.toFixed(1)} mm
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
            <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Median RTI</span>
            <span className="font-mono font-extrabold text-base text-purple-600 dark:text-purple-400">
              {currentHour.rtiP50.toFixed(3)}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
            <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">RTI Band</span>
            <span className={`font-mono font-extrabold text-xs uppercase ${bandBadge.className}`}>
              {currentBand}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 shadow-xs">
            <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Timestamp</span>
            <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200 truncate block">
              {formatTimestamp(currentHour.timestamp)}
            </span>
          </div>
        </div>

        {/* Scrubber Controls */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1 font-medium">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              <span>Timeline Scrubber (Drag or Step)</span>
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={safeHourIndex <= 0 || isLoading}
                onClick={() => onSelectHour(safeHourIndex - 1)}
                title="Previous Hour"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={safeHourIndex >= timeline.length - 1 || isLoading}
                onClick={() => onSelectHour(safeHourIndex + 1)}
                title="Next Hour"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <input
            type="range"
            min={0}
            max={timeline.length - 1}
            step={1}
            value={safeHourIndex}
            disabled={isLoading}
            onChange={(e) => onSelectHour(parseInt(e.target.value, 10))}
            className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            aria-label="Timeline Hour Scrubber"
          />

          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>t=0 ({formatTimestamp(timeline[0]?.timestamp)})</span>
            <span>t={Math.floor(timeline.length / 2)}</span>
            <span>t={timeline.length - 1} ({formatTimestamp(timeline[timeline.length - 1]?.timestamp)})</span>
          </div>
        </div>

        {/* Hourly Precipitation Sparkline Visualizer */}
        {rainfallValues.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
              <span>Precipitation Hyetograph (mm/h)</span>
              <span className="text-slate-400 font-medium">Click bar to jump to hour</span>
            </div>

            <div className="flex items-end gap-0.5 h-16 w-full pt-2 px-1 bg-slate-50/50 dark:bg-slate-850/50 rounded-xl border border-slate-200/40 dark:border-slate-800/40">
              {timeline.slice(0, 48).map((hour, idx) => {
                const val = rainfallValues[idx] ?? 0
                const maxP = Math.max(...rainfallValues.slice(0, 48), 1)
                const heightPct = Math.max(Math.round((val / maxP) * 100), 6)
                const isSelected = idx === safeHourIndex
                const isExtreme = hour.band === 'extreme' || hour.band === 'severe'
                const isElevated = hour.band === 'elevated'

                let barColor = 'bg-blue-400/70 hover:bg-blue-500'
                if (isExtreme) barColor = 'bg-rose-500 hover:bg-rose-600'
                else if (isElevated) barColor = 'bg-amber-500 hover:bg-amber-600'

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectHour(idx)}
                    className={`flex-1 rounded-t-sm transition-all ${barColor} ${
                      isSelected ? 'ring-2 ring-blue-600 ring-offset-1 z-10 opacity-100 scale-y-105' : 'opacity-70'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    title={`Hour ${idx} (${formatTimestamp(hour.timestamp)}): ${val.toFixed(1)} mm, RTI: ${hour.rtiP50.toFixed(2)}`}
                  />
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
