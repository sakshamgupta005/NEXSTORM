import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Radio, History, PlayCircle } from 'lucide-react'

export function ModeSwitch() {
  return (
    <div
      data-testid="mode-switch"
      className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60"
    >
      {/* Active Mode: Scenario */}
      <button
        type="button"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/60 dark:border-slate-700/60"
      >
        <PlayCircle className="w-3.5 h-3.5" />
        <span>Scenario Simulation</span>
        <Badge className="ml-1 text-[9px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
          Active
        </Badge>
      </button>

      {/* Disabled Mode: Live */}
      <div className="relative group">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed hover:bg-transparent"
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Live Forecast</span>
          <span className="text-[10px] text-slate-400">P2</span>
        </button>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:block z-50 whitespace-nowrap bg-slate-900 text-white text-[11px] rounded-md px-2.5 py-1 shadow-lg pointer-events-none">
          Live meteorological telemetry is coming in later stages.
        </div>
      </div>

      {/* Disabled Mode: Replay */}
      <div className="relative group">
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed hover:bg-transparent"
        >
          <History className="w-3.5 h-3.5" />
          <span>Historical Replay</span>
          <span className="text-[10px] text-slate-400">P3</span>
        </button>
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:block z-50 whitespace-nowrap bg-slate-900 text-white text-[11px] rounded-md px-2.5 py-1 shadow-lg pointer-events-none">
          Historical extreme rainfall replay is coming in later stages.
        </div>
      </div>
    </div>
  )
}
