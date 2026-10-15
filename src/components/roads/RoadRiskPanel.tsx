'use client'

import React, { useState } from 'react'
import {
  Route,
  ShieldAlert,
  AlertTriangle,
  Info,
  Navigation,
  MapPin,
  Clock,
  ArrowRight,
  Compass,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CandidateRouteEvaluation, RoutingPlanResult } from '@/lib/roads/types'

interface RoadRiskPanelProps {
  cityId: string
  onSelectRoute?: (route: CandidateRouteEvaluation | null) => void
  activeRouteId?: string | null
}

interface Landmark {
  id: string
  name: string
  coords: [number, number] // [lng, lat]
}

const AMRITSAR_LANDMARKS: Landmark[] = [
  { id: 'golden-temple', name: 'Golden Temple (Harmandir Sahib)', coords: [74.8765, 31.62] },
  { id: 'railway-station', name: 'Amritsar Railway Station', coords: [74.8655, 31.634] },
  { id: 'gndu', name: 'Guru Nanak Dev University (GNDU)', coords: [74.825, 31.638] },
  { id: 'ssss-chowk', name: 'SSSS Chowk / Batala Road (Underpass)', coords: [74.898, 31.645] },
  { id: 'mall-road', name: 'Mall Road / Lawrence Road', coords: [74.881, 31.641] },
  { id: 'hall-gate', name: 'Hall Gate (Walled City Entrance)', coords: [74.875, 31.628] },
  { id: 'cantt', name: 'Amritsar Cantonment', coords: [74.838, 31.632] },
]

export function RoadRiskPanel({
  cityId,
  onSelectRoute,
  activeRouteId = null,
}: RoadRiskPanelProps) {
  const [originId, setOriginId] = useState<string>('mall-road')
  const [destId, setDestId] = useState<string>('ssss-chowk')
  const [isPlanning, setIsPlanning] = useState(false)
  const [planResult, setPlanResult] = useState<RoutingPlanResult | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(activeRouteId)

  const handlePlanRoutes = async () => {
    setIsPlanning(true)
    setPlanError(null)

    const origin = AMRITSAR_LANDMARKS.find((l) => l.id === originId)
    const destination = AMRITSAR_LANDMARKS.find((l) => l.id === destId)

    if (!origin || !destination) {
      setPlanError('Please select valid origin and destination locations.')
      setIsPlanning(false)
      return
    }

    if (origin.id === destination.id) {
      setPlanError('Origin and destination cannot be the same location.')
      setIsPlanning(false)
      return
    }

    try {
      const res = await fetch('/api/roads/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId,
          origin: origin.coords,
          destination: destination.coords,
          originName: origin.name,
          destinationName: destination.name,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to calculate flood-aware routes')
      }

      const data = await res.json()
      const result = data.data as RoutingPlanResult
      setPlanResult(result)

      // Automatically select the safest/recommended route on the map
      if (result.routes.length > 0) {
        const primary = result.routes[0]
        setSelectedRouteId(primary.routeId)
        onSelectRoute?.(primary)
      }
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Unknown routing error')
      setPlanResult(null)
    } finally {
      setIsPlanning(false)
    }
  }

  const handleSelectCandidate = (route: CandidateRouteEvaluation) => {
    setSelectedRouteId(route.routeId)
    onSelectRoute?.(route)
  }

  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xs space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Origin-to-Destination Flood Router</span>
              <Badge variant="outline" className="text-[10px] font-mono border-orange-500/40 text-orange-600">
                P13
              </Badge>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              A* pathfinding with multi-cell risk penalties & underpass avoidance
            </p>
          </div>
        </div>
      </div>

      {/* Network Stats Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-500">Connected Nodes</div>
          <div className="text-sm font-extrabold font-mono text-slate-800 dark:text-slate-200">28,418</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-500">Routing Edges</div>
          <div className="text-sm font-extrabold font-mono text-orange-600 dark:text-orange-400">37,924</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-500">Tagged Underpasses</div>
          <div className="text-sm font-extrabold font-mono text-purple-600 dark:text-purple-400">5</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-500">Urban Baseline</div>
          <div className="text-sm font-extrabold font-mono text-blue-600 dark:text-blue-400">30 km/h</div>
        </div>
      </div>

      {/* Origin & Destination Selector Form */}
      <div className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-850/80 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-blue-500" />
          <span>Plan Route in Amritsar</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* Origin */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-emerald-500" />
              <span>Origin (Start)</span>
            </label>
            <select
              value={originId}
              onChange={(e) => setOriginId(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
            >
              {AMRITSAR_LANDMARKS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Destination */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-rose-500" />
              <span>Destination (End)</span>
            </label>
            <select
              value={destId}
              onChange={(e) => setDestId(e.target.value)}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs"
            >
              {AMRITSAR_LANDMARKS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[10px] text-slate-500 italic flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Assumes 30 km/h baseline velocity (uncalibrated traffic)</span>
          </div>

          <button
            type="button"
            onClick={handlePlanRoutes}
            disabled={isPlanning}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{isPlanning ? 'Routing...' : 'Calculate Routes'}</span>
          </button>
        </div>
      </div>

      {planError && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{planError}</span>
        </div>
      )}

      {/* Candidate Routes List */}
      {planResult ? (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Candidate Routes ({planResult.routes.length}):</span>
            <span className="text-[11px] text-slate-500 font-normal">
              Click a card to inspect on map
            </span>
          </div>

          {planResult.routes.map((route, idx) => {
            const isSelected = selectedRouteId === route.routeId
            return (
              <div
                key={route.routeId}
                onClick={() => handleSelectCandidate(route)}
                className={`p-3 rounded-xl border text-xs space-y-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-1 ring-blue-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-center leading-4 text-[10px] font-mono">
                        #{idx + 1}
                      </span>
                      <span>{route.name}</span>
                      {route.mode && (
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {route.mode.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                      <span><strong>{route.totalDistanceKm.toFixed(2)} km</strong></span>
                      <span>•</span>
                      <span>Est. <strong>{route.estimatedTimeMinutes} mins</strong></span>
                      <span>•</span>
                      <span>{route.matchedSegmentsCount} segments</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <Badge
                      className={
                        route.recommendation === 'recommended'
                          ? 'bg-emerald-600 text-white text-[10px]'
                          : route.recommendation === 'caution'
                            ? 'bg-amber-500 text-slate-950 text-[10px]'
                            : 'bg-rose-600 text-white text-[10px]'
                      }
                    >
                      {route.recommendation.toUpperCase()}
                    </Badge>
                    <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                      Penalty: {route.compositePenaltyScore}/100
                    </div>
                  </div>
                </div>

                {/* Exposure breakdown bars */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Modelled Hazard Exposure:</span>
                    <span>
                      High: {(route.exposureByClass.high * 100).toFixed(0)}% • Mod: {(route.exposureByClass.moderate * 100).toFixed(0)}% • Low: {(route.exposureByClass.low * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div
                      style={{ width: `${route.exposureByClass.high * 100}%` }}
                      className="bg-rose-500 h-full"
                      title="High Risk"
                    />
                    <div
                      style={{ width: `${route.exposureByClass.moderate * 100}%` }}
                      className="bg-amber-400 h-full"
                      title="Moderate Risk"
                    />
                    <div
                      style={{ width: `${route.exposureByClass.low * 100}%` }}
                      className="bg-emerald-500 h-full"
                      title="Low Risk"
                    />
                  </div>
                </div>

                {/* Trade-off Explanation */}
                {route.explanation && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 italic">
                    {route.explanation}
                  </div>
                )}

                {/* Special Tags & Badges */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 border-t border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex flex-wrap gap-1.5">
                    {route.underpassCrossings > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        <span>{route.underpassCrossings} Underpass Bottleneck</span>
                      </span>
                    )}
                    {route.activeObservationCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold">
                        💧 {route.activeObservationCount} Reports
                      </span>
                    )}
                    {route.unknownRiskFraction > 0.1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                        ❓ {(route.unknownRiskFraction * 100).toFixed(0)}% Unknown
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-0.5">
                    <span>{isSelected ? 'Displayed on Map' : 'Select'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            )
          })}

          {/* Research Prototype Warning Notice */}
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-900 dark:text-amber-200 space-y-1">
            <div className="font-semibold flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" />
              <span>Experimental Decision-Support Prototype</span>
            </div>
            <p>
              Candidate routes reflect static 250m macro-catchment terrain runoff and documented field reports.
              NEXSTORM does not model live traffic, one-way laws, or real-time flood depth gauges. Never drive through flooded underpasses.
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-500 text-xs space-y-1">
          <p className="font-semibold text-slate-700 dark:text-slate-300">Select origin and destination above</p>
          <p className="text-[11px] text-slate-400">
            A* search will evaluate candidate paths across 37,924 connected edges in Amritsar.
          </p>
        </div>
      )}
    </div>
  )
}
