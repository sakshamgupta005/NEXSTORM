'use client'

import React, { useEffect, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FrontendNavbar } from '@/components/home/FrontendNavbar'
import { DisclaimerBanner } from '@/components/layout/DisclaimerBanner'
import { HealthDiagnosticsModal } from '@/components/home/HealthDiagnosticsModal'
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
  AlertTriangle,
  Activity,
  GraduationCap,
  Building,
  Radio,
  History,
  CloudRain,
  Car,
  Users,
  Info,
  ArrowLeft,
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
  selectedHour?: {
    index: number
    hour: number
    timestamp: string
    rainfallMm: number
    rti: number
    band: string
    hasEnsemble: boolean
    confidence: Confidence
  }
  classDistribution?: Record<RiskClass, number>
  classShare?: Record<RiskClass, number>
  cells: CellRisk[]
  timeline?: TimelineHour[]
  rainfall?: {
    unit: string
    values: number[]
  }
  rainfallSummary?: {
    max1h: number
    max24h: number
    maxRti: number
  }
  provenance: Provenance[]
}

type OperationsTab = 'storm' | 'roads' | 'reports' | 'alerts'

export default function CityDashboardPage() {
  const params = useParams()
  const cityId = (params?.cityId as string) || 'amritsar'

  // View Scope: 250m Macro City vs 50m Micro GNDU Campus
  const [viewScope, setViewScope] = useState<'city' | 'campus'>('city')

  // Operational Analysis Mode
  const [mode, setMode] = useState<ConsoleMode>('scenario')

  // Timeline Hour Scrubber (0 to 47 or 71)
  const [selectedHour, setSelectedHour] = useState<number>(0)

  // Interactive Layer Toggles
  const [activeLayer, setActiveLayer] = useState<'risk' | 'susceptibility'>('risk')
  const [showHotspots, setShowHotspots] = useState<boolean>(true)

  // Selected Cell for Deep Inspector
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null)

  // Right Deck Operational Tab
  const [operationsTab, setOperationsTab] = useState<OperationsTab>('storm')

  // Scenario Simulation Parameters (defaults match P3 calibrated limits)
  const [scenarioParams, setScenarioParams] = useState<ScenarioParams>({
    peakMm1h: 45,
    durationH: 4,
    antecedentMm72h: 20,
  })

  // Data states
  const [geoJsonData, setGeoJsonData] = useState<SusceptibilityGeoJson | null>(null)
  const [hotspots, setHotspots] = useState<HotspotRecord[]>([])
  const [riskData, setRiskData] = useState<RiskApiResponseData | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Modals
  const [isHealthModalOpen, setIsHealthModalOpen] = useState<boolean>(false)
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false)

  // 1. Load GeoJSON geometry when city or view scope changes
  useEffect(() => {
    let isMounted = true
    const geoJsonPath =
      viewScope === 'campus'
        ? '/data/cities/amritsar/gndu/susceptibility.geojson'
        : `/data/cities/${cityId}/susceptibility.geojson`

    fetch(geoJsonPath)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load map geometry for ${cityId}`)
        return res.json()
      })
      .then((data: SusceptibilityGeoJson) => {
        if (isMounted) setGeoJsonData(data)
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Error loading map geometry')
        }
      })

    return () => {
      isMounted = false
    }
  }, [cityId, viewScope])

  // State: Community & Ground-Truth Observations
  const [observations, setObservations] = useState<WaterloggingObservation[]>([])
  const [showObservations, setShowObservations] = useState<boolean>(true)
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

  // State: Building Footprints
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

  // State: Active Flood-Aware Candidate Route
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

  // Memoized stable center coordinates
  const mapCenter = React.useMemo<[number, number]>(
    () => (viewScope === 'campus' ? [31.6375, 74.825] : [31.634, 74.872]),
    [viewScope]
  )
  const mapZoom = viewScope === 'campus' ? 15 : 12

  // Find currently selected cell risk
  const selectedCellRisk = selectedCellId && riskData?.cells
    ? riskData.cells.find((c) => c.id === selectedCellId)
    : undefined

  const handleScopeChange = (scope: 'city' | 'campus') => {
    setViewScope(scope)
    setSelectedCellId(null)
  }

  const highPct = Math.round((riskData?.classShare?.high ?? 0) * 100)
  const totalCellsCount = geoJsonData?.features?.length || riskData?.cells?.length || 1998
  const highCellsCount = Math.round(
    (riskData?.classDistribution?.high ?? 0) <= 1 && totalCellsCount > 1
      ? (riskData?.classDistribution?.high ?? 0) * totalCellsCount
      : (riskData?.classDistribution?.high ?? 0)
  )

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f5f7] text-[#090e17] font-sans light-premium">
      {/* High-Precision Unified Header Navigation */}
      <FrontendNavbar
        onOpenStatusModal={() => setIsHealthModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      {/* Official Research Prototype Disclaimer Banner */}
      <DisclaimerBanner />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-8">
        {/* Breadcrumb Return Navigation & Context Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200/80 shadow-2xs hover:text-blue-700 hover:border-blue-300 transition-all w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Platform Overview</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Amritsar Urban Core (250m Catchment)</span>
            </span>
            <Badge
              data-testid="demo-data-badge"
              className="bg-slate-900 text-white font-bold text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-md"
            >
              DEMO DATA
            </Badge>
            <Badge variant="outline" className="text-[10px] font-semibold border-amber-300 text-amber-800 bg-amber-50">
              PROVISIONAL THRESHOLDS
            </Badge>
          </div>
        </div>

        {/* Unified Console Header & High-Visibility Control Command Center */}
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-sm p-6 sm:p-8 flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex-1 space-y-2.5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-blue-700 bg-blue-50/80 border border-blue-200/70">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                <span className="uppercase tracking-wider text-[11px]">Dual-Resolution Hydrological Digital Twin</span>
                <span className="text-slate-300">&bull;</span>
                <span className="font-medium text-slate-600">{viewScope === 'city' ? '250m Macro Catchment' : '50m Micro Campus Grid'}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 font-display">
                {cityId.charAt(0).toUpperCase() + cityId.slice(1)} Flood Risk Explorer
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-sans max-w-2xl">
                Catchment-scale hydrometeorological simulation and waterlogging vulnerability across {cityId === 'amritsar' ? "Amritsar's" : `${cityId}'s`} urban cells with sub-catchment topographic run-off modeling.
              </p>

              {/* Data Integrity & Scientific Grounding Bar */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium bg-slate-50 text-slate-700 border border-slate-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                  <span>Model: <strong>Relative Susceptibility (0–100)</strong> (Runoff propensity)</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium bg-slate-50 text-slate-700 border border-slate-200/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                  <span>Weather Feed: <strong>{mode === 'scenario' ? 'Synthetic Scenario Hyetograph' : mode === 'replay' ? 'ERA5-Land Reanalysis (Historical)' : 'ECMWF/GFS Forecast (Live)'}</strong></span>
                </span>
                {cityId === 'jalandhar' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                    <span>Status: <strong>Exploratory / Uncalibrated</strong></span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
                    <span>Evidence: <strong>Evaluation Ready</strong> (15 Monsoon Backtests)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Executive Catchment Status Card */}
            <div className="lg:w-80 w-full rounded-xl bg-slate-50/80 border border-slate-200/80 p-4 shrink-0 flex flex-col justify-between gap-3 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  Catchment Telemetry
                </span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Active Model
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Catchment Scope</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {viewScope === 'city' ? '250m Macro' : '50m Micro'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">High Exposure</span>
                  <span className="font-bold text-rose-600 font-mono">
                    {highPct}% ({highCellsCount})
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Peak Rain Rate</span>
                  <span className="font-bold text-blue-600 font-mono">
                    {mode === 'scenario' ? scenarioParams.peakMm1h : riskData?.rainfallSummary?.max1h ?? 0} mm/h
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Corridors Tracked</span>
                  <span className="font-bold text-slate-800 font-mono">
                    7 Routes
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Dedicated High-Visibility Command Control Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
            {/* Catchment Spatial Resolution Selector */}
            <div className="lg:col-span-5 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                <span>Catchment Spatial Resolution</span>
              </span>
              <div
                role="group"
                aria-label="Geographic Scope"
                className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-1.5 rounded-xl bg-slate-100/90 border border-slate-200/80 shadow-2xs"
              >
                <button
                  type="button"
                  onClick={() => handleScopeChange('city')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewScope === 'city'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <Building className={`w-3.5 h-3.5 shrink-0 ${viewScope === 'city' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="tracking-tight whitespace-nowrap">Amritsar (250m)</span>
                  {viewScope === 'city' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleScopeChange('campus')}
                  className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    viewScope === 'campus'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                      : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <GraduationCap className={`w-3.5 h-3.5 shrink-0 ${viewScope === 'campus' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className="tracking-tight whitespace-nowrap">GNDU Campus (50m)</span>
                  {viewScope === 'campus' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
                </button>
              </div>
            </div>

            {/* Operational Mode Selector */}
            <div className="lg:col-span-7 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-blue-600" />
                <span>Simulation &amp; Analysis Mode</span>
              </span>
              <ModeSwitch mode={mode} onChange={setMode} disabled={isPending} />
            </div>
          </div>
        </div>

        {/* 4 Executive Metric Callouts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Peak Rainfall</span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
                <CloudRain className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 font-display">
                {mode === 'scenario' ? scenarioParams.peakMm1h : riskData?.rainfallSummary?.max1h ?? 0}
              </span>
              <span className="text-xs font-semibold text-slate-500 font-mono">mm/h</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">
              {mode === 'scenario' ? 'Simulated 1h storm peak rate' : 'Observed/forecast peak rate'}
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">High Risk Exposure</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-rose-600 font-display">
                {highPct}%
              </span>
              <span className="text-xs font-semibold text-slate-500 font-mono">of cells</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-rose-500 h-full rounded-full" style={{ width: `${Math.min(highPct, 100)}%` }} />
            </div>
            <p className="text-xs text-slate-500 leading-snug">
              {highCellsCount.toLocaleString()} cells in critical depression
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Catchment Grid</span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 font-display">
                {totalCellsCount.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500 font-mono">cells</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">
              {viewScope === 'city' ? '250m macro catchment grid' : '50m campus micro grid'}
            </p>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Road Corridors</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center">
                <Car className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold text-slate-900 font-display">
                7 Major
              </span>
              <span className="text-xs font-semibold text-slate-500 font-mono">routes</span>
            </div>
            <p className="text-xs text-slate-500 leading-snug">
              GT Road, Airport &amp; Circular links
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2"
          >
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Geospatial & Temporal Stage (Full Width) */}
        <div className="flex flex-col gap-6">
          {/* Map Card */}
          <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Metropolitan Spatial Risk &amp; Inundation Model
                </span>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                  {viewScope === 'city' ? '250m Macro Catchment' : '50m Micro Campus'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono">
                <span>Center: {viewScope === 'campus' ? '31.6375°N, 74.8250°E' : '31.6340°N, 74.8720°E'}</span>
              </div>
            </div>
            <div className="p-3.5 sm:p-4">
              {geoJsonData && riskData ? (
                <DynamicRiskMap
                  geoJsonData={geoJsonData}
                  cells={riskData.cells}
                  center={mapCenter}
                  zoom={mapZoom}
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
                  className="w-full h-[620px] rounded-xl flex flex-col items-center justify-center bg-slate-100 border border-slate-200 text-slate-500"
                >
                  <Activity className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                  <span className="text-sm font-medium">Loading {viewScope} geospatial grid cells...</span>
                </div>
              )}
            </div>
          </div>

          {/* Risk / Susceptibility Legend */}
          {riskData && (
            <Legend
              classShare={riskData.classShare}
              activeLayer={activeLayer}
            />
          )}

          {/* Rainfall Timeline Scrubber placed right beneath the map */}
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

          {/* Cell Detail Inspector (Interactive when cell selected; calm spatial prompt when idle) */}
          <div className="pt-2">
            <CellDetailPanel
              cellId={selectedCellId}
              cityId={cityId}
              cellRisk={selectedCellRisk}
              onClose={() => setSelectedCellId(null)}
            />
          </div>
        </div>

        {/* Dedicated Operations & Analysis Workspace (Full Width, Pushed Downwards) */}
        <div className="flex flex-col gap-6 pt-6">
          {/* Workspace Tab Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Operations &amp; Response Workspace
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                Detailed catchment hydrology, road passability, citizen telemetry, and civil alert feeds.
              </p>
            </div>
          </div>

          {/* Large Tab Navigation Controls */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => setOperationsTab('storm')}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                operationsTab === 'storm'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <CloudRain className={`w-4 h-4 ${operationsTab === 'storm' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="tracking-tight whitespace-nowrap">Storm Simulation</span>
              {operationsTab === 'storm' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => setOperationsTab('roads')}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                operationsTab === 'roads'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Car className={`w-4 h-4 ${operationsTab === 'roads' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="tracking-tight whitespace-nowrap">Roads &amp; Travel</span>
              {operationsTab === 'roads' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => setOperationsTab('reports')}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                operationsTab === 'reports'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Users className={`w-4 h-4 ${operationsTab === 'reports' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="tracking-tight whitespace-nowrap">Field Reports</span>
              {operationsTab === 'reports' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
            </button>

            <button
              type="button"
              onClick={() => setOperationsTab('alerts')}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
                operationsTab === 'alerts'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Info className={`w-4 h-4 ${operationsTab === 'alerts' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span className="tracking-tight whitespace-nowrap">Alerts &amp; Science</span>
              {operationsTab === 'alerts' && <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />}
            </button>
          </div>

          {/* Tab 1: Storm Simulation & Risk Overview in a balanced 2-column grid */}
          {operationsTab === 'storm' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-6 space-y-6">
                {mode === 'scenario' && (
                  <ScenarioPanel
                    params={scenarioParams}
                    onChange={setScenarioParams}
                    isLoading={isPending}
                  />
                )}

                {mode === 'replay' && (
                  <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-6 space-y-3 text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                        <History className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-display">Historical Event Replay: September 1, 2025</span>
                    </div>
                    <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                      Replaying 72-hour historical extreme monsoon storm series from Open-Meteo ERA5-Land reanalysis archive over Amritsar. Use the timeline scrubber above to step through storm hours.
                    </p>
                    <div className="text-[11px] text-blue-700 font-mono bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 inline-block font-semibold">
                      Event Dataset: 2025-09-01_amritsar.json (Verified)
                    </div>
                  </div>
                )}

                {mode === 'live' && (
                  <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-6 space-y-3 text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                        <Radio className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-display">Operational Live Weather Telemetry</span>
                    </div>
                    <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
                      Active 48-hour numerical weather prediction ensemble (ECMWF IFS 0.25° + NOAA GFS). Fallback to cached snapshot active if upstream times out.
                    </p>
                  </div>
                )}
              </div>

              {/* Risk Summary Metrics in the balanced right column */}
              <div className="lg:col-span-6 space-y-6">
                {riskData && (
                  <RiskSummaryCards
                    totalCells={totalCellsCount}
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
              </div>
            </div>
          )}

          {/* Tab 2: Roads & Travel Passability */}
          {operationsTab === 'roads' && (
            <div className="space-y-4">
              {cityId === 'amritsar' ? (
                <RoadRiskPanel
                  cityId={cityId}
                  onSelectRoute={setActiveRoute}
                  activeRouteId={activeRoute?.routeId}
                />
              ) : (
                <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-sm text-slate-500">
                  Road network corridor analysis is currently calibrated for the Amritsar metropolitan area.
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Citizen Reports & Evidence */}
          {operationsTab === 'reports' && (
            <div className="space-y-4">
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
            </div>
          )}

          {/* Tab 4: Official Alerts & Science Guidance */}
          {operationsTab === 'alerts' && (
            <div className="space-y-4">
              <OfficialAlertsPanel />
              <PunjabOverview />
              <MethodologySection />
            </div>
          )}
        </div>
      </main>

      {/* Trust & Scientific Disclaimer Footer */}
      <footer className="w-full border-t border-slate-200 bg-white/80 py-6 px-8 text-center text-xs text-slate-500 mt-16">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-left">
            <span className="font-bold text-slate-800">NEXSTORM</span> &bull; Amritsar Urban
            Resilience Platform
            <p className="text-[11px] text-slate-400 mt-0.5">
              Experimental research prototype. Not an official weather forecast or emergency
              warning. For official alerts see IMD and NDMA SACHET.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link href="/?tab=overview" className="text-slate-600 hover:text-blue-700 transition">
              Overview
            </Link>
            <Link href="/?tab=buildings" className="text-slate-600 hover:text-blue-700 transition">
              Buildings
            </Link>
            <Link href="/?tab=roads" className="text-slate-600 hover:text-blue-700 transition">
              Roads
            </Link>
            <Link href="/?tab=about" className="text-slate-600 hover:text-blue-700 transition">
              About
            </Link>
          </div>
        </div>
      </footer>

      {/* Diagnostics Modal for Live Status */}
      <HealthDiagnosticsModal
        isOpen={isHealthModalOpen}
        onClose={() => setIsHealthModalOpen(false)}
      />

      {/* Community Waterlogging Observation Reporting Modal */}
      <ObservationReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        cityId={cityId}
        onObservationSubmitted={() => {
          setObsRefreshTrigger((prev) => prev + 1)
        }}
      />
    </div>
  )
}
