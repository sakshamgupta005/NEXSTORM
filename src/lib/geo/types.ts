/**
 * Reusable Maps, Geolocation & Routing Toolkit Types
 * 
 * Inspired by Leaflet, Turf.js, OSRM, and MapLibre GL JS patterns.
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface MapMarker {
  id: string;
  position: Coordinates;
  title?: string;
  description?: string;
  icon?: string;
  color?: string;
  data?: Record<string, unknown>;
}

export interface GeolocationResult {
  coordinates: Coordinates;
  accuracyMeters?: number;
  altitudeMeters?: number | null;
  headingDegrees?: number | null;
  speedMps?: number | null;
  timestamp: number;
}

export type GeolocationErrorCode =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED';

export interface GeolocationError {
  code: GeolocationErrorCode;
  message: string;
}

export interface GeocodingResult {
  displayName: string;
  coordinates: Coordinates;
  boundingBox?: BoundingBox;
  addressComponents?: {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  confidence?: number;
}

export interface IGeocodingProvider {
  readonly name: string;
  geocode(
    query: string,
    options?: { limit?: number; countryCode?: string }
  ): Promise<GeocodingResult[]>;
  reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult | null>;
}

export type TravelMode = 'driving' | 'walking' | 'cycling';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteResult {
  mode: TravelMode;
  distanceMeters: number;
  durationSeconds: number;
  coordinates: Coordinates[];
  steps?: RouteStep[];
  summary?: string;
}

export interface RouteOptions {
  mode?: TravelMode;
  alternatives?: boolean;
}

export interface IRoutingProvider {
  readonly name: string;
  supportedModes: TravelMode[];
  calculateRoute(
    origin: Coordinates,
    destination: Coordinates,
    options?: RouteOptions
  ): Promise<RouteResult>;
}

export interface NearbyPlace {
  id: string;
  name: string;
  coordinates: Coordinates;
  category?: string;
  distanceMeters?: number;
  address?: string;
  tags?: Record<string, string>;
}

export interface NearbySearchOptions {
  center: Coordinates;
  radiusMeters: number;
  category?: string;
  limit?: number;
}

export interface INearbySearchProvider {
  readonly name: string;
  searchNearby(options: NearbySearchOptions): Promise<NearbyPlace[]>;
}
