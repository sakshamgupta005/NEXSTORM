'use client';

import React, { useState } from 'react';
import { Coordinates } from '@/lib/geo/types';
import { formatCoordinates } from '@/lib/geo/math';
import { requestGeolocation } from '@/lib/geo/geolocation';
import { sharedGeocodingProvider } from '@/lib/geo/geocoding';
import { InteractiveMap } from './interactive-map';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, Search, Crosshair, AlertCircle } from 'lucide-react';

export interface LocationPickerProps {
  initialLocation?: Coordinates;
  onLocationSelect?: (coords: Coordinates, address?: string) => void;
  label?: string;
  className?: string;
}

export function LocationPicker({
  initialLocation = { lat: 37.7749, lng: -122.4194 },
  onLocationSelect,
  label = 'Select Location',
  className = '',
}: LocationPickerProps) {
  const [selectedCoords, setSelectedCoords] = useState<Coordinates>(initialLocation);
  const [address, setAddress] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const handleMapSelect = async (coords: Coordinates) => {
    setSelectedCoords(coords);
    setGeoError(null);
    try {
      const rev = await sharedGeocodingProvider.reverseGeocode(coords);
      if (rev) {
        setAddress(rev.displayName);
        onLocationSelect?.(coords, rev.displayName);
      } else {
        onLocationSelect?.(coords);
      }
    } catch {
      onLocationSelect?.(coords);
    }
  };

  const handleUseMyLocation = async () => {
    setIsLocating(true);
    setGeoError(null);
    try {
      const res = await requestGeolocation({ timeoutMs: 8000 });
      if (res.success) {
        setSelectedCoords(res.data.coordinates);
        await handleMapSelect(res.data.coordinates);
      } else {
        setGeoError(res.error.message);
      }
    } catch {
      setGeoError('Unable to acquire current location.');
    } finally {
      setIsLocating(false);
    }
  };

  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setGeoError(null);
    try {
      const results = await sharedGeocodingProvider.geocode(searchQuery, { limit: 1 });
      if (results.length > 0) {
        const found = results[0];
        setSelectedCoords(found.coordinates);
        setAddress(found.displayName);
        onLocationSelect?.(found.coordinates, found.displayName);
      } else {
        setGeoError(`No results found for "${searchQuery}"`);
      }
    } catch {
      setGeoError('Geocoding service error.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className={`space-y-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xs ${className}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          {label}
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          className="h-8 gap-1 text-xs"
          data-testid="use-my-location-button"
        >
          <Crosshair className={`h-3.5 w-3.5 ${isLocating ? 'animate-spin' : ''}`} />
          {isLocating ? 'Locating...' : 'Use My Location'}
        </Button>
      </div>

      {/* Address Search Form */}
      <form onSubmit={handleSearchAddress} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search address or city..."
            className="pl-8 text-sm"
            data-testid="location-search-input"
          />
        </div>
        <Button type="submit" size="sm" disabled={isSearching || !searchQuery.trim()}>
          {isSearching ? 'Searching...' : 'Search'}
        </Button>
      </form>

      {/* Error alert */}
      {geoError && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{geoError}</span>
        </div>
      )}

      {/* Map Preview */}
      <InteractiveMap
        center={selectedCoords}
        selectedLocation={selectedCoords}
        onSelectLocation={handleMapSelect}
        height={220}
        emptyMessage="Click map to set pin location"
      />

      {/* Selected Location Details */}
      <div className="rounded-lg bg-muted/50 p-2.5 text-xs">
        <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
          <span>Coordinates:</span>
          <span className="font-semibold text-foreground">{formatCoordinates(selectedCoords)}</span>
        </div>
        {address && (
          <p className="mt-1 line-clamp-2 text-muted-foreground">
            <span className="font-semibold text-foreground">Address: </span>
            {address}
          </p>
        )}
      </div>
    </div>
  );
}
