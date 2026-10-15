'use client'

import React, { useState } from 'react'
import {
  Route,
  ShieldAlert,
  AlertTriangle,
  Info,
  Navigation,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { RouteComparisonResult } from '@/lib/roads/types'

interface RoadRiskPanelProps {
  cityId: string
  onSelectRoad?: (roadId: string) => void
}

// Sample candidate routes in Amritsar for testing route exposure scoring
const SAMPLE_ROUTES = [
  {
    routeId: 'route-gt-road',
    name: 'Route 1: Grand Trunk Road Corridor (Arterial)',
    description: 'Elevated arterial route connecting Amritsar Cantt to Court Rd',
    coordinates: [
      [74.838, 31.632],
      [74.851, 31.634],
      [74.868, 31.635],
      [74.885, 31.636],
      [74.898, 31.638],
    ] as [number, number][],
  },
  {
    routeId: 'route-railway-underpass',
    name: 'Route 2: Railway Colony via Low-lying Underpass',
    description: 'Low-elevation route crossing railway underpass with known drainage bottlenecks',
    coordinates: [
      [74.862, 31.621],
      [74.869, 31.627],
      [74.872, 31.631],
      [74.876, 31.635],
    ] as [number, number][],
  },
  {
    routeId: 'route-circular-road',
    name: 'Route 3: Walled City Circular Road',
    description: 'Peripheral bypass around historic walled city with variable drainage',
    coordinates: [
      [74.871, 74.872],
      [74.878, 31.625],
      [74.882, 31.622],
      [74.889, 31.623],
    ] as [number, number][],
  },
]

export function RoadRiskPanel({ cityId }: RoadRiskPanelProps) {
  const [isComparing, setIsComparing] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<RouteComparisonResult | null>(null)
  const [compareError, setCompareError] = useState<string | null>(null)

  const handleRunComparison = async () => {
    setIsComparing(true)
    setCompareError(null)

    try {
      const res = await fetch('/api/roads/route-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId,
          routes: SAMPLE_ROUTES.map((r) => ({
            routeId: r.routeId,
            name: r.name,
            coordinates: r.coordinates,
          })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to compare routes')
      }

      const data = await res.json()
      setComparisonResult(data.data)
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Unknown error during route comparison')
    } finally {
      setIsComparing(false)
    }
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
              <span>Road-Segment Risk & Routing</span>
              <Badge variant="outline" className="text-[10px] font-mono border-orange-500/40 text-orange-600">
                P11
              </Badge>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Multi-cell grid intersection & flood exposure scoring
            </p>
          </div>
        </div>
      </div>

      {/* Network Stats Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-500">Total Segments</div>
          <div className="text-sm font-extrabold font-mono text-slate-800 dark:text-slate-200">14,853</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-500">Major Corridors</div>
          <div className="text-sm font-extrabold font-mono text-orange-600 dark:text-orange-400">773</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-500">Tagged Underpasses</div>
          <div className="text-sm font-extrabold font-mono text-purple-600 dark:text-purple-400">5</div>
        </div>
        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-slate-500">Graph Nodes</div>
          <div className="text-sm font-extrabold font-mono text-blue-600 dark:text-blue-400">26,155</div>
        </div>
      </div>

      {/* Scientific Note */}
      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-850/60 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
        <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-blue-500" />
          <span>Multi-Cell Spatial Weighting</span>
        </div>
        <p>
          Road segments crossing multiple 250m cells preserve exact length fractions in each cell. Subsegment risk is not collapsed into a single nearest-cell lookup.
        </p>
      </div>

      {/* Candidate Route Comparison Tool */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-orange-500" />
            <span>Route Flood Exposure Comparison</span>
          </div>

          <button
            type="button"
            onClick={handleRunComparison}
            disabled={isComparing}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white transition shadow-xs flex items-center gap-1 cursor-pointer"
          >
            {isComparing ? 'Evaluating...' : 'Compare 3 Sample Routes'}
          </button>
        </div>

        {compareError && (
          <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{compareError}</span>
          </div>
        )}

        {/* Results */}
        {comparisonResult ? (
          <div className="space-y-2.5 pt-1">
            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              Ranked by Flood Safety (Safest to Highest Risk):
            </div>

            {comparisonResult.rankedRoutes.map((route, idx) => (
              <div
                key={route.routeId}
                className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                  idx === 0
                    ? 'border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/20'
                    : route.underpassCrossings > 0
                      ? 'border-purple-500/40 bg-purple-50/40 dark:bg-purple-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 text-center leading-4 text-[10px] font-mono">
                        #{idx + 1}
                      </span>
                      <span>{route.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Est. Length: {route.totalDistanceKm.toFixed(2)} km • Matched: {route.matchedSegmentsCount} segments
                    </div>
                  </div>

                  <div className="text-right">
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
                      Risk Penalty: {route.compositePenaltyScore}/100
                    </div>
                  </div>
                </div>

                {/* Exposure breakdown bars */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Exposure to Risk Segments:</span>
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

                {/* Special Tags */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {route.underpassCrossings > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      <span>{route.underpassCrossings} Underpass Bottleneck</span>
                    </span>
                  )}
                  {route.activeObservationCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold">
                      💧 {route.activeObservationCount} Active Reports
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* Disclaimer */}
            <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-200 dark:border-slate-800">
              * Route evaluation uses static 250m susceptibility, known underpasses, and verified community observations. Full graph Dijkstra pathfinding is slated for Stage P13.
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-500 text-xs">
            Click &ldquo;Compare 3 Sample Routes&rdquo; to evaluate candidate routes against Amritsar road risk and underpass bottlenecks.
          </div>
        )}
      </div>
    </div>
  )
}
