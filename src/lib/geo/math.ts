import { Coordinates, BoundingBox } from './types';

const EARTH_RADIUS_METERS = 6371008.8; // Mean Earth radius in WGS84

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Validates whether latitude and longitude are valid numbers within standard WGS84 bounds.
 */
export function isValidCoordinates(coords: unknown): coords is Coordinates {
  if (!coords || typeof coords !== 'object') return false;
  const c = coords as Partial<Coordinates>;

  if (typeof c.lat !== 'number' || typeof c.lng !== 'number') return false;
  if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return false;

  return c.lat >= -90 && c.lat <= 90 && c.lng >= -180 && c.lng <= 180;
}

/**
 * Calculates straight-line great-circle distance between two coordinates using the Haversine formula.
 * Inspired by Turf.js turf-distance implementation.
 */
export function calculateDistance(
  from: Coordinates,
  to: Coordinates,
  unit: 'meters' | 'kilometers' | 'miles' = 'meters'
): number {
  if (!isValidCoordinates(from) || !isValidCoordinates(to)) {
    throw new Error('Invalid coordinates supplied to calculateDistance');
  }

  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const meters = EARTH_RADIUS_METERS * c;

  if (unit === 'kilometers') return meters / 1000;
  if (unit === 'miles') return meters / 1609.344;
  return meters;
}

/**
 * Calculates initial compass bearing (azimuth) from origin to destination in degrees (0..360).
 */
export function calculateBearing(from: Coordinates, to: Coordinates): number {
  if (!isValidCoordinates(from) || !isValidCoordinates(to)) {
    throw new Error('Invalid coordinates supplied to calculateBearing');
  }

  const phi1 = toRadians(from.lat);
  const phi2 = toRadians(to.lat);
  const deltaLambda = toRadians(to.lng - from.lng);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const theta = Math.atan2(y, x);
  return (toDegrees(theta) + 360) % 360;
}

/**
 * Calculates the destination coordinate given a starting point, distance in meters, and bearing in degrees.
 */
export function destinationPoint(
  origin: Coordinates,
  distanceMeters: number,
  bearingDegrees: number
): Coordinates {
  if (!isValidCoordinates(origin)) {
    throw new Error('Invalid origin coordinates supplied to destinationPoint');
  }

  const angularDist = distanceMeters / EARTH_RADIUS_METERS;
  const bearingRad = toRadians(bearingDegrees);
  const lat1 = toRadians(origin.lat);
  const lng1 = toRadians(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDist) +
      Math.cos(lat1) * Math.sin(angularDist) * Math.cos(bearingRad)
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDist) * Math.cos(lat1),
      Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: toDegrees(lat2),
    lng: ((toDegrees(lng2) + 540) % 360) - 180, // Normalizes longitude to [-180, 180]
  };
}

/**
 * Computes the minimum bounding box enclosing a collection of coordinates.
 */
export function calculateBoundingBox(points: Coordinates[]): BoundingBox {
  if (!points || points.length === 0) {
    throw new Error('calculateBoundingBox requires at least one coordinate');
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const pt of points) {
    if (!isValidCoordinates(pt)) continue;
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }

  if (!Number.isFinite(minLat)) {
    throw new Error('No valid coordinates found to compute bounding box');
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Checks if a point lies within a bounding box.
 */
export function isPointInBoundingBox(point: Coordinates, box: BoundingBox): boolean {
  if (!isValidCoordinates(point)) return false;
  return (
    point.lat >= box.minLat &&
    point.lat <= box.maxLat &&
    point.lng >= box.minLng &&
    point.lng <= box.maxLng
  );
}

/**
 * Formats coordinates for clean, human-readable display.
 */
export function formatCoordinates(coords: Coordinates, precision = 4): string {
  if (!isValidCoordinates(coords)) return 'Invalid coordinates';
  return `${coords.lat.toFixed(precision)}°, ${coords.lng.toFixed(precision)}°`;
}

/**
 * Formats distance with appropriate units (meters vs kilometers).
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '0 m';
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Formats duration in seconds into human-readable minutes and hours.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0 min';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours} hr ${remainingMins} min` : `${hours} hr`;
}
