'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Coordinates, MapMarker } from '@/lib/geo/types';
import { isValidCoordinates, calculateBoundingBox, formatCoordinates } from '@/lib/geo/math';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Minus, RotateCcw, MapPin, X, Navigation } from 'lucide-react';

export interface InteractiveMapProps {
  center?: Coordinates;
  zoom?: number; // 1 (world) to 18 (street level), default 12
  markers?: MapMarker[];
  routeCoordinates?: Coordinates[];
  selectedLocation?: Coordinates | null;
  onSelectLocation?: (coords: Coordinates) => void;
  onMarkerClick?: (marker: MapMarker) => void;
  className?: string;
  height?: number | string;
  tileProviderUrl?: string;
  showControls?: boolean;
  showTileOverlay?: boolean;
  isLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
}

// Convert standard lat/lng to Web Mercator projection normalized [0..1]
function latLngToMercator(coords: Coordinates): { x: number; y: number } {
  const x = (coords.lng + 180) / 360;
  const sinLat = Math.sin((coords.lat * Math.PI) / 180);
  const clampedSin = Math.max(-0.9999, Math.min(0.9999, sinLat));
  const y = 0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI);
  return { x, y };
}

// Convert normalized Web Mercator back to lat/lng
function mercatorToLatLng(x: number, y: number): Coordinates {
  const lng = x * 360 - 180;
  const n = Math.PI - 2 * Math.PI * y;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return {
    lat: Math.max(-85.0511, Math.min(85.0511, lat)),
    lng: Math.max(-180, Math.min(180, lng)),
  };
}

export function InteractiveMap({
  center = { lat: 37.7749, lng: -122.4194 },
  zoom: initialZoom = 12,
  markers = [],
  routeCoordinates = [],
  selectedLocation,
  onSelectLocation,
  onMarkerClick,
  className = '',
  height = 400,
  showControls = true,
  isLoading = false,
  error = null,
  emptyMessage = 'No locations marked on map',
}: InteractiveMapProps) {
  const [currentZoom, setCurrentZoom] = useState(initialZoom);
  const [mapCenter, setMapCenter] = useState<Coordinates>(center);
  const [activePopup, setActivePopup] = useState<MapMarker | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 600, height: 400 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const containerCallbackRef = useCallback((node: HTMLDivElement | null) => {
    mapContainerRef.current = node;
    if (node) {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 || rect.height > 0) {
        setDimensions({ width: rect.width || 600, height: rect.height || 400 });
      }
    }
  }, []);

  // Clamp zoom between 2 and 18
  const handleZoomIn = () => setCurrentZoom((z) => Math.min(18, z + 1));
  const handleZoomOut = () => setCurrentZoom((z) => Math.max(2, z - 1));

  // Reset to initial center & zoom
  const handleResetView = () => {
    if (markers.length > 0) {
      const validPoints = markers.map((m) => m.position).filter(isValidCoordinates);
      if (validPoints.length > 0) {
        try {
          const bbox = calculateBoundingBox(validPoints);
          setMapCenter({
            lat: (bbox.minLat + bbox.maxLat) / 2,
            lng: (bbox.minLng + bbox.maxLng) / 2,
          });
          setCurrentZoom(11);
          return;
        } catch {
          // Fall back to props center
        }
      }
    }
    setMapCenter(center);
    setCurrentZoom(initialZoom);
  };

  // Convert coordinate to container pixel coordinate relative to container center
  const projectToPixels = useCallback(
    (coords: Coordinates, width: number, heightPx: number) => {
      const centerMercator = latLngToMercator(mapCenter);
      const pointMercator = latLngToMercator(coords);

      const scale = 256 * Math.pow(2, currentZoom);
      const dx = (pointMercator.x - centerMercator.x) * scale;
      const dy = (pointMercator.y - centerMercator.y) * scale;

      return {
        px: width / 2 + dx,
        py: heightPx / 2 + dy,
      };
    },
    [mapCenter, currentZoom]
  );

  // Handle map click to select a coordinate
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSelectLocation || !mapContainerRef.current) return;
    const rect = mapContainerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scale = 256 * Math.pow(2, currentZoom);
    const centerMercator = latLngToMercator(mapCenter);

    const mercX = centerMercator.x + (clickX - rect.width / 2) / scale;
    const mercY = centerMercator.y + (clickY - rect.height / 2) / scale;

    const coords = mercatorToLatLng(mercX, mercY);
    onSelectLocation(coords);
  };

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-foreground ${className}`}
        style={{ height }}
        role="alert"
        aria-live="polite"
      >
        <p className="font-semibold text-destructive">Failed to load map</p>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={handleResetView}>
          Retry
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`relative overflow-hidden rounded-xl border border-border ${className}`} style={{ height }}>
        <Skeleton className="h-full w-full" />
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-xs">
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Initializing map view...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerCallbackRef}
      className={`relative select-none overflow-hidden rounded-xl border border-border bg-neutral-900/90 text-foreground transition-all ${className}`}
      style={{ height }}
      onClick={handleMapClick}
      data-testid="interactive-map"
      role="region"
      aria-label="Interactive map view"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === '+') handleZoomIn();
        if (e.key === '-') handleZoomOut();
      }}
    >
      {/* Background Geo Grid / Tile Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#map-grid)" />
        </svg>
      </div>

      {/* SVG Vector Layer for Route Polylines */}
      {routeCoordinates.length > 1 && (
        <svg className="absolute inset-0 pointer-events-none h-full w-full">
          {(() => {
            const points = routeCoordinates
              .filter(isValidCoordinates)
              .map((c) => {
                const p = projectToPixels(c, dimensions.width, dimensions.height);
                return `${p.px.toFixed(1)},${p.py.toFixed(1)}`;
              })
              .join(' ');

            return (
              <polyline
                points={points}
                fill="none"
                stroke="oklch(0.627 0.265 303.9)"
                strokeWidth="4"
                strokeDasharray="6 4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          })()}
        </svg>
      )}

      {/* Markers Layer */}
      <div className="absolute inset-0 pointer-events-none">
        {markers.map((marker) => {
          if (!isValidCoordinates(marker.position)) return null;
          const { px, py } = projectToPixels(marker.position, dimensions.width, dimensions.height);

          // Hide markers far off viewport
          if (px < -100 || px > dimensions.width + 100 || py < -100 || py > dimensions.height + 100) {
            return null;
          }

          const pinColor = marker.color || 'oklch(0.627 0.265 303.9)';

          return (
            <div
              key={marker.id}
              className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-full cursor-pointer transition-transform hover:scale-125 focus:scale-125 focus:outline-hidden"
              style={{ left: px, top: py }}
              onClick={(e) => {
                e.stopPropagation();
                setActivePopup(marker);
                onMarkerClick?.(marker);
              }}
              role="button"
              tabIndex={0}
              aria-label={`Marker: ${marker.title || marker.id}`}
              data-testid={`map-marker-${marker.id}`}
            >
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full shadow-lg ring-2 ring-white/80"
                style={{ backgroundColor: pinColor }}
              >
                <MapPin className="h-4 w-4 text-white" />
              </div>
            </div>
          );
        })}

        {/* Selected Location Pin */}
        {selectedLocation && isValidCoordinates(selectedLocation) && (() => {
          const { px, py } = projectToPixels(selectedLocation, dimensions.width, dimensions.height);
          return (
            <div
              className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
              style={{ left: px, top: py }}
              data-testid="selected-location-pin"
            >
              <div className="relative flex items-center justify-center">
                <div className="h-4 w-4 rounded-full bg-emerald-500 ring-4 ring-emerald-500/30 animate-pulse" />
                <div className="absolute h-8 w-8 rounded-full border border-emerald-400 opacity-75 animate-ping" />
              </div>
            </div>
          );
        })()}
      </div>

      {/* Active Marker Popup Card */}
      {activePopup && (
        <div
          className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-xs z-20 rounded-lg border border-border bg-card p-3 shadow-xl backdrop-blur-md"
          role="dialog"
          aria-label={activePopup.title || 'Marker information'}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-foreground">{activePopup.title || 'Selected Marker'}</h4>
              {activePopup.description && (
                <p className="mt-1 text-xs text-muted-foreground">{activePopup.description}</p>
              )}
              <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/80">
                {formatCoordinates(activePopup.position)}
              </p>
            </div>
            <button
              onClick={() => setActivePopup(null)}
              className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close popup"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Map Interactive Controls */}
      {showControls && (
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-md border border-border/80 bg-background/90 p-1 shadow-md backdrop-blur-xs">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleZoomIn();
            }}
            disabled={currentZoom >= 18}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Zoom in"
            data-testid="zoom-in-button"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <div className="h-px bg-border" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleZoomOut();
            }}
            disabled={currentZoom <= 2}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-foreground hover:bg-muted disabled:opacity-40"
            aria-label="Zoom out"
            data-testid="zoom-out-button"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <div className="h-px bg-border" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleResetView();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-foreground hover:bg-muted"
            aria-label="Reset view"
            data-testid="reset-view-button"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Informational overlay badge */}
      <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground backdrop-blur-xs border border-border/50">
        <Navigation className="h-2.5 w-2.5 text-primary" />
        <span>Zoom: {currentZoom}x</span>
        <span>•</span>
        <span>{formatCoordinates(mapCenter, 2)}</span>
      </div>

      {/* Empty State Banner when no markers */}
      {markers.length === 0 && !selectedLocation && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="rounded-full bg-background/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur-xs">
            {emptyMessage}
          </p>
        </div>
      )}
    </div>
  );
}
