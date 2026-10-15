import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CloudRain, Sliders, Zap, Shield, Flame } from 'lucide-react'

export interface ScenarioParams {
  peakMm1h: number
  durationH: number
  antecedentMm72h: number
}

interface ScenarioPanelProps {
  params: ScenarioParams
  onChange: (params: ScenarioParams) => void
  isLoading?: boolean
}

export function ScenarioPanel({ params, onChange, isLoading = false }: ScenarioPanelProps) {
  const presets = [
    {
      name: 'Moderate Day',
      icon: CloudRain,
      params: { peakMm1h: 25, durationH: 6, antecedentMm72h: 10 },
      description: '25mm peak over 6h, low saturation',
    },
    {
      name: 'Heavy 70mm-type',
      icon: Shield,
      params: { peakMm1h: 45, durationH: 4, antecedentMm72h: 35 },
      description: 'Severe monsoon downpour, moderate antecedent',
    },
    {
      name: 'Extreme Short Burst',
      icon: Flame,
      params: { peakMm1h: 85, durationH: 2, antecedentMm72h: 50 },
      description: '85mm/hr cloudburst-type event in 2h',
    },
  ]

  const handleSliderChange = (key: keyof ScenarioParams, value: number) => {
    onChange({
      ...params,
      [key]: value,
    })
  }

  return (
    <div className="neuro-card p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Sliders className="w-4 h-4 text-blue-600" />
          <span>Rainfall Scenario Controls</span>
        </div>
        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
          Deterministic Hyetograph
        </span>
      </div>

      <div className="space-y-4">
        {/* Presets */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2.5">
            <Zap className="w-3.5 h-3.5 text-amber-500" />
            <span>Quick Storm Presets</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {presets.map((preset) => {
              const Icon = preset.icon
              const isActive =
                params.peakMm1h === preset.params.peakMm1h &&
                params.durationH === preset.params.durationH &&
                params.antecedentMm72h === preset.params.antecedentMm72h

              return (
                <button
                  key={preset.name}
                  type="button"
                  disabled={isLoading}
                  onClick={() => onChange(preset.params)}
                  className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-50/90 border-blue-600 text-blue-900 shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:bg-slate-50 text-slate-800 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-slate-100">
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{preset.name}</span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-blue-700 dark:text-blue-400 mt-1">
                    {preset.params.peakMm1h} mm/h &bull; {preset.params.durationH}h
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                    {preset.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-3.5 pt-1">
          {/* Peak Rainfall */}
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="peak-rainfall-slider" className="font-bold text-slate-700 dark:text-slate-300">
                Peak 1-Hour Rainfall (P1h)
              </label>
              <span className="font-mono font-bold text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded">
                {params.peakMm1h} mm/h
              </span>
            </div>
            <input
              id="peak-rainfall-slider"
              type="range"
              min="0"
              max="120"
              step="1"
              value={params.peakMm1h}
              disabled={isLoading}
              onChange={(e) => handleSliderChange('peakMm1h', Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              aria-valuemin={0}
              aria-valuemax={120}
              aria-valuenow={params.peakMm1h}
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0 mm (Dry)</span>
              <span>50 mm (Heavy)</span>
              <span>120 mm (Extreme)</span>
            </div>
          </div>

          {/* Duration */}
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="duration-slider" className="font-bold text-slate-700 dark:text-slate-300">
                Storm Event Duration
              </label>
              <span className="font-mono font-bold text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-0.5 rounded">
                {params.durationH} {params.durationH === 1 ? 'hour' : 'hours'}
              </span>
            </div>
            <input
              id="duration-slider"
              type="range"
              min="1"
              max="24"
              step="1"
              value={params.durationH}
              disabled={isLoading}
              onChange={(e) => handleSliderChange('durationH', Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              aria-valuemin={1}
              aria-valuemax={24}
              aria-valuenow={params.durationH}
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>1h (Flash)</span>
              <span>12h (Extended)</span>
              <span>24h (All-day)</span>
            </div>
          </div>

          {/* Antecedent 72h Rainfall */}
          <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label htmlFor="antecedent-slider" className="font-bold text-slate-700 dark:text-slate-300">
                Antecedent Soil Saturation (72h Rain)
              </label>
              <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                {params.antecedentMm72h} mm
              </span>
            </div>
            <input
              id="antecedent-slider"
              type="range"
              min="0"
              max="300"
              step="5"
              value={params.antecedentMm72h}
              disabled={isLoading}
              onChange={(e) => handleSliderChange('antecedentMm72h', Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              aria-valuemin={0}
              aria-valuemax={300}
              aria-valuenow={params.antecedentMm72h}
            />
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>0 mm (Dry soil)</span>
              <span>100 mm (Moist)</span>
              <span>300 mm (Saturated)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
