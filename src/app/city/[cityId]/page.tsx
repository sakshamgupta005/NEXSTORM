'use client'

import React, { useEffect, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { Badge } from '@/components/ui/badge'
import { ModeSwitch, ConsoleMode } from '@/components/modes/ModeSwitch'
import { ScenarioPanel, ScenarioParams } from '@/components/modes/ScenarioPanel'
import { Legend } from '@/components/map/Legend'
import { RainfallTimeline } from '@/components/console/RainfallTimeline'
import { RiskSummaryCards } from '@/components/console/RiskSummaryCards'
import { CellDetailPanel } from '@/components/console/CellDetailPanel'
import { OfficialAlertsPanel } from '@/components/console/OfficialAlertsPanel'
import { PunjabOverview } from '@/components/console/PunjabOverview'
import { MethodologySection } from '@/components/console/MethodologySection'
import type { CellRisk, TimelineHour, Provenance, RiskClass, Confidence } from '@/lib/risk/types'
import type { SusceptibilityGeoJson, HotspotRecord } from '@/lib/city/registry'
import {
  MapPin,
  AlertTriangle,
  Activity,
  GraduationCap,
  Building,
  Radio,
  History,
  Droplets,
} from 'lucide-react'
import { ObservationReportModal } from '@/components/observations/ObservationReportModal'
import { ObservationsPanel } from '@/components/observations/ObservationsPanel'
import { RoadRiskPanel } from '@/components/roads/RoadRiskPanel'
import type { WaterloggingObservation } from '@/lib/observations/types'
import type { CandidateRouteEvaluation } from '@/lib/roads/types'
import type { GeoJsonObject } from 'geojson'

// Dynamically import Leaflet RiskMap with SSR disabled
const DynamicRiskMap = dynamic(
  () => import('@/components/map/RiskMap').then((mod) => mod.RiskMap),
  {
    ssr: false,
    loading: () => (
      <div
        data-testid="map-loading"
        className="w-full h-[620px] rounded-xl flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500"
      >
        <Activity className="w-8 h-8 animate-spin text-blue-500 mb-2" />
        <span className="text-sm font-medium">Initializing geospatial grid...</span>
      </div>
    ),
  }
)

export interface RiskApiResponseData {
  cityId: string
  view: 'city' | 'campus'
  mode: ConsoleMode
  status: 'ok' | 'degraded'
  disclaimer: string
  beyondCalibration?: boolean
  beyondCalibrationReason?: string
  selectedHour: {
    hourIndex: number
    timestamp: string
    medianRti: number
    band: 'normal' | 'elevated' | 'extreme'
    confidence: Confidence
    hasEnsemble: boolean
    classDistribution: Record<RiskClass, number>
    classShare: Record<RiskClass, number>
  }
  rainfallSummary: {
    max1h: number
    max24h: number
    maxRti: number
  }
  rainfall?: {
    hours: string[]
    values: number[]
    derived: {
      totalMm24h: number
      maxMm1h: number
    }
  }
  timeline: TimelineHour[]
  cells: CellRisk[]
  classDistribution: Record<RiskClass, number>
  classShare: Record<RiskClass, number>
  provenance: Provenance[]
}

export default function CityDashboardPage() {
  const params = useParams()
  const rawCityId = params?.cityId as string
  const cityId = (rawCityId || 'amritsar').toLowerCase()

  // State: View Scope (City vs GNDU Campus)
  const [viewScope, setViewScope] = useState<'city' | 'campus'>('city')

  // State: Operational Mode
  const [mode, setMode] = useState<ConsoleMode>('scenario')

  // State: Scenario Parameters
  const [scenarioParams, setScenarioParams] = useState<ScenarioParams>({
    peakMm1h: 45,
    durationH: 4,
    antecedentMm72h: 35,
  })

  // State: Timeline Selected Hour
  const [selectedHour, setSelectedHour] = useState<number>(0)

  // State: Selected Cell for Inspection
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null)

  // State: Active Map Layer
  const [activeLayer, setActiveLayer] = useState<'risk' | 'susceptibility'>('risk')
  const [showHotspots, setShowHotspots] = useState<boolean>(true)

  // State: Geospatial & API Data
  const [geoJsonData, setGeoJsonData] = useState<SusceptibilityGeoJson | null>(null)
  const [hotspots, setHotspots] = useState<HotspotRecord[]>([])
  const [riskData, setRiskData] = useState<RiskApiResponseData | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // 1. Load GeoJSON when viewScope changes
  useEffect(() => {
    let isMounted = true
    const geoJsonPath =
      viewScope === 'campus'
        ? `/data/cities/${cityId}/campus_susceptibility.geojson`
        : `/data/cities/${cityId}/susceptibility.geojson`

    fetch(geoJsonPath)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${viewScope} geospatial grid`)
        return res.json()
      })
      .then((data: SusceptibilityGeoJson) => {
        if (isMounted) setGeoJsonData(data)
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load grid geometry')
        }
      })

    return () => {
      isMounted = false
    }
  }, [cityId, viewScope])

  // State: Community & Ground-Truth Observations
  const [observations, setObservations] = useState<WaterloggingObservation[]>([])
  const [showObservations, setShowObservations] = useState<boolean>(true)
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false)
  const [obsRefreshTrigger, setObsRefreshTrigger] = useState<number>(0)

  // 2. Load historical incident hotspots once
  useEffect(() => {
    let isMounted = true
    fetch(`/data/cities/${cityId}/hotspots.json`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: HotspotRecord[]) => {
        if (isMounted) setHotspots(data)
      })
      .catch(() => {
        // Non-blocking fallback
      })

    return () => {
      isMounted = false
    }
  }, [cityId])

  // 2b. Load Ground-Truth Observations from API
  useEffect(() => {
    let isMounted = true
    fetch(`/api/observations?cityId=${cityId}&limit=100`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.data?.observations) {
          setObservations(data.data.observations)
        }
      })
      .catch(() => {
        // Non-blocking fallback
      })

    return () => {
      isMounted = false
    }
  }, [cityId, obsRefreshTrigger])

  // State: Road Network Corridors
  const [showRoads, setShowRoads] = useState<boolean>(true)
  const [roadsGeoJson, setRoadsGeoJson] = useState<GeoJsonObject | null>(null)

  // 2c. Load Major Road Corridors GeoJSON
  useEffect(() => {
    if (cityId !== 'amritsar') return
    let isMounted = true

    fetch('/data/cities/amritsar/roads/major_corridors.geojson')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setRoadsGeoJson(data)
        }
      })
      .catch(() => {
        // Non-blocking fallback
      })

    return () => {
      isMounted = false
    }
  }, [cityId])

  // State: Building Footprints (Stage P12)
  const [showBuildings, setShowBuildings] = useState<boolean>(false)
  const [buildingsGeoJson, setBuildingsGeoJson] = useState<GeoJsonObject | null>(null)

  // 2d. Load Building Footprints GeoJSON on demand when layer is toggled
  useEffect(() => {
    if (cityId !== 'amritsar' || !showBuildings) return
    let isMounted = true

    const buildingPath =
      viewScope === 'campus'
        ? '/data/cities/amritsar/gndu/buildings.geojson'
        : '/data/cities/amritsar/buildings/hotspot_buildings.geojson'

    fetch(buildingPath)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data) {
          setBuildingsGeoJson(data)
        }
      })
      .catch(() => {
        // Non-blocking fallback
      })

    return () => {
      isMounted = false
    }
  }, [cityId, viewScope, showBuildings])

  // State: Active Flood-Aware Candidate Route (Stage P13)
  const [activeRoute, setActiveRoute] = useState<CandidateRouteEvaluation | null>(null)

  // 3. Query /api/risk on parameter, mode, view, or hour change
  useEffect(() => {
    let isCurrent = true
    startTransition(() => {
      const queryParams = new URLSearchParams()
      queryParams.set('cityId', cityId)
      queryParams.set('view', viewScope)
      queryParams.set('mode', mode)
      queryParams.set('t', String(selectedHour))

      if (mode === 'scenario') {
        queryParams.set('peakMm1h', String(scenarioParams.peakMm1h))
        queryParams.set('durationH', String(scenarioParams.durationH))
        queryParams.set('antecedentMm72h', String(scenarioParams.antecedentMm72h))
      } else if (mode === 'replay') {
        queryParams.set('event', '2025-09-01_amritsar')
      }

      fetch(`/api/risk?${queryParams.toString()}`)
        .then(async (res) => {
          const json = await res.json()
          if (!res.ok || !json.success) {
            throw new Error(json.error?.message || `Failed to evaluate risk (${res.status})`)
          }
          if (isCurrent) {
            setRiskData(json.data)
            setError(null)
          }
        })
        .catch((err: unknown) => {
          if (isCurrent) {
            setError(err instanceof Error ? err.message : 'Risk calculation error')
          }
        })
    })

    return () => {
      isCurrent = false
    }
  }, [cityId, viewScope, mode, selectedHour, scenarioParams])

  // Find currently selected cell risk
  const selectedCellRisk = selectedCellId && riskData?.cells
    ? riskData.cells.find((c) => c.id === selectedCellId)
    : undefined

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {/* City Console Operations Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>Punjab, India</span>
              </span>

              <Badge variant="outline" className="text-[10px] font-mono">
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

              {riskData?.status === 'degraded' && (
                <Badge variant="danger" className="text-[10px]">
                  DEGRADED CACHE FALLBACK
                </Badge>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Amritsar City Waterlogging Risk Console
            </h1>

            <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
              Operational geospatial decision-support console mapping relative waterlogging susceptibility and rainfall-triggered risk. Output represents an experimental relative risk model, not surveyed street-level flood elevations.
            </p>
          </div>

          {/* Controls: View Scope & Mode Switch */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* View Scope Toggle (City vs GNDU Campus) */}
            <div
              role="group"
              aria-label="Geographic Scope"
              className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-xs"
            >
              <button
                type="button"
                onClick={() => setViewScope('city')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  viewScope === 'city'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Amritsar City (250m)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewScope('campus')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${
                  viewScope === 'campus'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>GNDU Campus (50m)</span>
              </button>
            </div>

            {/* Mode Switcher & Community Report Action */}
            <div className="flex items-center gap-2">
              <ModeSwitch mode={mode} onChange={setMode} disabled={isPending} />

              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
              >
                <Droplets className="w-3.5 h-3.5" />
                <span>Report Waterlogging</span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-200 text-xs sm:text-sm flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Operations Layout: 12-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Map & Legend (7 cols on lg) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative">
              {geoJsonData && riskData ? (
                <DynamicRiskMap
                  geoJsonData={geoJsonData}
                  cells={riskData.cells}
                  center={viewScope === 'campus' ? [31.6375, 74.825] : [31.634, 74.872]}
                  zoom={viewScope === 'campus' ? 15 : 12}
                  selectedCellId={selectedCellId}
                  onSelectCell={setSelectedCellId}
                  activeLayer={activeLayer}
                  onLayerChange={setActiveLayer}
                  showHotspots={showHotspots}
                  onToggleHotspots={setShowHotspots}
                  hotspots={hotspots}
                  showObservations={showObservations}
                  onToggleObservations={setShowObservations}
                  observations={observations}
                  showRoads={showRoads}
                  onToggleRoads={setShowRoads}
                  roadsGeoJson={roadsGeoJson}
                  showBuildings={showBuildings}
                  onToggleBuildings={setShowBuildings}
                  buildingsGeoJson={buildingsGeoJson}
                  activeRoute={
                    activeRoute?.geometry?.coordinates
                      ? {
                          coordinates: activeRoute.geometry.coordinates,
                          name: activeRoute.name,
                          mode: activeRoute.mode,
                        }
                      : null
                  }
                  onClearRoute={() => setActiveRoute(null)}
                />
              ) : (
                <div
                  data-testid="map-loading"
                  className="w-full h-[620px] rounded-xl flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500"
                >
                  <Activity className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <span className="text-sm font-medium">Loading {viewScope} geospatial grid cells...</span>
                </div>
              )}
            </div>

            {/* Risk / Susceptibility Legend */}
            {riskData && (
              <Legend
                classShare={riskData.classShare}
                activeLayer={activeLayer}
              />
            )}

            {/* Selected Cell Detail Panel */}
            <CellDetailPanel
              cellId={selectedCellId}
              cityId={cityId}
              cellRisk={selectedCellRisk}
              onClose={() => setSelectedCellId(null)}
            />
          </div>

          {/* Right Column: Controls, Telemetry & Alerts (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Mode-Specific Controls */}
            {mode === 'scenario' && (
              <ScenarioPanel
                params={scenarioParams}
                onChange={setScenarioParams}
                isLoading={isPending}
              />
            )}

            {mode === 'replay' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <History className="w-4 h-4 text-purple-500" />
                  <span>Historical Event Replay: September 1, 2025</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Replaying 72-hour historical extreme monsoon storm series from Open-Meteo ERA5-Land reanalysis archive over Amritsar. Use the timeline scrubber below to step through storm hours.
                </p>
                <div className="text-[10px] text-slate-400 font-mono">
                  Event Dataset: 2025-09-01_amritsar.json (Verified)
                </div>
              </div>
            )}

            {mode === 'live' && (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200">
                  <Radio className="w-4 h-4 text-blue-500" />
                  <span>Operational Live Weather Telemetry</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Active 48-hour numerical weather prediction ensemble (ECMWF IFS 0.25° + NOAA GFS). Fallback to cached snapshot active if upstream times out.
                </p>
              </div>
            )}

            {/* Rainfall Timeline Scrubber */}
            {riskData && riskData.timeline && (
              <RainfallTimeline
                timeline={riskData.timeline}
                rainfallValues={riskData.rainfall?.values}
                selectedHourIndex={selectedHour}
                onSelectHour={setSelectedHour}
                isLoading={isPending}
                beyondCalibration={riskData.beyondCalibration}
                beyondCalibrationReason={riskData.beyondCalibrationReason}
              />
            )}

            {/* Risk Summary Metrics */}
            {riskData && (
              <RiskSummaryCards
                totalCells={geoJsonData?.features?.length || riskData.cells?.length || 1998}
                classDistribution={riskData.classDistribution}
                classShare={riskData.classShare}
                rainfallSummary={riskData.rainfallSummary}
                rtiBand={riskData.selectedHour?.band}
                confidence={riskData.selectedHour?.confidence}
                memberCount={riskData.selectedHour?.hasEnsemble ? 51 : 1}
                provenance={riskData.provenance}
                mode={mode}
              />
            )}

            {/* Official Alerts Panel */}
            <OfficialAlertsPanel />

            {/* Community Observations & Ground-Truth Evidence Panel */}
            <ObservationsPanel
              cityId={cityId}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              refreshTrigger={obsRefreshTrigger}
              onSelectObservation={(obs) => {
                if (obs.spatialMatch.cellId) {
                  setSelectedCellId(obs.spatialMatch.cellId)
                }
              }}
            />

            {/* Road-Segment Risk Assessment & Route Exposure Panel */}
            {cityId === 'amritsar' && (
              <RoadRiskPanel
                cityId={cityId}
                onSelectRoute={setActiveRoute}
                activeRouteId={activeRoute?.routeId}
              />
            )}
          </div>
        </div>

        {/* Lower Full-Width Sections: Punjab Overview & Methodology */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          <PunjabOverview />
          <MethodologySection />
        </div>
      </main>

      {/* Community Waterlogging Observation Reporting Modal */}
      <ObservationReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        cityId={cityId}
        onObservationSubmitted={() => {
          setObsRefreshTrigger((prev) => prev + 1)
        }}
      />

      <Footer />
    </div>
  )
}
