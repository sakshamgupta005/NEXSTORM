'use client'

import React, { useState } from 'react'
import { Activity, ShieldCheck, Zap, Radio, Compass, RefreshCw } from 'lucide-react'

interface Hotspot {
  id: string
  name: string
  x: number // percentage
  y: number // percentage
  depth: string
  status: 'low' | 'moderate' | 'severe'
  elevation: string
}

const HOTSPOTS: Hotspot[] = [
  { id: '1', name: 'Hall Gate Sump', x: 42, y: 38, depth: '32 cm', status: 'severe', elevation: '218m' },
  { id: '2', name: 'Mall Road Depression', x: 62, y: 48, depth: '26 cm', status: 'moderate', elevation: '221m' },
  { id: '3', name: 'Batala Road Underpass', x: 68, y: 28, depth: '44 cm', status: 'severe', elevation: '217m' },
  { id: '4', name: 'Golden Temple Corridor', x: 48, y: 64, depth: '8 cm', status: 'low', elevation: '226m' },
  { id: '5', name: 'Majitha Chokepoint', x: 30, y: 55, depth: '18 cm', status: 'moderate', elevation: '223m' },
]

export function HeroRadarConsole() {
  const [activeHotspot, setActiveHotspot] = useState<Hotspot>(HOTSPOTS[0])
  const [isCloudburstMode, setIsCloudburstMode] = useState<boolean>(true)
  const [pulseCount, setPulseCount] = useState<number>(0)

  const toggleSimulation = () => {
    setIsCloudburstMode(!isCloudburstMode)
    setPulseCount((c) => c + 1)
  }

  return (
    <div 
      className="w-full rounded-3xl bg-white border border-slate-200/90 shadow-[0_12px_40px_-10px_rgba(15,23,42,0.08)] p-6 relative overflow-hidden transition-all duration-300"
      style={{
        boxShadow: '0 20px 48px -12px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.03)'
      }}
    >
      {/* Top Cockpit Header */}
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-extrabold text-slate-900 tracking-tight font-display">
                250M RADAR MESH
              </span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-100">
                LIVE
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-600 block">
              AMRITSAR &bull; 31.6340&deg; N, 74.8723&deg; E
            </span>
          </div>
        </div>

        {/* Simulation Mode Toggle Button */}
        <button
          type="button"
          onClick={toggleSimulation}
          className={`px-3 py-1.5 rounded-full text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
            isCloudburstMode
              ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-xs'
              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
          title="Toggle storm simulation intensity"
        >
          <Zap className={`w-3 h-3 ${isCloudburstMode ? 'text-rose-600 fill-current' : 'text-slate-400'}`} />
          <span>{isCloudburstMode ? 'CLOUDBURST: 80mm/h' : 'BASELINE FLOW'}</span>
        </button>
      </div>

      {/* Centerpiece: Interactive Circular Radar Scope */}
      <div className="relative w-full aspect-[4/3] rounded-2xl bg-[#090e17] overflow-hidden flex items-center justify-center border border-slate-900">
        {/* Subtle coordinate grid lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="radarGrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#38bdf8" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#radarGrid)" />
        </svg>

        {/* Concentric distance rings */}
        <div className="absolute w-[80%] aspect-square rounded-full border border-sky-500/20 pointer-events-none" />
        <div className="absolute w-[56%] aspect-square rounded-full border border-sky-500/25 pointer-events-none" />
        <div className="absolute w-[32%] aspect-square rounded-full border border-sky-500/30 pointer-events-none" />
        <div className="absolute w-1.5 h-1.5 rounded-full bg-sky-400 pointer-events-none" />

        {/* Axis Crosshairs */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-sky-500/20 pointer-events-none" />
        <div className="absolute inset-y-0 left-1/2 w-px bg-sky-500/20 pointer-events-none" />

        {/* 360-Degree Continuous Radar Sweep Beam */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'conic-gradient(from 0deg at 50% 50%, rgba(56, 189, 248, 0.28) 0deg, rgba(56, 189, 248, 0.08) 35deg, transparent 60deg)',
            animation: 'radarSweep 4s linear infinite',
            transformOrigin: 'center center'
          }}
        />

        {/* Interactive Hotspot Nodes across the Grid */}
        {HOTSPOTS.map((spot) => {
          const isSelected = activeHotspot.id === spot.id
          let dotColor = 'bg-emerald-400'
          let ringColor = 'border-emerald-400'
          if (spot.status === 'moderate') {
            dotColor = 'bg-amber-400'
            ringColor = 'border-amber-400'
          } else if (spot.status === 'severe') {
            dotColor = 'bg-rose-500'
            ringColor = 'border-rose-500'
          }

          return (
            <button
              key={spot.id}
              type="button"
              onClick={() => setActiveHotspot(spot)}
              className="absolute group -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 focus:outline-hidden"
              style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
              title={`${spot.name} - ${spot.depth}`}
            >
              {/* Pulsing ring around node */}
              <span className={`absolute -inset-2 rounded-full border ${ringColor} opacity-75 ${isSelected ? 'animate-ping' : 'opacity-30'}`} />
              <div 
                className={`w-3.5 h-3.5 rounded-full ${dotColor} border-2 border-slate-900 shadow-[0_0_12px_currentColor] transition-transform ${
                  isSelected ? 'scale-125' : 'group-hover:scale-125'
                }`}
              />
            </button>
          )
        })}

        {/* Live HUD Floating Tag on Top Left of Scope */}
        <div className="absolute top-3 left-3 pointer-events-none z-10 flex flex-col gap-0.5">
          <span className="text-[9px] font-mono font-bold tracking-widest text-sky-400">
            DOPPLER SWEEP: 250M RESOLUTION
          </span>
          <span className="text-[10px] font-mono text-slate-300">
            RADAR CYCLE: 15s &bull; SOLVER: CONVERGED
          </span>
        </div>

        {/* Range Labels on Right */}
        <div className="absolute bottom-3 right-3 pointer-events-none z-10 text-[9px] font-mono text-slate-400">
          MAX RADIUS: 5.0 KM
        </div>
      </div>

      {/* Selected Hotspot Intelligence Readout Card */}
      <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center text-slate-800 shrink-0 shadow-xs">
            <Compass className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold text-slate-900">
                {activeHotspot.name}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-mono font-bold uppercase ${
                activeHotspot.status === 'severe'
                  ? 'bg-rose-100 text-rose-800'
                  : activeHotspot.status === 'moderate'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}>
                {activeHotspot.status}
              </span>
            </div>
            <span className="text-[11px] text-slate-600 font-mono">
              Elevation: {activeHotspot.elevation} &bull; Topographic Basin Sink
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] font-mono text-slate-600 uppercase font-semibold block">
            Modeled Depth
          </span>
          <span className="text-base font-extrabold text-slate-900 font-mono">
            {isCloudburstMode ? activeHotspot.depth : '0.0 cm'}
          </span>
        </div>
      </div>

      {/* 3 Real-time Micro Telemetry Indicators */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 text-center">
        <div className="p-2 rounded-xl bg-slate-50/70">
          <span className="text-[9.5px] font-mono text-slate-600 uppercase block font-semibold">
            Runoff Flux
          </span>
          <span className="text-xs font-bold text-slate-900 font-mono">
            {isCloudburstMode ? '14.8 m³/s' : '0.4 m³/s'}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-slate-50/70">
          <span className="text-[9.5px] font-mono text-slate-600 uppercase block font-semibold">
            A* Latency
          </span>
          <span className="text-xs font-bold text-emerald-600 font-mono">
            1.8 ms
          </span>
        </div>
        <div className="p-2 rounded-xl bg-slate-50/70">
          <span className="text-[9.5px] font-mono text-slate-600 uppercase block font-semibold">
            Catchment Sinks
          </span>
          <span className="text-xs font-bold text-blue-600 font-mono">
            14 / 14 Active
          </span>
        </div>
      </div>
    </div>
  )
}
