'use client'

import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type RouteType = 'safe' | 'hazardous'

export interface RouteOptionData {
  name: string
  distance: string
  time: string
  score: number
  label: string
  flowNote: string
  coords: [number, number][]
}

export interface TripExample {
  id: string
  label: string
  originName: string
  originCoords: [number, number]
  destName: string
  destCoords: [number, number]
  hazardPoint: [number, number]
  hazardName: string
  hazardDesc: string
  routeA: RouteOptionData
  routeB: RouteOptionData
}

export const TRIP_EXAMPLES: Record<string, TripExample> = {
  'asr-airport': {
    id: 'asr-airport',
    label: 'ASR Junction → Airport (ATQ)',
    originName: 'Amritsar Junction Railway Station (ASR)',
    originCoords: [31.634, 74.8655],
    destName: 'Sri Guru Ram Dass Jee International Airport (ATQ)',
    destCoords: [31.7095, 74.7972],
    hazardPoint: [31.6285, 74.861],
    hazardName: 'Rego Bridge Railway Underpass Sump',
    hazardDesc: 'Historical severe water accumulation basin (topographic depression)',
    routeA: {
      name: 'Route A: Amritsar Bypass Elevated Flyover',
      distance: '15.6 km',
      time: '~31 mins (30 km/h baseline)',
      score: 14,
      label: 'Lower Modeled Exposure',
      flowNote:
        'Traverses elevated bypass alignment (+1.2% gradient), avoiding the low-lying topographic depression at Rego Bridge.',
      coords: [
        [31.634, 74.8655],
        [31.649, 74.872],
        [31.668, 74.865],
        [31.688, 74.835],
        [31.702, 74.81],
        [31.7095, 74.7972],
      ],
    },
    routeB: {
      name: 'Route B: GT Road via Rego Bridge Sump',
      distance: '11.2 km',
      time: '~22 mins (+ unmodeled flood delay)',
      score: 88,
      label: 'High Inundation Risk',
      flowNote:
        'Submerged underpass basin (-2.8% gradient); chronic monsoon waterlogging with severe/impassable water accumulation reported.',
      coords: [
        [31.634, 74.8655],
        [31.6285, 74.861],
        [31.642, 74.842],
        [31.67, 74.821],
        [31.7095, 74.7972],
      ],
    },
  },
  'golden-temple-gndu': {
    id: 'golden-temple-gndu',
    label: 'Golden Temple → GNDU University',
    originName: 'Golden Temple Heritage Plaza (Katra Ahluwalia)',
    originCoords: [31.62, 74.8765],
    destName: 'Guru Nanak Dev University (GNDU Campus Gate)',
    destCoords: [31.6375, 74.825],
    hazardPoint: [31.631, 74.843],
    hazardName: 'Putlighar GT Road Culvert Sump',
    hazardDesc: 'Railway embankment drainage chokepoint with chronic backflow',
    routeA: {
      name: 'Route A: Via Kitchlu Chowk & Cantt Elevated Road',
      distance: '8.4 km',
      time: '~19 mins (30 km/h baseline)',
      score: 22,
      label: 'Lower Modeled Exposure',
      flowNote:
        'Traverses well-drained cantonment arterial (+0.8% gradient) with unconstricted roadside swales.',
      coords: [
        [31.62, 74.8765],
        [31.632, 74.868],
        [31.645, 74.858],
        [31.642, 74.838],
        [31.6375, 74.825],
      ],
    },
    routeB: {
      name: 'Route B: Direct GT Road through Putlighar Sump',
      distance: '6.8 km',
      time: '~16 mins (+ severe street pooling)',
      score: 78,
      label: 'High Inundation Risk',
      flowNote:
        'Direct road funnels through low-lying Putlighar market railway bottleneck with severe curb overflowing.',
      coords: [
        [31.62, 74.8765],
        [31.626, 74.859],
        [31.631, 74.843],
        [31.634, 74.832],
        [31.6375, 74.825],
      ],
    },
  },
  'isbt-verka': {
    id: 'isbt-verka',
    label: 'ISBT Bus Stand → Batala Rd / Verka',
    originName: 'Amritsar Inter-State Bus Terminal (ISBT)',
    originCoords: [31.626, 74.885],
    destName: 'Verka Industrial Junction & Batala Road',
    destCoords: [31.678, 74.912],
    hazardPoint: [31.649, 74.898],
    hazardName: 'SSSS Chowk & Batala Road Underpass Sump',
    hazardDesc: 'Natural topographic sump capturing northern walled city sheetflow',
    routeA: {
      name: 'Route A: Outer Ring Road & Majitha Bypass Corridor',
      distance: '9.8 km',
      time: '~21 mins (30 km/h baseline)',
      score: 18,
      label: 'Lower Modeled Exposure',
      flowNote:
        'Elevated outer ring highway contour with active open canal drainage culverts.',
      coords: [
        [31.626, 74.885],
        [31.641, 74.915],
        [31.662, 74.922],
        [31.678, 74.912],
      ],
    },
    routeB: {
      name: 'Route B: Direct Batala Road via SSSS Chowk Sump',
      distance: '7.2 km',
      time: '~17 mins (+ unmodeled flood delay)',
      score: 84,
      label: 'High Inundation Risk',
      flowNote:
        'Low-elevation depression receiving excessive street runoff; historical inundation up to 45cm.',
      coords: [
        [31.626, 74.885],
        [31.638, 74.891],
        [31.649, 74.898],
        [31.664, 74.906],
        [31.678, 74.912],
      ],
    },
  },
}

interface RoadMapCanvasProps {
  activeTrip: TripExample
  activeRoute: RouteType
  focusHazardTrigger?: number
}

export function RoadMapCanvas({ activeTrip, activeRoute, focusHazardTrigger }: RoadMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const originMarkerRef = useRef<L.Marker | null>(null)
  const destMarkerRef = useRef<L.Marker | null>(null)
  const hazardMarkerRef = useRef<L.Marker | null>(null)
  const polylineARef = useRef<L.Polyline | null>(null)
  const polylineBRef = useRef<L.Polyline | null>(null)

  const initialCenter = useRef(activeTrip.originCoords)

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number | null }
    if (container._leaflet_id) {
      container._leaflet_id = null
    }

    const map = L.map(container, {
      center: initialCenter.current,
      zoom: 12,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
      preferCanvas: true,
    })

    // OpenStreetMap clean standard tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    }).addTo(map)

    L.control.zoom({ position: 'topright' }).addTo(map)
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      container._leaflet_id = null
    }
  }, [])

  // Sync Trip markers and polylines when activeTrip changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Clean up existing markers & lines
    if (originMarkerRef.current) map.removeLayer(originMarkerRef.current)
    if (destMarkerRef.current) map.removeLayer(destMarkerRef.current)
    if (hazardMarkerRef.current) map.removeLayer(hazardMarkerRef.current)
    if (polylineARef.current) map.removeLayer(polylineARef.current)
    if (polylineBRef.current) map.removeLayer(polylineBRef.current)

    // Origin Pin
    originMarkerRef.current = L.marker(activeTrip.originCoords, {
      icon: L.divIcon({
        className: 'custom-hub-pin',
        html: `<div class="route-hub-badge">📍</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    })
      .bindPopup(`<b>Trip Origin:</b> ${activeTrip.originName}`)
      .addTo(map)

    // Destination Pin
    destMarkerRef.current = L.marker(activeTrip.destCoords, {
      icon: L.divIcon({
        className: 'custom-dest-pin',
        html: `<div class="route-dest-badge">🏁</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    })
      .bindPopup(`<b>Destination:</b> ${activeTrip.destName}`)
      .addTo(map)

    // Hazard Chokepoint Pin
    hazardMarkerRef.current = L.marker(activeTrip.hazardPoint, {
      icon: L.divIcon({
        className: 'custom-hazard-pin',
        html: `<div class="route-hazard-badge">⚠️</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
    })
      .bindPopup(`<b>CRITICAL CHOKEPOINT:</b> ${activeTrip.hazardName}<br/><span style="font-size:10px;color:#64748b;">${activeTrip.hazardDesc}</span>`)
      .addTo(map)

    // Polylines A (Safe) & B (Hazardous)
    const isSafe = activeRoute === 'safe'
    polylineARef.current = L.polyline(activeTrip.routeA.coords, {
      color: isSafe ? '#059669' : '#cbd5e1',
      weight: isSafe ? 6 : 3,
      opacity: isSafe ? 1 : 0.45,
      className: isSafe ? 'runoff-polyline-anim' : undefined,
    }).addTo(map)

    polylineBRef.current = L.polyline(activeTrip.routeB.coords, {
      color: !isSafe ? '#be123c' : '#cbd5e1',
      weight: !isSafe ? 6 : 3,
      opacity: !isSafe ? 1 : 0.45,
      className: !isSafe ? 'runoff-polyline-anim' : undefined,
    }).addTo(map)

    const targetPoly = isSafe ? polylineARef.current : polylineBRef.current
    if (targetPoly) {
      map.flyToBounds(targetPoly.getBounds(), { padding: [50, 50], duration: 0.6 })
    }
  }, [activeTrip, activeRoute])

  // Focus hazard triggered by corridor list click
  useEffect(() => {
    if (!focusHazardTrigger) return
    const map = mapRef.current
    if (!map) return

    map.flyTo(activeTrip.hazardPoint, 14, { duration: 0.5 })
    setTimeout(() => {
      if (hazardMarkerRef.current) hazardMarkerRef.current.openPopup()
    }, 400)
  }, [focusHazardTrigger, activeTrip])

  return (
    <div
      ref={containerRef}
      id="roadRealMap"
      className="real-map-canvas w-full h-[520px] rounded-2xl overflow-hidden"
    />
  )
}
