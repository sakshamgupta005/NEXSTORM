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
  Building,
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
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-6 sm:p-7 transition-all">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4 text-left">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0 shadow-2xs">
              <Compass className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                  Spatial Cell Inspector
                </span>
                <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Awaiting Selection
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5 max-w-2xl leading-relaxed">
                Click any 250m city cell or 50m campus sub-cell on the map above to inspect terrain slope, depression volume, runoff propensity, and historical incident proximity.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 shrink-0 shadow-2xs">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>Interactive Map Active</span>
          </div>
        </div>
      </div>
    )
  }

  const isLoading = Boolean(cellId && (!explanation || explanation.cellId !== cellId) && !error)
  const isCampus = cellId.startsWith('G-')
  const riskClass = cellRisk?.class || 'low'
  const riskColor = RISK_COLORS[riskClass]

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs p-6 sm:p-7 space-y-5">
      <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <span className="text-base font-extrabold flex items-center gap-1 font-mono text-slate-900">
            <span className="text-blue-600">#</span>
            <span>{cellId}</span>
          </span>
          <Badge variant="outline" className="text-xs font-mono font-semibold border-slate-200 bg-slate-50 text-slate-800">
            {isCampus ? 'GNDU Campus (50m)' : 'Amritsar City (250m)'}
          </Badge>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg cursor-pointer"
          title="Deselect cell"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4 text-xs">
        {isLoading && (
          <div className="py-8 text-center text-slate-600 space-y-2">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-medium">Loading factor contributions...</p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {explanation && !isLoading && (
          <>
            {/* Status & Scores */}
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Modelled Risk</span>
                <span
                  className="font-extrabold text-sm uppercase"
                  style={{ color: riskColor.fill }}
                >
                  {riskClass.toUpperCase()}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80">
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Susceptibility (s)</span>
                <span className="font-mono font-bold text-sm text-slate-900">
                  {explanation.sValue.toFixed(4)} ({explanation.sBand.toUpperCase()})
                </span>
              </div>
            </div>

            {/* Nearest Road */}
            {explanation.nearestRoad && (
              <div className="p-2.5 rounded-lg bg-slate-100/80 text-xs flex items-center gap-2 text-slate-700">
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>
                  <strong>Nearest Road:</strong> {explanation.nearestRoad}
                </span>
              </div>
            )}

            {/* Topographic Factor Contributions Table */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600" />
                  <span>Topographic Factor Breakdown</span>
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  s = Σ (v × w)
                </span>
              </div>

              <div className="space-y-2 border border-slate-200/80 rounded-xl p-3 bg-slate-50/60">
                {explanation.factorContributions.map((fc) => (
                  <div key={fc.factor} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-800 font-medium truncate max-w-[220px]" title={fc.label}>
                        {fc.label}
                      </span>
                      <span className="font-mono font-bold text-slate-700">
                        +{(fc.contribution).toFixed(4)}
                      </span>
                    </div>
                    {/* Visual Bar */}
                    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden flex">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${Math.min(Math.round(fc.contribution * 100 * 2), 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Historical Incident Hotspot Proximity */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-purple-600" />
                <span>Nearby Verified Incident Hotspot</span>
              </div>

              {explanation.nearbyHotspot ? (
                <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-950 text-xs">
                      {explanation.nearbyHotspot.name}
                    </span>
                    <Badge className="bg-purple-600 text-white text-[10px] px-2 py-0.5">
                      {explanation.nearbyHotspot.distanceMeters}m away
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-700">
                    Evidence: <span className="font-mono font-semibold">{explanation.nearbyHotspot.evidence}</span> (Precision: {explanation.nearbyHotspot.precision})
                  </p>

                  {explanation.nearbyHotspot.articleDate && (
                    <div className="text-xs text-slate-500 font-medium">
                      Reported: {explanation.nearbyHotspot.articleDate}
                    </div>
                  )}

                  {explanation.nearbyHotspot.sourceUrl && (
                    <a
                      href={explanation.nearbyHotspot.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 underline hover:text-purple-900 pt-0.5"
                    >
                      <span>View News Archive Record</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-slate-600 text-xs">
                  No verified historical waterlogging report found within 500m of this cell.
                </div>
              )}
            </div>

            {/* Terrain Override Notice if Active */}
            {explanation.terrainOverride.applied && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-700" />
                  <span>Terrain Flatness Override Active</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  {explanation.terrainOverride.note || explanation.terrainOverride.reason}
                </p>
              </div>
            )}

            {/* Building Footprint Exposure */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Building Footprint Exposure</span>
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Google Open Buildings V3
                </span>
              </div>

              {explanation.buildingExposure ? (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/80 space-y-2.5 text-xs">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Footprints</div>
                      <div className="text-sm font-extrabold font-mono text-indigo-700">
                        {explanation.buildingExposure.buildingCount}
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Total Area</div>
                      <div className="text-xs font-extrabold font-mono text-slate-900">
                        {Math.round(explanation.buildingExposure.totalFootprintAreaM2).toLocaleString()} m²
                      </div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Mean Area</div>
                      <div className="text-xs font-extrabold font-mono text-slate-900">
                        {Math.round(explanation.buildingExposure.meanFootprintAreaM2)} m²
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="text-slate-700 font-medium">Catchment Exposure Tier:</span>
                    <Badge
                      className={
                        explanation.buildingExposure.exposureCategory === 'high_catchment'
                          ? 'bg-rose-600 text-white text-[10px]'
                          : explanation.buildingExposure.exposureCategory === 'moderate_catchment'
                            ? 'bg-amber-500 text-slate-950 text-[10px]'
                            : 'bg-blue-600 text-white text-[10px]'
                      }
                    >
                      {explanation.buildingExposure.exposureCategory.replace(/_/g, ' ').toUpperCase()}
                    </Badge>
                  </div>

                  <p className="text-[11px] text-slate-500 italic">
                    * {explanation.buildingExposure.scientificCaveat}
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 text-slate-600 text-xs">
                  No building footprints indexed inside this grid cell.
                </div>
              )}
            </div>

            {/* Scientific Limitations for this Cell */}
            <div className="space-y-1 pt-1 border-t border-slate-100 text-xs text-slate-600">
              <span className="font-bold uppercase tracking-wider block text-slate-700">
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
      </div>
    </div>
  )
}
