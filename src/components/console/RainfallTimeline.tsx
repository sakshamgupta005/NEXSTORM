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
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-6 sm:p-7 space-y-6">
      <div className="pb-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800 block">
              Rainfall Horizon &amp; Risk Scrubber
            </span>
            <span className="text-[11px] text-slate-500">
              Interactive temporal step through simulated or observed storm timeline
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Selected Hour:</span>
          <Badge className={`font-mono text-xs font-bold px-2.5 py-1 ${bandBadge.className}`}>
            t={safeHourIndex} ({bandBadge.label})
          </Badge>
        </div>
      </div>

      <div className="space-y-5">
        {/* Beyond Calibration Warning Banner */}
        {beyondCalibration && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed shadow-2xs"
          >
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-amber-950">Beyond Scientific Calibration:</strong>{' '}
              <span className="text-amber-800">
                {beyondCalibrationReason ||
                  'Maximum RTI exceeds 1.5x extreme threshold. Numerical outputs outside validated calibration range are exploratory.'}
              </span>
            </div>
          </div>
        )}

        {/* Selected Hour Telemetry Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Hourly Rain
            </span>
            <span className="font-mono font-extrabold text-lg text-blue-700">
              {currentRainfall.toFixed(1)} mm
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Median RTI
            </span>
            <span className="font-mono font-extrabold text-lg text-indigo-700">
              {currentHour.rtiP50.toFixed(3)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              RTI Band
            </span>
            <span className={`font-mono font-extrabold text-xs uppercase inline-block px-2 py-0.5 rounded-md ${bandBadge.className}`}>
              {currentBand}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 shadow-2xs">
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Timestamp
            </span>
            <span className="font-mono font-bold text-base text-slate-900 truncate block">
              {formatTimestamp(currentHour.timestamp)}
            </span>
          </div>
        </div>

        {/* Scrubber Controls */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between text-xs text-slate-700">
            <span className="flex items-center gap-1.5 font-bold">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span>Timeline Scrubber (Drag or Step)</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-100"
                disabled={safeHourIndex <= 0 || isLoading}
                onClick={() => onSelectHour(safeHourIndex - 1)}
                title="Previous Hour"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                <span>Prev</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs font-semibold border-slate-200 text-slate-700 hover:bg-slate-100"
                disabled={safeHourIndex >= timeline.length - 1 || isLoading}
                onClick={() => onSelectHour(safeHourIndex + 1)}
                title="Next Hour"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
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
            className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 my-1"
            aria-label="Timeline Hour Scrubber"
          />

          <div className="flex justify-between text-xs text-slate-600 font-mono font-medium">
            <span>t=0 ({formatTimestamp(timeline[0]?.timestamp)})</span>
            <span>t={Math.floor(timeline.length / 2)}</span>
            <span>t={timeline.length - 1} ({formatTimestamp(timeline[timeline.length - 1]?.timestamp)})</span>
          </div>
        </div>

        {/* Hourly Precipitation Sparkline Visualizer */}
        {rainfallValues.length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center justify-between">
              <span>Precipitation Hyetograph (mm/h)</span>
              <span className="text-slate-500 font-medium normal-case">Click bar to jump to hour</span>
            </div>

            <div className="flex items-end gap-1 h-20 w-full pt-2 px-2 bg-slate-50/80 rounded-xl border border-slate-200/80">
              {timeline.slice(0, 48).map((hour, idx) => {
                const val = rainfallValues[idx] ?? 0
                const maxP = Math.max(...rainfallValues.slice(0, 48), 1)
                const heightPct = Math.max(Math.round((val / maxP) * 100), 8)
                const isSelected = idx === safeHourIndex
                const isExtreme = hour.band === 'extreme' || hour.band === 'severe'
                const isElevated = hour.band === 'elevated'

                let barColor = 'bg-blue-400 hover:bg-blue-600'
                if (isExtreme) barColor = 'bg-rose-500 hover:bg-rose-600'
                else if (isElevated) barColor = 'bg-amber-400 hover:bg-amber-500'

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onSelectHour(idx)}
                    className={`flex-1 rounded-t-sm transition-all cursor-pointer ${barColor} ${
                      isSelected ? 'ring-2 ring-blue-600 ring-offset-2 z-10 opacity-100 scale-y-105' : 'opacity-85 hover:opacity-100'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    title={`Hour ${idx} (${formatTimestamp(hour.timestamp)}): ${val.toFixed(1)} mm, RTI: ${hour.rtiP50.toFixed(2)}`}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
