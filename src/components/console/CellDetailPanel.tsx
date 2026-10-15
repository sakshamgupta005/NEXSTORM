'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CellExplanation } from '@/lib/risk/explain'
import type { CellRisk } from '@/lib/risk/types'
import {
  MapPin,
  Compass,
  AlertCircle,
  ExternalLink,
  X,
  Layers,
  Info,
} from 'lucide-react'
import { RISK_COLORS } from '@/components/map/Legend'

interface CellDetailPanelProps {
  cellId: string | null
  cityId?: string
  cellRisk?: CellRisk
  onClose: () => void
}

export function CellDetailPanel({
  cellId,
  cityId = 'amritsar',
  cellRisk,
  onClose,
}: CellDetailPanelProps) {
  const [explanation, setExplanation] = useState<CellExplanation | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!cellId) return

    let isMounted = true

    fetch(`/api/cell/${encodeURIComponent(cellId)}?cityId=${encodeURIComponent(cityId)}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || `Failed to fetch explanation for cell ${cellId}`)
        }
        if (isMounted) {
          setExplanation(json.data)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error retrieving cell details')
        }
      })

    return () => {
      isMounted = false
    }
  }, [cellId, cityId])

  if (!cellId) {
    return (
      <Card className="border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm">
        <CardContent className="p-6 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-500 mx-auto flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Cell Inspector
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            Click any 250m city cell or 50m campus sub-cell on the map to inspect its topographic factor contributions, risk attribution, and historical incident proximity.
          </p>
        </CardContent>
      </Card>
    )
  }

  const isLoading = Boolean(cellId && (!explanation || explanation.cellId !== cellId) && !error)
  const isCampus = cellId.startsWith('G-')
  const riskClass = cellRisk?.class || 'low'
  const riskColor = RISK_COLORS[riskClass]

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-md">
      <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 font-mono text-slate-900 dark:text-slate-100">
              <span className="text-blue-500">#</span>
              <span>{cellId}</span>
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono">
              {isCampus ? 'GNDU Campus (50m)' : 'Amritsar City (250m)'}
            </Badge>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            title="Deselect cell"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4 text-xs">
        {isLoading && (
          <div className="py-8 text-center text-slate-500 space-y-2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-[11px]">Loading factor contributions...</p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {explanation && !isLoading && (
          <>
            {/* Status & Scores */}
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                <span className="block text-[10px] text-slate-500 uppercase">Modelled Risk</span>
                <span
                  className="font-bold text-xs uppercase"
                  style={{ color: riskColor.fill }}
                >
                  {riskClass.toUpperCase()}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                <span className="block text-[10px] text-slate-500 uppercase">Susceptibility (s)</span>
                <span className="font-mono font-bold text-xs text-slate-800 dark:text-slate-200">
                  {explanation.sValue.toFixed(4)} ({explanation.sBand.toUpperCase()})
                </span>
              </div>
            </div>

            {/* Nearest Road */}
            {explanation.nearestRoad && (
              <div className="p-2 rounded bg-slate-100/70 dark:bg-slate-800/40 text-[11px] flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>
                  <strong>Nearest Road:</strong> {explanation.nearestRoad}
                </span>
              </div>
            )}

            {/* Topographic Factor Contributions Table */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-blue-500" />
                  <span>Topographic Factor Breakdown</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  s = Σ (v × w)
                </span>
              </div>

              <div className="space-y-1.5 border border-slate-200/80 dark:border-slate-800 rounded-lg p-2.5 bg-slate-50/50 dark:bg-slate-900/50">
                {explanation.factorContributions.map((fc) => (
                  <div key={fc.factor} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-700 dark:text-slate-300 truncate max-w-[200px]" title={fc.label}>
                        {fc.label}
                      </span>
                      <span className="font-mono font-medium text-slate-600 dark:text-slate-400">
                        +{(fc.contribution).toFixed(4)}
                      </span>
                    </div>
                    {/* Visual Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(Math.round(fc.contribution * 100 * 2), 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Incident Hotspot Proximity */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-purple-500" />
                <span>Nearby Verified Incident Hotspot</span>
              </div>

              {explanation.nearbyHotspot ? (
                <div className="p-2.5 rounded-lg border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-900 dark:text-purple-300 text-xs">
                      {explanation.nearbyHotspot.name}
                    </span>
                    <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0">
                      {explanation.nearbyHotspot.distanceMeters}m away
                    </Badge>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Evidence: <span className="font-mono">{explanation.nearbyHotspot.evidence}</span> (Precision: {explanation.nearbyHotspot.precision})
                  </p>

                  {explanation.nearbyHotspot.articleDate && (
                    <div className="text-[10px] text-slate-500">
                      Reported: {explanation.nearbyHotspot.articleDate}
                    </div>
                  )}

                  {explanation.nearbyHotspot.sourceUrl && (
                    <a
                      href={explanation.nearbyHotspot.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-400 underline hover:text-purple-900 dark:hover:text-purple-200 pt-0.5"
                    >
                      <span>View News Archive Record</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 text-slate-500 text-[11px]">
                  No verified historical waterlogging report found within 500m of this cell.
                </div>
              )}
            </div>

            {/* Terrain Override Notice if Active */}
            {explanation.terrainOverride.applied && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-[11px] space-y-1">
                <div className="font-semibold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5" />
                  <span>Terrain Flatness Override Active</span>
                </div>
                <p className="text-[10px] leading-relaxed">
                  {explanation.terrainOverride.note || explanation.terrainOverride.reason}
                </p>
              </div>
            )}

            {/* Scientific Limitations for this Cell */}
            <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="font-semibold uppercase tracking-wider block text-slate-600 dark:text-slate-300">
                Cell Evaluation Limitations:
              </span>
              <ul className="list-disc pl-4 space-y-0.5">
                {explanation.limitations.map((lim, i) => (
                  <li key={i}>{lim}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
