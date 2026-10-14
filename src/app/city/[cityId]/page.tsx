'use client'

import React, { useEffect, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ModeSwitch } from '@/components/modes/ModeSwitch'
import { ScenarioPanel, ScenarioParams } from '@/components/modes/ScenarioPanel'
import { Legend } from '@/components/map/Legend'
import { ProvenanceBadge } from '@/components/risk/ProvenanceBadge'
import { ConfidenceBadge } from '@/components/risk/ConfidenceBadge'
import type { ScenarioResult } from '@/lib/risk/types'
import type { SusceptibilityGeoJson } from '@/lib/city/registry'
import {
  MapPin,
  CloudRain,
  AlertTriangle,
  Activity,
} from 'lucide-react'

// Dynamically import Leaflet RiskMap with SSR disabled
const DynamicRiskMap = dynamic(
  () => import('@/components/map/RiskMap').then((mod) => mod.RiskMap),
  {
    ssr: false,
    loading: () => (
      <div
        data-testid="map-loading"
        className="w-full h-[600px] rounded-xl flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500"
      >
        <Activity className="w-8 h-8 animate-spin text-blue-500 mb-2" />
        <span className="text-sm font-medium">Initializing geospatial grid...</span>
      </div>
    ),
  }
)

export default function CityDashboardPage() {
  const params = useParams()
  const rawCityId = params?.cityId as string
  const cityId = (rawCityId || 'amritsar').toLowerCase()

  const [scenarioParams, setScenarioParams] = useState<ScenarioParams>({
    peakMm1h: 45,
    durationH: 4,
    antecedentMm72h: 35,
  })

  const [geoJsonData, setGeoJsonData] = useState<SusceptibilityGeoJson | null>(null)
  const [scenarioResult, setScenarioResult] = useState<ScenarioResult | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Load static GeoJSON once on mount
  useEffect(() => {
    let isMounted = true
    fetch(`/data/cities/${cityId}/susceptibility.geojson`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${cityId} geospatial grid`)
        return res.json()
      })
      .then((data: SusceptibilityGeoJson) => {
        if (isMounted) setGeoJsonData(data)
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load grid')
        }
      })

    return () => {
      isMounted = false
    }
  }, [cityId])

  // Recalculate scenario via API when parameters change
  useEffect(() => {
    let isCurrent = true
    startTransition(() => {
      fetch('/api/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId,
          ...scenarioParams,
        }),
      })
        .then(async (res) => {
          const json = await res.json()
          if (!res.ok || !json.success) {
            throw new Error(json.error?.message || 'Failed to calculate scenario')
          }
          if (isCurrent) {
            setScenarioResult(json.data)
            setError(null)
          }
        })
        .catch((err: unknown) => {
          if (isCurrent) {
            setError(err instanceof Error ? err.message : 'Calculation error')
          }
        })
    })

    return () => {
      isCurrent = false
    }
  }, [cityId, scenarioParams])

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* City Header & Metadata */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>Punjab, India</span>
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                BBox: 31.55°–31.72° N, 74.80°–74.95° E
              </Badge>
              <Badge
                data-testid="demo-data-badge"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] tracking-wider uppercase px-2 py-0.5"
              >
                DEMO DATA
              </Badge>
              <Badge variant="warning" className="text-[10px]">
                PROVISIONAL THRESHOLDS
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Amritsar Urban Waterlogging Early Warning
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              Relative waterlogging susceptibility mapped across 250m grid cells under simulated rainfall stress.
              Output represents an experimental relative risk model, not surveyed street-level flood elevations.
            </p>
          </div>

          <div className="shrink-0">
            <ModeSwitch />
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="my-4 p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* Controls & Metrics Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <ScenarioPanel
              params={scenarioParams}
              onChange={setScenarioParams}
              isLoading={isPending}
            />

            {/* Scenario Telemetry Card */}
            {scenarioResult && (
              <Card className="border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <CloudRain className="w-4 h-4 text-blue-500" />
                      <span>Simulated Rainfall Telemetry</span>
                    </CardTitle>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      48-Hour Model
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-3.5 space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                      <span className="block text-[10px] text-slate-500 uppercase">Peak (1h)</span>
                      <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                        {scenarioResult.rainfall.derived.maxMm1h} mm
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                      <span className="block text-[10px] text-slate-500 uppercase">Max (24h)</span>
                      <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">
                        {scenarioResult.rainfall.derived.totalMm24h} mm
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                      <span className="block text-[10px] text-slate-500 uppercase">Peak RTI</span>
                      <span className="font-mono font-bold text-sm text-purple-600 dark:text-purple-400">
                        {scenarioResult.rti.max}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50">
                      <span className="block text-[10px] text-slate-500 uppercase">RTI Band</span>
                      <span className="font-mono font-bold text-xs uppercase text-amber-600 dark:text-amber-400">
                        {scenarioResult.rti.band}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Forecast Confidence Status
                    </div>
                    <ConfidenceBadge
                      confidence={scenarioResult.cells[0]?.confidence ?? 'unavailable'}
                      memberCount={1}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Provenance Details */}
            {scenarioResult && (
              <ProvenanceBadge provenance={scenarioResult.provenance} />
            )}
          </div>

          {/* Map Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative">
              {geoJsonData && scenarioResult ? (
                <DynamicRiskMap
                  geoJsonData={geoJsonData}
                  cells={scenarioResult.cells}
                  center={[31.634, 74.872]}
                  zoom={12}
                />
              ) : (
                <div
                  data-testid="map-loading"
                  className="w-full h-[600px] rounded-xl flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500"
                >
                  <Activity className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <span className="text-sm font-medium">Loading geospatial grid cells...</span>
                </div>
              )}
            </div>

            {/* Risk Legend & Coverage */}
            {scenarioResult && (
              <Legend classShare={scenarioResult.classShare} />
            )}

            {/* Mandatory Experimental Data Note */}
            <div className="rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              <p>
                <strong>Methodology & Limitations:</strong> NEXSTORM evaluates storm events by computing the
                maximum Rainfall Threshold Index across 1h, 3h, 24h, and 72h durations against provisional IMD
                rainfall thresholds (T1h=25mm, T3h=50mm, T24h=64.5mm, T72h=120mm). Cell susceptibility (s) is
                generated via synthetic multi-scale harmonic noise over a 250m grid. This prototype does not claim
                predictive flood accuracy or replace official alerts from the Indian Meteorological Department (IMD)
                or National Disaster Management Authority (NDMA).
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
