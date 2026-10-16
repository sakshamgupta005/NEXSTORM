'use client'

import React, { useEffect, useState, useTransition } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { FrontendNavbar } from '@/components/home/FrontendNavbar'
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
  MapPin,
  AlertTriangle,
  Activity,
  GraduationCap,
  Building,
  Radio,
  History,
  Droplets,
  CloudRain,
  Car,
  Users,
  Info,
  ArrowLeft,
  Sliders,
  ShieldCheck,
  CheckCircle2,
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
  const modPct = Math.round((riskData?.classShare?.moderate ?? 0) * 100)
  const totalCellsCount = geoJsonData?.features?.length || riskData?.cells?.length || 1998

  return (
    <div className="min-h-screen flex flex-col bg-[#f5f8fb] text-[#090e17] font-sans light-premium">
      {/* High-Precision Unified Header Navigation */}
      <FrontendNavbar
        activeTab="console"
        onOpenStatusModal={() => setIsHealthModalOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-8 py-5 space-y-5">
        {/* Breadcrumb Return Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-700 transition group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Return to Platform Overview</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-semibold text-slate-500">
              Amritsar 250m Macro-Catchment Model
            </span>
          </div>
        </div>

        {/* Hero Section & Plain-English Overview Card */}
        <div className="neuro-card p-6 sm:p-7 space-y-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-2">
              <div className="trust-pill inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200">
                <span className="pill-sparkle text-blue-600">✦</span>
                <span className="pill-text">Operational Urban Resilience Intelligence</span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 font-display">
                Amritsar Flood Risk Explorer
              </h1>

              <p className="text-xs sm:text-sm text-slate-600 max-w-3xl leading-relaxed">
                Explore block-by-block flood susceptibility across Amritsar&apos;s 1,998 macro-catchment grid cells. 
                Simulate severe monsoon cloudbursts, track low-lying drainage depressions, and identify vulnerable roads.
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 self-start lg:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition shadow-xs cursor-pointer active:scale-95"
              >
                <Droplets className="w-4 h-4 text-emerald-600" />
                <span>Report Waterlogging</span>
              </button>
            </div>
          </div>

          {/* Prototype Notice Card */}
          <div
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs shadow-xs"
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Research Prototype:</strong> Computational hydrological simulation based on Copernicus 30m DEM elevation sinks and rainfall hyetographs. Not an official emergency warning or municipal evacuation broadcast.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                data-testid="demo-data-badge"
                className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] tracking-wider uppercase px-2.5 py-0.5"
              >
                DEMO DATA
              </Badge>
              <Badge variant="outline" className="text-[10px] font-semibold border-amber-300 text-amber-800 bg-amber-100/60">
                PROVISIONAL THRESHOLDS
              </Badge>
            </div>
          </div>

          {/* Interactive Command Deck Bar */}
          <div className="pt-4 border-t border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            {/* Grid Scope & Analysis Mode Switches */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Geographic Scope Pill */}
              <div
                role="group"
                aria-label="Geographic Scope"
                className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs shadow-inner"
              >
                <button
                  type="button"
                  onClick={() => handleScopeChange('city')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                    viewScope === 'city'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Amritsar City (250m)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleScopeChange('campus')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
                    viewScope === 'campus'
                      ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  <span>GNDU Campus (50m)</span>
                </button>
              </div>

              {/* Mode Switcher */}
              <ModeSwitch mode={mode} onChange={setMode} disabled={isPending} />
            </div>

            {/* Quick Status Pill */}
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>
                Active Mode:{' '}
                <strong className="text-slate-800 uppercase tracking-wider text-[11px]">
                  {mode === 'scenario' ? 'Rainfall Simulation' : mode === 'live' ? 'Live Telemetry' : 'Historic Replay'}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* 4 Executive Metric Callouts */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <div className="metric-block p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <CloudRain className="w-3.5 h-3.5 text-blue-600" />
              <span>Peak Rainfall</span>
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {mode === 'scenario' ? scenarioParams.peakMm1h : riskData?.rainfallSummary?.max1h ?? 0}
              </span>
              <span className="text-xs font-semibold text-slate-500">mm/h</span>
            </div>
            <p className="text-[10px] text-slate-400">
              {mode === 'scenario' ? 'Simulated storm peak' : 'Observed/forecast peak'}
            </p>
          </div>

          <div className="metric-block p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>High Waterlogging Risk</span>
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-600 font-mono">
                {highPct}%
              </span>
              <span className="text-xs font-semibold text-slate-500">of wards</span>
            </div>
            <p className="text-[10px] text-slate-400">
              {riskData?.classDistribution?.high ?? 0} cells in critical depression
            </p>
          </div>

          <div className="metric-block p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-purple-600" />
              <span>Catchment Grid</span>
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {totalCellsCount.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-slate-500">cells</span>
            </div>
            <p className="text-[10px] text-slate-400">
              {viewScope === 'city' ? '250m macro catchment' : '50m campus micro grid'}
            </p>
          </div>

          <div className="metric-block p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-emerald-600" />
              <span>Road Corridors</span>
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-700 font-mono">
                7 Major
              </span>
              <span className="text-xs font-semibold text-slate-500">routes</span>
            </div>
            <p className="text-[10px] text-slate-400">
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

        {/* Primary 2-Column Split: Left (Interactive Map Deck) | Right (Organized Operations Deck) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive Map Deck, Legend, Timeline Scrubber & Cell Inspector */}
          <div className="lg:col-span-7 space-y-4">
            {/* Map Card */}
            <div className="relative rounded-2xl border border-slate-200/90 bg-white shadow-md p-2 overflow-hidden">
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

            {/* Selected Cell Detail Panel */}
            <CellDetailPanel
              cellId={selectedCellId}
              cityId={cityId}
              cellRisk={selectedCellRisk}
              onClose={() => setSelectedCellId(null)}
            />
          </div>

          {/* Right Column: Clean Tabbed Operations Deck */}
          <div className="lg:col-span-5 space-y-4">
            {/* Tab Navigation Controls */}
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <button
                type="button"
                onClick={() => setOperationsTab('storm')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  operationsTab === 'storm'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <CloudRain className="w-3.5 h-3.5" />
                <span>Storm Simulation</span>
              </button>

              <button
                type="button"
                onClick={() => setOperationsTab('roads')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  operationsTab === 'roads'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Car className="w-3.5 h-3.5" />
                <span>Roads &amp; Travel</span>
              </button>

              <button
                type="button"
                onClick={() => setOperationsTab('reports')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  operationsTab === 'reports'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Field Reports</span>
              </button>

              <button
                type="button"
                onClick={() => setOperationsTab('alerts')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  operationsTab === 'alerts'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Alerts &amp; Science</span>
              </button>
            </div>

            {/* Tab 1: Storm Simulation & Risk Overview */}
            {operationsTab === 'storm' && (
              <div className="space-y-4">
                {mode === 'scenario' && (
                  <ScenarioPanel
                    params={scenarioParams}
                    onChange={setScenarioParams}
                    isLoading={isPending}
                  />
                )}

                {mode === 'replay' && (
                  <div className="neuro-card p-5 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center">
                        <History className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="text-sm font-display">Historical Event Replay: September 1, 2025</span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Replaying 72-hour historical extreme monsoon storm series from Open-Meteo ERA5-Land reanalysis archive over Amritsar. Use the timeline scrubber on the left to step through storm hours.
                    </p>
                    <div className="text-[11px] text-purple-700 font-mono bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 inline-block">
                      Event Dataset: 2025-09-01_amritsar.json (Verified)
                    </div>
                  </div>
                )}

                {mode === 'live' && (
                  <div className="neuro-card p-5 space-y-2.5 text-xs">
                    <div className="flex items-center gap-2 font-bold text-slate-800">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center">
                        <Radio className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-display">Operational Live Weather Telemetry</span>
                    </div>
                    <p className="text-slate-600 text-xs leading-relaxed">
                      Active 48-hour numerical weather prediction ensemble (ECMWF IFS 0.25° + NOAA GFS). Fallback to cached snapshot active if upstream times out.
                    </p>
                  </div>
                )}

                {/* Risk Summary Metrics */}
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
                  <div className="p-6 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-500">
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
