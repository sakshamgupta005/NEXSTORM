'use client'

import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { GeoJsonObject, Feature } from 'geojson'
import type { CellRisk } from '@/lib/risk/types'
import { RISK_COLORS } from './Legend'
import { AlertCircle } from 'lucide-react'

interface RiskMapProps {
  geoJsonData: GeoJsonObject | null
  cells: CellRisk[]
  center?: [number, number]
  zoom?: number
}

export function RiskMap({
  geoJsonData,
  cells,
  center = [31.634, 74.872],
  zoom = 12,
}: RiskMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null)
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
      preferCanvas: false, // Use SVG paths to allow DOM path inspection
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
    }
  }, [center, zoom])

  // Render or update GeoJSON layer
  useEffect(() => {
    if (!map || !geoJsonData) return

    // If layer already exists, simply update style for high performance
    if (geoJsonLayerRef.current) {
      geoJsonLayerRef.current.eachLayer((layer: L.Layer) => {
        const pathLayer = layer as L.Path & { feature?: Feature }
        const id = pathLayer.feature?.properties?.id
        const cell = id ? riskLookup.current.get(id) : undefined
        const risk = cell?.class || 'low'
        const color = RISK_COLORS[risk]
        pathLayer.setStyle({
          fillColor: color.fill,
          color: color.stroke,
          weight: 0.6,
          fillOpacity: 0.62,
        })
      })
      return
    }

    // Initial GeoJSON layer creation
    const layer = L.geoJSON(geoJsonData, {
      style: (feature) => {
        const id = feature?.properties?.id
        const cell = riskLookup.current.get(id)
        const risk = cell?.class || 'low'
        const color = RISK_COLORS[risk]
        return {
          fillColor: color.fill,
          color: color.stroke,
          weight: 0.6,
          opacity: 0.8,
          fillOpacity: 0.62,
        }
      },
      onEachFeature: (feature, l) => {
        const id = feature?.properties?.id
        const cell = riskLookup.current.get(id)
        const s = feature?.properties?.s ?? 0.5
        const risk = cell?.class || 'low'
        l.bindTooltip(
          `<strong>Cell:</strong> ${id}<br/><strong>Susceptibility (s):</strong> ${s}<br/><strong>Risk:</strong> ${risk.toUpperCase()}`,
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
      // Fallback to center
    }
  }, [map, geoJsonData, cells])

  return (
    <div className="relative w-full h-[600px] min-h-[500px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 shadow-inner">
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
