'use client'

import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface AreaData {
  key: string
  code: string
  name: string
  areaTag: string
  center: [number, number]
  zoom: number
  sink: [number, number]
  baseScore: number
  risk: string
  riskClass: string
  baseGradient: number
  gradientText: string
  baseElevation: number
  drain: string
  drainClass: string
  flowText: string
  velocity: string
  drainCap: string
  actionStatus: string
  statusMsg: string
  photoUrl?: string
}

interface ProbeUpdateData {
  lat: number
  lng: number
  dynamicScore: number
  dynamicElevation: number
  dynamicGradient: number
  distToSinkMeters: number
  isUserClick: boolean
}

interface BuildingMapCanvasProps {
  activeArea: AreaData
  onProbeUpdate: (data: ProbeUpdateData) => void
}

export function BuildingMapCanvas({ activeArea, onProbeUpdate }: BuildingMapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const probeMarkerRef = useRef<L.Marker | null>(null)
  const sinkMarkerRef = useRef<L.Marker | null>(null)
  const polylineRef = useRef<L.Polyline | null>(null)

  const initialCenter = useRef(activeArea.center)
  const initialZoom = useRef(activeArea.zoom)

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return
    const container = containerRef.current as HTMLDivElement & { _leaflet_id?: number | null }
    if (container._leaflet_id) {
      container._leaflet_id = null
    }

    const map = L.map(container, {
      center: initialCenter.current,
      zoom: initialZoom.current,
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

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      container._leaflet_id = null
    }
  }, [])

  // Create custom icons
  const createGoogleMapsPinIcon = (label: string = 'DRAG OR CLICK') => {
    return L.divIcon({
      className: 'custom-gmaps-pin',
      html: `
        <div class="gmaps-pin-container pin-drop-anim" title="Click or drag around the area">
          <div class="gmaps-pin-label">${label}</div>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44" class="gmaps-pin-svg">
            <path fill="#EA4335" d="M16 0C7.16 0 0 7.16 0 16c0 11.2 14.25 26.68 15.35 27.86.36.39.94.39 1.3 0C17.75 42.68 32 27.2 32 16 32 7.16 24.84 0 16 0z"/>
            <circle fill="#ffffff" cx="16" cy="16" r="6.2"/>
            <circle fill="#B31412" cx="16" cy="16" r="3.4"/>
          </svg>
          <div class="gmaps-pin-shadow"></div>
        </div>
      `,
      iconSize: [32, 44],
      iconAnchor: [16, 44],
    })
  }

  const createSinkIcon = (label: string = 'CATCHMENT SINK') => {
    return L.divIcon({
      className: 'custom-leaflet-sink',
      html: `
        <div class="sink-marker-wrapper">
          <div class="sink-floating-tag">${label}</div>
          <div class="sink-core-badge">💧</div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })
  }

  const activeAreaRef = useRef(activeArea)
  const onProbeUpdateRef = useRef(onProbeUpdate)

  useEffect(() => {
    activeAreaRef.current = activeArea
    onProbeUpdateRef.current = onProbeUpdate
  }, [activeArea, onProbeUpdate])

  // Update probe and vectors
  const updateProbeAndVectors = React.useCallback(
    (latlng: L.LatLng, isUserClick: boolean) => {
      const map = mapRef.current
      const currentArea = activeAreaRef.current
      if (!map || !currentArea) return

      const lat = latlng.lat
      const lng = latlng.lng

      // 1. Probe marker
      if (probeMarkerRef.current) {
        probeMarkerRef.current.setLatLng([lat, lng])
      } else {
        probeMarkerRef.current = L.marker([lat, lng], {
          icon: createGoogleMapsPinIcon('DRAG OR CLICK'),
          draggable: true,
          zIndexOffset: 1000,
        }).addTo(map)

        probeMarkerRef.current.on('drag', (e: any) => {
          updateProbeAndVectors(e.latlng, true)
        })
      }

      // 2. Sink marker
      if (sinkMarkerRef.current) {
        sinkMarkerRef.current.setLatLng(currentArea.sink)
      } else {
        sinkMarkerRef.current = L.marker(currentArea.sink, {
          icon: createSinkIcon('CATCHMENT SINK'),
          zIndexOffset: 900,
        }).addTo(map)
      }

      // 3. Polyline flow vector
      const flowPoints: [number, number][] = [
        [lat, lng],
        [(lat + currentArea.sink[0]) / 2 + 0.0001, (lng + currentArea.sink[1]) / 2 - 0.0001],
        currentArea.sink,
      ]

      const polyColor =
        currentArea.baseScore > 70
          ? '#e11d48'
          : currentArea.baseScore > 40
          ? '#d97706'
          : '#059669'

      if (polylineRef.current) {
        polylineRef.current.setLatLngs(flowPoints)
        polylineRef.current.setStyle({ color: polyColor })
      } else {
        polylineRef.current = L.polyline(flowPoints, {
          color: polyColor,
          weight: 5,
          opacity: 0.95,
          dashArray: '8, 6',
          className: 'runoff-polyline-anim',
        }).addTo(map)
      }

      // 4. Calculate spatial stats
      const distToSinkMeters = map.distance([lat, lng], currentArea.sink)
      const elevVariation = (distToSinkMeters / 120) * 0.7
      const dynamicElevation = parseFloat((currentArea.baseElevation + elevVariation).toFixed(1))
      const dynamicGradient = parseFloat(
        (currentArea.baseGradient - (distToSinkMeters < 80 ? 0.4 : 0)).toFixed(1)
      )

      let dynamicScore = currentArea.baseScore
      if (isUserClick) {
        const proximityFactor = Math.max(0, 1 - distToSinkMeters / 250)
        dynamicScore = Math.min(
          96,
          Math.max(14, Math.round(currentArea.baseScore * 0.8 + proximityFactor * 25))
        )
      }

      onProbeUpdateRef.current({
        lat,
        lng,
        dynamicScore,
        dynamicElevation,
        dynamicGradient,
        distToSinkMeters: Math.round(distToSinkMeters),
        isUserClick,
      })
    },
    []
  )

  // Handle activeArea changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    map.setView(activeArea.center, activeArea.zoom, { animate: true, duration: 0.5 })

    // Clean up previous markers for fresh placement
    if (probeMarkerRef.current) {
      map.removeLayer(probeMarkerRef.current)
      probeMarkerRef.current = null
    }
    if (sinkMarkerRef.current) {
      map.removeLayer(sinkMarkerRef.current)
      sinkMarkerRef.current = null
    }
    if (polylineRef.current) {
      map.removeLayer(polylineRef.current)
      polylineRef.current = null
    }

    const timer = setTimeout(() => {
      updateProbeAndVectors(L.latLng(activeArea.center[0], activeArea.center[1]), false)
    }, 200)

    return () => clearTimeout(timer)
  }, [activeArea, updateProbeAndVectors])

  // Attach map click listener
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      updateProbeAndVectors(e.latlng, true)
    }

    map.on('click', handleMapClick)
    return () => {
      map.off('click', handleMapClick)
    }
  }, [updateProbeAndVectors])

  return (
    <div
      ref={containerRef}
      id="buildingRealMap"
      className="real-map-canvas w-full h-[520px] rounded-2xl overflow-hidden"
    />
  )
}
