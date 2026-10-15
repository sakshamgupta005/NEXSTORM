'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoJsonObject, Feature } from 'geojson'
import type { CellRisk } from '@/lib/risk/types'
import type { HotspotRecord } from '@/lib/city/registry'
import { RISK_COLORS } from './Legend'
import type { WaterloggingObservation } from '@/lib/observations/types'
import { AlertCircle, Building, Droplets, MapPin, Route } from 'lucide-react'

interface RiskMapProps {
  geoJsonData: GeoJsonObject | null
  cells: CellRisk[]
  center?: [number, number]
  zoom?: number
  selectedCellId?: string | null
  onSelectCell?: (cellId: string | null) => void
  activeLayer?: 'risk' | 'susceptibility'
  onLayerChange?: (layer: 'risk' | 'susceptibility') => void
  showHotspots?: boolean
  onToggleHotspots?: (show: boolean) => void
  hotspots?: HotspotRecord[]
  showObservations?: boolean
  onToggleObservations?: (show: boolean) => void
  observations?: WaterloggingObservation[]
  showRoads?: boolean
  onToggleRoads?: (show: boolean) => void
  roadsGeoJson?: GeoJsonObject | null
  showBuildings?: boolean
  onToggleBuildings?: (show: boolean) => void
  buildingsGeoJson?: GeoJsonObject | null
  activeRoute?: {
    coordinates: [number, number][]
    name: string
    mode?: string
  } | null
  onClearRoute?: () => void
}

export function RiskMap({
  geoJsonData,
  cells,
  center = [31.634, 74.872],
  zoom = 12,
  selectedCellId = null,
  onSelectCell,
  activeLayer = 'risk',
  onLayerChange,
  showHotspots = true,
  onToggleHotspots,
  hotspots = [],
  showObservations = true,
  onToggleObservations,
  observations = [],
  showRoads = false,
  onToggleRoads,
  roadsGeoJson = null,
  showBuildings = false,
  onToggleBuildings,
  buildingsGeoJson = null,
  activeRoute = null,
  onClearRoute,
}: RiskMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null)
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null)
  const observationsLayerRef = useRef<L.LayerGroup | null>(null)
  const roadsLayerRef = useRef<L.GeoJSON | null>(null)
  const buildingsLayerRef = useRef<L.GeoJSON | null>(null)
  const routeLayerRef = useRef<L.LayerGroup | null>(null)
  const [tileError, setTileError] = useState(false)

  // Fast cell risk lookup map
  const riskLookup = useRef<Map<string, CellRisk>>(new Map())
  useEffect(() => {
    riskLookup.current.clear()
    for (const c of cells) {
      riskLookup.current.set(c.id, c)
    }
  }, [cells])

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return

    const container = mapContainerRef.current as HTMLDivElement & { _leaflet_id?: number | null }
    if (container._leaflet_id) {
      container._leaflet_id = null
    }

    const mapInstance = L.map(container, {
      center,
      zoom,
      zoomControl: true,
      preferCanvas: false, // Use SVG paths to allow DOM inspection and Playwright tests
    })

    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors | NEXSTORM Prototype',
    })

    tileLayer.on('tileerror', () => {
      setTileError(true)
    })

    tileLayer.addTo(mapInstance)
    setMap(mapInstance)

    return () => {
      mapInstance.remove()
      container._leaflet_id = null
      setMap(null)
      geoJsonLayerRef.current = null
      hotspotsLayerRef.current = null
    }
  }, [center, zoom])

  // Helper function to calculate layer style
  const getFeatureStyle = useCallback(
    (feature: Feature | undefined) => {
      const id = feature?.properties?.id
      const s = feature?.properties?.s ?? 0.5
      const isSelected = Boolean(id && selectedCellId && id === selectedCellId)

      if (activeLayer === 'susceptibility') {
        let fill = RISK_COLORS.low.fill
        let stroke = RISK_COLORS.low.stroke
        if (s > 0.66) {
          fill = RISK_COLORS.high.fill
          stroke = RISK_COLORS.high.stroke
        } else if (s >= 0.33) {
          fill = RISK_COLORS.moderate.fill
          stroke = RISK_COLORS.moderate.stroke
        }

        return {
          fillColor: fill,
          color: isSelected ? '#06b6d4' : stroke,
          weight: isSelected ? 3 : 0.6,
          opacity: isSelected ? 1 : 0.8,
          fillOpacity: isSelected ? 0.85 : 0.62,
        }
      }

      // Default: 'risk' layer
      const cell = id ? riskLookup.current.get(id) : undefined
      const risk = cell?.class || 'low'
      const color = RISK_COLORS[risk]

      return {
        fillColor: color.fill,
        color: isSelected ? '#06b6d4' : color.stroke,
        weight: isSelected ? 3 : 0.6,
        opacity: isSelected ? 1 : 0.8,
        fillOpacity: isSelected ? 0.85 : 0.62,
      }
    },
    [activeLayer, selectedCellId]
  )

  // Render or update GeoJSON layer
  useEffect(() => {
    if (!map || !geoJsonData) return

    // If layer already exists, update style
    if (geoJsonLayerRef.current) {
      geoJsonLayerRef.current.eachLayer((layer: L.Layer) => {
        const pathLayer = layer as L.Path & { feature?: Feature }
        const style = getFeatureStyle(pathLayer.feature)
        pathLayer.setStyle(style)
      })
      return
    }

    // Initial GeoJSON layer creation
    const layer = L.geoJSON(geoJsonData, {
      style: (feature) => getFeatureStyle(feature as Feature),
      onEachFeature: (feature, l) => {
        const id = feature?.properties?.id
        const s = feature?.properties?.s ?? 0.5
        const road = feature?.properties?.nearestRoad

        // Attach click handler for cell selection
        l.on('click', () => {
          if (onSelectCell && id) {
            onSelectCell(id)
          }
        })

        // Tooltip
        l.bindTooltip(
          () => {
            const cell = id ? riskLookup.current.get(id) : undefined
            const risk = cell?.class || 'low'
            return `<div class="p-1 space-y-1">
              <div><strong>Cell:</strong> ${id}</div>
              <div><strong>Susceptibility (s):</strong> ${s}</div>
              <div><strong>Current Risk:</strong> <span class="font-bold text-uppercase">${risk.toUpperCase()}</span></div>
              ${road ? `<div class="text-[11px] text-slate-300"><strong>Road:</strong> ${road}</div>` : ''}
              <div class="text-[10px] text-sky-400 italic">Click to inspect factor contributions</div>
            </div>`
          },
          { sticky: true, className: 'leaflet-custom-tooltip' }
        )
      },
    })

    layer.addTo(map)
    geoJsonLayerRef.current = layer

    // Fit map bounds to generated grid
    try {
      const bounds = layer.getBounds()
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [20, 20] })
      }
    } catch {
      // Fallback
    }
  }, [map, geoJsonData, cells, getFeatureStyle, onSelectCell])

  // Re-fit map bounds when geoJsonData changes (e.g. view switch between city and campus)
  useEffect(() => {
    if (map && geoJsonLayerRef.current) {
      try {
        const bounds = geoJsonLayerRef.current.getBounds()
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [25, 25] })
        }
      } catch {
        // Fallback
      }
    }
  }, [map, geoJsonData])

  // Render or update Hotspots Layer
  useEffect(() => {
    if (!map) return

    // Clean up existing hotspots layer
    if (hotspotsLayerRef.current) {
      hotspotsLayerRef.current.clearLayers()
      map.removeLayer(hotspotsLayerRef.current)
      hotspotsLayerRef.current = null
    }

    if (!showHotspots || !hotspots || hotspots.length === 0) return

    const group = L.layerGroup()

    for (const spot of hotspots) {
      const marker = L.circleMarker([spot.lat, spot.lon], {
        radius: 6.5,
        fillColor: '#a855f7', // Purple-500
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.9,
      })

      marker.bindPopup(
        `<div class="p-2 space-y-1 text-slate-900 text-xs max-w-xs">
          <div class="font-bold text-sm text-purple-900 flex items-center gap-1">
            <span>📍 ${spot.name}</span>
          </div>
          <div><strong>Snapped Cell:</strong> <span class="font-mono">${spot.cellId}</span></div>
          <div><strong>Evidence:</strong> ${spot.evidence} (${spot.precision})</div>
          ${spot.articleDate ? `<div><strong>Date:</strong> ${spot.articleDate}</div>` : ''}
          ${
            spot.sourceUrl
              ? `<div class="pt-1"><a href="${spot.sourceUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 underline font-semibold hover:text-blue-800">Read News Source ↗</a></div>`
              : ''
          }
          <div class="pt-1.5 border-t border-slate-200">
            <button id="btn-select-${spot.cellId}" class="px-2 py-1 bg-purple-600 text-white rounded text-[11px] font-semibold hover:bg-purple-700 w-full text-center cursor-pointer">
              Inspect Cell ${spot.cellId}
            </button>
          </div>
        </div>`
      )

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-select-${spot.cellId}`)
        if (btn) {
          btn.onclick = () => {
            if (onSelectCell) {
              onSelectCell(spot.cellId)
            }
          }
        }
      })

      group.addLayer(marker)
    }

    group.addTo(map)
    hotspotsLayerRef.current = group

    return () => {
      if (hotspotsLayerRef.current && map) {
        map.removeLayer(hotspotsLayerRef.current)
      }
    }
  }, [map, hotspots, showHotspots, onSelectCell])

  // Render or update Community Observations Layer
  useEffect(() => {
    if (!map) return

    if (observationsLayerRef.current) {
      observationsLayerRef.current.clearLayers()
      map.removeLayer(observationsLayerRef.current)
      observationsLayerRef.current = null
    }

    if (!showObservations || !observations || observations.length === 0) return

    const group = L.layerGroup()

    for (const obs of observations) {
      if (obs.lifecycleStatus === 'rejected') continue

      const color =
        obs.lifecycleStatus === 'verified'
          ? '#10b981'
          : obs.lifecycleStatus === 'corroborated'
            ? '#f59e0b'
            : obs.lifecycleStatus === 'expired'
              ? '#64748b'
              : '#0284c7'

      const marker = L.circleMarker([obs.coordinates.lat, obs.coordinates.lng], {
        radius: obs.lifecycleStatus === 'verified' ? 6.5 : 5,
        fillColor: color,
        color: '#ffffff',
        weight: 1.5,
        opacity: 1,
        fillOpacity: 0.9,
      })

      marker.bindPopup(
        `<div class="p-2 space-y-1 text-slate-900 text-xs max-w-xs">
          <div class="font-bold text-sm flex items-center justify-between gap-1">
            <span>💧 ${obs.category.replace(/_/g, ' ')}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold" style="background-color: ${color}20; color: ${color};">
              ${obs.lifecycleStatus}
            </span>
          </div>
          <div><strong>Severity:</strong> ${obs.severity.replace(/_/g, ' ')}</div>
          <div><strong>Observed:</strong> ${new Date(obs.observedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          ${obs.spatialMatch.cellId ? `<div><strong>Cell:</strong> <span class="font-mono">${obs.spatialMatch.cellId}</span></div>` : ''}
          ${obs.corroboration.corroborationCount > 1 ? `<div><strong>Corroboration:</strong> ${obs.corroboration.corroborationCount} reports</div>` : ''}
          ${obs.description ? `<div class="italic text-[11px] text-slate-600">"${obs.description}"</div>` : ''}
          ${
            obs.spatialMatch.cellId
              ? `<div class="pt-1.5 border-t border-slate-200">
                  <button id="btn-obs-cell-${obs.id}" class="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700 w-full text-center cursor-pointer">
                    Inspect Cell ${obs.spatialMatch.cellId}
                  </button>
                </div>`
              : ''
          }
        </div>`
      )

      marker.on('popupopen', () => {
        if (obs.spatialMatch.cellId) {
          const btn = document.getElementById(`btn-obs-cell-${obs.id}`)
          if (btn && onSelectCell) {
            btn.onclick = () => onSelectCell(obs.spatialMatch.cellId)
          }
        }
      })

      group.addLayer(marker)
    }

    group.addTo(map)
    observationsLayerRef.current = group

    return () => {
      if (observationsLayerRef.current && map) {
        map.removeLayer(observationsLayerRef.current)
      }
    }
  }, [map, observations, showObservations, onSelectCell])

  // Render or update Road Network Corridors Layer
  useEffect(() => {
    if (!map) return

    if (roadsLayerRef.current) {
      roadsLayerRef.current.clearLayers()
      map.removeLayer(roadsLayerRef.current)
      roadsLayerRef.current = null
    }

    if (!showRoads || !roadsGeoJson) return

    const layer = L.geoJSON(roadsGeoJson, {
      style: (feature) => {
        const p = feature?.properties || {}
        const isUnderpass = Boolean(p.isUnderpass)
        const riskClass = p.modeledRiskClass || 'low'

        if (isUnderpass) {
          return {
            color: '#c084fc', // purple-400
            weight: 4.5,
            opacity: 0.95,
            dashArray: '4, 4',
          }
        }

        if (riskClass === 'high') {
          return {
            color: '#ef4444', // red-500
            weight: 3.5,
            opacity: 0.9,
          }
        }

        if (riskClass === 'moderate') {
          return {
            color: '#f59e0b', // amber-500
            weight: 2.5,
            opacity: 0.85,
          }
        }

        return {
          color: '#10b981', // emerald-500
          weight: 2,
          opacity: 0.75,
        }
      },
      onEachFeature: (feature, l) => {
        const p = feature?.properties || {}
        const name = p.name || 'Unnamed Corridor'
        const highway = p.highway || 'road'
        const lengthM = Math.round(p.lengthM || 0)
        const isUnderpass = p.isUnderpass
        const isBridge = p.isBridge
        const riskClass = p.modeledRiskClass || 'low'
        const sWeighted = (p.weightedCellSusceptibility ?? 0.5).toFixed(3)
        const sMax = (p.maxCellSusceptibility ?? 0.5).toFixed(3)
        const cellCount = Array.isArray(p.intersectingCells) ? p.intersectingCells.length : 1

        l.bindPopup(
          `<div class="p-2 space-y-1.5 text-slate-900 text-xs max-w-xs">
            <div class="font-bold text-sm flex items-center justify-between gap-1">
              <span>🛣️ ${name}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                riskClass === 'high'
                  ? 'bg-rose-100 text-rose-700'
                  : riskClass === 'moderate'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
              }">
                ${riskClass.toUpperCase()} RISK
              </span>
            </div>
            <div class="text-[11px] text-slate-600 font-mono">
              Class: <strong>${highway}</strong> • Length: <strong>${lengthM} m</strong>
            </div>
            ${
              isUnderpass
                ? `<div class="p-1 rounded bg-purple-100 text-purple-900 font-semibold text-[11px] flex items-center gap-1">
                    ⚠️ Tagged Railway/Road Underpass
                  </div>`
                : ''
            }
            ${
              isBridge
                ? `<div class="p-1 rounded bg-blue-100 text-blue-900 font-semibold text-[11px]">
                    🌉 Bridge / Elevated Structure
                  </div>`
                : ''
            }
            <div class="text-[11px] border-t border-slate-200 pt-1 space-y-0.5">
              <div><strong>Weighted Susceptibility:</strong> ${sWeighted}</div>
              <div><strong>Max Cell Susceptibility:</strong> ${sMax}</div>
              <div><strong>Crossed Grid Cells:</strong> ${cellCount} cell(s)</div>
            </div>
            <div class="text-[9px] text-slate-400 italic pt-1 border-t border-slate-100">
              * Modeled 250m grid intersection. Does not guarantee road clearance.
            </div>
          </div>`
        )
      },
    })

    layer.addTo(map)
    roadsLayerRef.current = layer

    return () => {
      if (roadsLayerRef.current && map) {
        map.removeLayer(roadsLayerRef.current)
      }
    }
  }, [map, roadsGeoJson, showRoads])

  // Render or update Building Footprints Layer (Stage P12)
  useEffect(() => {
    if (!map) return

    if (buildingsLayerRef.current) {
      buildingsLayerRef.current.clearLayers()
      map.removeLayer(buildingsLayerRef.current)
      buildingsLayerRef.current = null
    }

    if (!showBuildings || !buildingsGeoJson) return

    const layer = L.geoJSON(buildingsGeoJson, {
      style: (feature) => {
        const p = feature?.properties || {}
        const expCat = p.exposureCategory || 'minimal'

        if (expCat === 'high_catchment') {
          return {
            fillColor: '#ef4444',
            color: '#b91c1c',
            weight: 1,
            fillOpacity: 0.65,
          }
        }
        if (expCat === 'moderate_catchment') {
          return {
            fillColor: '#f59e0b',
            color: '#d97706',
            weight: 1,
            fillOpacity: 0.65,
          }
        }
        if (expCat === 'unmatched') {
          return {
            fillColor: '#94a3b8',
            color: '#64748b',
            weight: 1,
            fillOpacity: 0.4,
          }
        }
        return {
          fillColor: '#3b82f6',
          color: '#1d4ed8',
          weight: 1,
          fillOpacity: 0.55,
        }
      },
      onEachFeature: (feature, l) => {
        const p = feature?.properties || {}
        const bId = p.buildingId || 'Unknown ID'
        const areaM2 = Math.round(p.area_m2 || p.area_in_meters || 0)
        const conf = p.confidence ? Math.round(p.confidence * 100) : 75
        const cellId = p.cellId || 'UNMATCHED'
        const s = p.susceptibilityScore !== undefined ? Number(p.susceptibilityScore).toFixed(3) : 'N/A'
        const expCat = p.exposureCategory || 'minimal'

        l.bindPopup(
          `<div class="p-2 space-y-1.5 text-slate-900 text-xs max-w-xs">
            <div class="font-bold text-sm flex items-center justify-between gap-1">
              <span>🏢 ${bId}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                expCat === 'high_catchment'
                  ? 'bg-rose-100 text-rose-700'
                  : expCat === 'moderate_catchment'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
              }">
                ${expCat.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <div class="text-[11px] text-slate-600 font-mono">
              Footprint Area: <strong>${areaM2} m²</strong> • Confidence: <strong>${conf}%</strong>
            </div>
            <div class="text-[11px] border-t border-slate-200 pt-1 space-y-0.5">
              <div><strong>Primary Grid Cell:</strong> <span class="font-mono">${cellId}</span></div>
              <div><strong>Cell Susceptibility (s):</strong> ${s}</div>
            </div>
            <div class="text-[9px] text-slate-400 italic pt-1 border-t border-slate-100">
              * Macro-catchment terrain exposure. Does NOT model plinth elevation, foundation, or indoor structural damage.
            </div>
          </div>`
        )
      },
    })

    layer.addTo(map)
    buildingsLayerRef.current = layer

    return () => {
      if (buildingsLayerRef.current && map) {
        map.removeLayer(buildingsLayerRef.current)
      }
    }
  }, [map, buildingsGeoJson, showBuildings])

  // Render Active Route Layer
  useEffect(() => {
    if (!map) return

    if (routeLayerRef.current) {
      routeLayerRef.current.clearLayers()
      map.removeLayer(routeLayerRef.current)
      routeLayerRef.current = null
    }

    if (!activeRoute || !activeRoute.coordinates || activeRoute.coordinates.length < 2) {
      return
    }

    const group = L.layerGroup()
    const latLngs = activeRoute.coordinates.map(([lng, lat]) => [lat, lng] as [number, number])

    const color =
      activeRoute.mode === 'shortest'
        ? '#3b82f6'
        : activeRoute.mode === 'lower_exposure'
          ? '#10b981'
          : '#f59e0b'

    const polyline = L.polyline(latLngs, {
      color,
      weight: 5,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    })

    polyline.bindPopup(
      `<div class="p-2 space-y-1 text-xs text-slate-900 font-sans">
        <div class="font-bold text-sm">${activeRoute.name}</div>
        <div class="text-[11px] text-slate-600">Active Flood-Aware Candidate Route</div>
        <div class="text-[10px] text-slate-400 italic pt-1">* Real road network geometry (OSM)</div>
      </div>`
    )

    group.addLayer(polyline)

    // Start marker (Origin)
    const startPt = latLngs[0]
    const startMarker = L.circleMarker(startPt, {
      radius: 7,
      fillColor: '#10b981',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1,
    }).bindPopup('<div class="p-1 text-xs font-bold text-slate-900">📍 Route Origin</div>')
    group.addLayer(startMarker)

    // End marker (Destination)
    const endPt = latLngs[latLngs.length - 1]
    const endMarker = L.circleMarker(endPt, {
      radius: 7,
      fillColor: '#ef4444',
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1,
    }).bindPopup('<div class="p-1 text-xs font-bold text-slate-900">🏁 Route Destination</div>')
    group.addLayer(endMarker)

    group.addTo(map)
    routeLayerRef.current = group

    // Fit map bounds to show full route with padding
    try {
      map.fitBounds(polyline.getBounds(), { padding: [40, 40], maxZoom: 15 })
    } catch {
      // Non-blocking if bounds are degenerate
    }

    return () => {
      if (routeLayerRef.current && map) {
        map.removeLayer(routeLayerRef.current)
      }
    }
  }, [map, activeRoute])


  return (
    <div className="relative w-full h-[620px] min-h-[500px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shadow-inner">
      {/* Non-blocking tile error notification */}
      {tileError && (
        <div
          role="alert"
          className="absolute top-3 left-14 z-[1000] max-w-md bg-amber-500/90 text-amber-950 text-xs px-3 py-1.5 rounded-md shadow-md backdrop-blur-sm flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Basemap tiles unavailable. Displaying risk grid over neutral canvas.</span>
        </div>
      )}

      {/* Layer Controls Bar overlay on top right of map */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 max-w-[270px]">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl border border-slate-200/90 dark:border-slate-800 p-2 shadow-lg space-y-2 text-xs">
          {/* Layer Mode Switch */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => onLayerChange?.('risk')}
              className={`flex-1 py-1 px-2 rounded-md text-[11px] font-semibold transition-all ${
                activeLayer === 'risk'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Modelled Risk
            </button>
            <button
              type="button"
              onClick={() => onLayerChange?.('susceptibility')}
              className={`flex-1 py-1 px-2 rounded-md text-[11px] font-semibold transition-all ${
                activeLayer === 'susceptibility'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Susceptibility (s)
            </button>
          </div>

          {/* Feature Overlays Toggles */}
          <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-200/70 dark:border-slate-800">
            {hotspots.length > 0 && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium select-none text-[11px] p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <input
                  type="checkbox"
                  checked={showHotspots}
                  onChange={(e) => onToggleHotspots?.(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-purple-600 accent-purple-600"
                />
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-purple-500 shrink-0" />
                  <span>Hotspots ({hotspots.length})</span>
                </span>
              </label>
            )}

            {observations.length > 0 && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium select-none text-[11px] p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <input
                  type="checkbox"
                  checked={showObservations}
                  onChange={(e) => onToggleObservations?.(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-emerald-600 accent-emerald-600"
                />
                <span className="flex items-center gap-1 truncate">
                  <Droplets className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span>Reports ({observations.length})</span>
                </span>
              </label>
            )}

            {onToggleRoads && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium select-none text-[11px] p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <input
                  type="checkbox"
                  checked={showRoads}
                  onChange={(e) => onToggleRoads(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-orange-600 accent-orange-600"
                />
                <span className="flex items-center gap-1 truncate">
                  <Route className="w-3 h-3 text-orange-500 shrink-0" />
                  <span>Corridors</span>
                </span>
              </label>
            )}

            {onToggleBuildings && (
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium select-none text-[11px] p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition">
                <input
                  type="checkbox"
                  checked={showBuildings}
                  onChange={(e) => onToggleBuildings(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-indigo-600 accent-indigo-600"
                />
                <span className="flex items-center gap-1 truncate">
                  <Building className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span>Buildings</span>
                </span>
              </label>
            )}
          </div>
        </div>

        {/* Active Route Banner */}
        {activeRoute && (
          <div className="self-end bg-blue-600/95 text-white backdrop-blur-md rounded-lg px-2.5 py-1 shadow-md flex items-center gap-2 text-xs">
            <span className="font-semibold flex items-center gap-1">
              <Route className="w-3.5 h-3.5 text-blue-200" />
              <span>Route: {activeRoute.name}</span>
            </span>
            {onClearRoute && (
              <button
                type="button"
                onClick={onClearRoute}
                className="text-blue-100 hover:text-white font-bold ml-1 text-sm leading-none"
                title="Clear route"
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Selected Cell Banner */}
        {selectedCellId && (
          <div className="self-end bg-cyan-600/95 text-white backdrop-blur-md rounded-lg px-2.5 py-1 shadow-md flex items-center gap-2 text-xs font-mono">
            <span>Selected: {selectedCellId}</span>
            <button
              type="button"
              onClick={() => onSelectCell?.(null)}
              className="text-cyan-100 hover:text-white font-bold ml-1 text-sm leading-none"
              title="Deselect cell"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Map container */}
      <div
        ref={mapContainerRef}
        data-testid="leaflet-map-container"
        className="w-full h-full"
        style={{ minHeight: '500px' }}
      />
    </div>
  )
}
