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
      className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-100/90 border border-slate-200/80 shadow-2xs"
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
            className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
              isActive
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
            <span className="tracking-tight whitespace-nowrap">{m.label}</span>
            {isActive ? (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
            ) : m.badge ? (
              <span className="text-[10px] text-slate-500 font-mono font-medium bg-slate-200/70 px-1.5 py-0.2 rounded">
                {m.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
