'use client'

import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type RouteType = 'safe' | 'hazardous'

interface RoadMapCanvasProps {
  activeRoute: RouteType
  focusHazardTrigger?: number
}

export const ROUTE_ORIGIN: [number, number] = [31.634, 74.8655]
export const ROUTE_DESTINATION: [number, number] = [31.7095, 74.7972]
export const UNDERPASS_SUMP_POINT: [number, number] = [31.6285, 74.861]

export const ROUTE_A_COORDS: [number, number][] = [
  [31.634, 74.8655],
  [31.649, 74.872],
  [31.668, 74.865],
  [31.688, 74.835],
  [31.702, 74.81],
  [31.7095, 74.7972],
]

export const ROUTE_B_COORDS: [number, number][] = [
  [31.634, 74.8655],
  [31.6285, 74.861],
  [31.642, 74.842],
  [31.67, 74.821],
  [31.7095, 74.7972],
]

export function RoadMapCanvas({ activeRoute, focusHazardTrigger }: RoadMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const polylineARef = useRef<L.Polyline | null>(null)
  const polylineBRef = useRef<L.Polyline | null>(null)
  const hazardMarkerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number | null }
    if (container._leaflet_id) {
      container._leaflet_id = null
    }

    const map = L.map(container, {
      center: [31.665, 74.83],
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      preferCanvas: true,
    })

    // OpenStreetMap clean standard tiles (reliable, no API key watermark)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map)

    L.control.zoom({ position: 'topright' }).addTo(map)

    // Origin Pin
    L.marker(ROUTE_ORIGIN, {
      icon: L.divIcon({
        className: 'custom-hub-pin',
        html: `<div class="route-hub-badge">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    })
      .bindPopup('<b>Trip Origin:</b> Amritsar Junction Railway Station (ASR)')
      .addTo(map)

    // Destination Pin
    L.marker(ROUTE_DESTINATION, {
      icon: L.divIcon({
        className: 'custom-dest-pin',
        html: `<div class="route-dest-badge">🏁</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    })
      .bindPopup('<b>Destination:</b> Sri Guru Ram Dass Jee International Airport (ATQ)')
      .addTo(map)

    // Hazard Pin (Rego Bridge Underpass)
    const hazardMarker = L.marker(UNDERPASS_SUMP_POINT, {
      icon: L.divIcon({
        className: 'custom-hazard-pin',
        html: `<div class="route-hazard-badge">⚠️</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    })
      .bindPopup(
        '<b>UNDERPASS CHOKEPOINT:</b> Rego Bridge Railway Underpass Sump (Historical Waterlogging Hotspot)'
      )
      .addTo(map)
    hazardMarkerRef.current = hazardMarker

    // Polylines
    const polylineA = L.polyline(ROUTE_A_COORDS, {
      color: '#059669',
      weight: 6,
      opacity: 0.95,
    }).addTo(map)
    polylineARef.current = polylineA

    const polylineB = L.polyline(ROUTE_B_COORDS, {
      color: '#cbd5e1',
      weight: 3.5,
      opacity: 0.6,
    }).addTo(map)
    polylineBRef.current = polylineB

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      container._leaflet_id = null
    }
  }, [])

  // Update route visual styles and bounds when activeRoute changes
  useEffect(() => {
    const map = mapRef.current
    const polyA = polylineARef.current
    const polyB = polylineBRef.current
    if (!map || !polyA || !polyB) return

    if (activeRoute === 'safe') {
      polyA.setStyle({ color: '#059669', weight: 6, opacity: 1 })
      polyB.setStyle({ color: '#cbd5e1', weight: 3, opacity: 0.45 })
      map.flyToBounds(polyA.getBounds(), { padding: [50, 50], duration: 0.6 })
    } else {
      polyA.setStyle({ color: '#cbd5e1', weight: 3, opacity: 0.45 })
      polyB.setStyle({ color: '#be123c', weight: 6, opacity: 1 })
      map.flyToBounds(polyB.getBounds(), { padding: [50, 50], duration: 0.5 })
      setTimeout(() => {
        if (hazardMarkerRef.current) hazardMarkerRef.current.openPopup()
      }, 350)
    }
  }, [activeRoute])

  // Focus hazard triggered by corridor list click
  useEffect(() => {
    if (!focusHazardTrigger) return
    const map = mapRef.current
    if (!map) return

    map.flyTo(UNDERPASS_SUMP_POINT, 14, { duration: 0.5 })
    setTimeout(() => {
      if (hazardMarkerRef.current) hazardMarkerRef.current.openPopup()
    }, 400)
  }, [focusHazardTrigger])

  return (
    <div
      ref={containerRef}
      id="roadRealMap"
      className="real-map-canvas w-full h-[520px] rounded-2xl overflow-hidden"
    />
  )
}
