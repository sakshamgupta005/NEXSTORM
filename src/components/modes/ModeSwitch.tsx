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
      className="flex flex-wrap items-center gap-2 p-1.5 rounded-xl bg-slate-100 border border-slate-200 shadow-inner"
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
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700/20'
                : 'bg-transparent text-slate-700 hover:text-slate-900 hover:bg-white/80'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
            <span className="tracking-tight">{m.label}</span>
            {isActive ? (
              <Badge className="ml-1 text-[10px] font-bold px-1.5 py-0.5 bg-white/20 text-white border-white/30 uppercase tracking-wider">
                Active
              </Badge>
            ) : m.badge ? (
              <span className="text-[10px] text-slate-500 font-mono font-medium bg-slate-200/80 px-1.5 py-0.5 rounded">
                {m.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
