'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoJsonObject, Feature } from 'geojson'
import type { CellRisk } from '@/lib/risk/types'
import type { HotspotRecord } from '@/lib/city/registry'
import { RISK_COLORS } from './Legend'
import { AlertCircle, Layers, MapPin } from 'lucide-react'

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
}: RiskMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null)
  const hotspotsLayerRef = useRef<L.LayerGroup | null>(null)
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
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-lg border border-slate-200/90 dark:border-slate-700/90 p-1.5 shadow-md flex items-center gap-1.5 text-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1.5 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-500" />
            <span>Layer</span>
          </span>

          <button
            type="button"
            onClick={() => onLayerChange?.('risk')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              activeLayer === 'risk'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Modelled Risk
          </button>

          <button
            type="button"
            onClick={() => onLayerChange?.('susceptibility')}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
              activeLayer === 'susceptibility'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Topographic Susceptibility (s)
          </button>
        </div>

        {/* Hotspots Toggle */}
        {hotspots.length > 0 && (
          <div className="self-end bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-lg border border-slate-200/90 dark:border-slate-700/90 px-2.5 py-1.5 shadow-md flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 dark:text-slate-300 font-medium select-none">
              <input
                type="checkbox"
                checked={showHotspots}
                onChange={(e) => onToggleHotspots?.(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-purple-600 accent-purple-600"
              />
              <span className="flex items-center gap-1 text-[11px]">
                <MapPin className="w-3.5 h-3.5 text-purple-500" />
                <span>Verified Hotspots ({hotspots.length})</span>
              </span>
            </label>
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
