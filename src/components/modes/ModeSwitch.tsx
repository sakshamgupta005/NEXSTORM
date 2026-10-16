'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { Radio, History, PlayCircle } from 'lucide-react'

export type ConsoleMode = 'live' | 'replay' | 'scenario'

interface ModeSwitchProps {
  mode?: ConsoleMode
  onChange?: (mode: ConsoleMode) => void
  disabled?: boolean
}

export function ModeSwitch({
  mode = 'scenario',
  onChange,
  disabled = false,
}: ModeSwitchProps) {
  const modes: Array<{
    id: ConsoleMode
    label: string
    icon: React.ComponentType<{ className?: string }>
    badge?: string
    description: string
  }> = [
    {
      id: 'scenario',
      label: 'Scenario Simulation',
      icon: PlayCircle,
      description: 'Hypothetical stress-test with configurable peak rainfall & duration',
    },
    {
      id: 'live',
      label: 'Live Forecast',
      icon: Radio,
      badge: 'ECMWF/GFS',
      description: 'Operational 48h ensemble rainfall telemetry from Open-Meteo',
    },
    {
      id: 'replay',
      label: 'Historical Replay',
      icon: History,
      badge: 'ERA5',
      description: 'Archived September 2025 extreme monsoon rainfall event',
    },
  ]

  return (
    <div
      data-testid="mode-switch"
      role="radiogroup"
      aria-label="Operational Mode Selection"
      className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 shadow-inner"
    >
      {modes.map((m) => {
        const Icon = m.icon
        const isActive = mode === m.id

        return (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange?.(m.id)}
            title={m.description}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              isActive
                ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer active:scale-98'}`}
          >
            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
            <span>{m.label}</span>
            {isActive ? (
              <Badge className="ml-1 text-[9px] px-1.5 py-0 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Active
              </Badge>
            ) : m.badge ? (
              <span className="text-[10px] text-slate-400 font-mono font-normal">
                {m.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
