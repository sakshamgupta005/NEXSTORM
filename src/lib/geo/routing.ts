import {
  Coordinates,
  IRoutingProvider,
  RouteOptions,
  RouteResult,
  TravelMode,
} from './types';
import { calculateDistance, formatDistance, isValidCoordinates } from './math';

const MODE_SPEED_MPS: Record<TravelMode, number> = {
  driving: 13.89, // ~50 km/h
  cycling: 4.17, // ~15 km/h
  walking: 1.25, // ~4.5 km/h
};

const MODE_DETOUR_FACTOR: Record<TravelMode, number> = {
  driving: 1.3,
  cycling: 1.2,
  walking: 1.15,
};

/**
 * Deterministic Mock Routing Provider for offline development, local demos, and tests.
 */
export class MockRoutingProvider implements IRoutingProvider {
  readonly name = 'mock-routing';
  readonly supportedModes: TravelMode[] = ['driving', 'walking', 'cycling'];

  async calculateRoute(
    origin: Coordinates,
    destination: Coordinates,
    options?: RouteOptions
  ): Promise<RouteResult> {
    if (!isValidCoordinates(origin) || !isValidCoordinates(destination)) {
      throw new Error('Invalid coordinates supplied to calculateRoute');
    }

    const mode = options?.mode || 'driving';
    if (!this.supportedModes.includes(mode)) {
      throw new Error(`Travel mode "${mode}" is not supported by ${this.name}`);
    }

    const straightDist = calculateDistance(origin, destination);
    const detourFactor = MODE_DETOUR_FACTOR[mode] || 1.25;
    const distanceMeters = Math.round(straightDist * detourFactor);
    const speed = MODE_SPEED_MPS[mode] || 10;
    const durationSeconds = Math.round(distanceMeters / speed);

    // Generate 5 interpolated intermediate coordinates for realistic map polylines
    const waypointsCount = 6;
    const coordinates: Coordinates[] = [];

    for (let i = 0; i <= waypointsCount; i++) {
      const t = i / waypointsCount;
      // Add slight perpendicular arc offset so the path curves pleasantly
      const arcOffset = Math.sin(t * Math.PI) * 0.002;
      coordinates.push({
        lat: origin.lat + (destination.lat - origin.lat) * t + arcOffset,
        lng: origin.lng + (destination.lng - origin.lng) * t + arcOffset * 0.5,
      });
    }

    return {
      mode,
      distanceMeters,
      durationSeconds,
      coordinates,
      summary: `Route via Simulated Corridor (${formatDistance(distanceMeters)})`,
      steps: [
        {
          instruction: `Depart towards destination via primary roadway`,
          distanceMeters: Math.round(distanceMeters * 0.4),
          durationSeconds: Math.round(durationSeconds * 0.4),
        },
        {
          instruction: `Continue along transit corridor`,
          distanceMeters: Math.round(distanceMeters * 0.5),
          durationSeconds: Math.round(durationSeconds * 0.5),
        },
        {
          instruction: `Arrive at destination`,
          distanceMeters: Math.round(distanceMeters * 0.1),
          durationSeconds: Math.round(durationSeconds * 0.1),
        },
      ],
    };
  }
}

/**
 * Open Source Routing Machine (OSRM) HTTP Provider.
 * Integrates with OSRM demo or self-hosted router backend.
 */
export class OSRMRoutingProvider implements IRoutingProvider {
  readonly name = 'osrm-routing';
  readonly supportedModes: TravelMode[] = ['driving', 'walking', 'cycling'];
  private baseUrl: string;
  private fallback: MockRoutingProvider;

  constructor(options?: { baseUrl?: string }) {
    this.baseUrl = options?.baseUrl || 'https://router.project-osrm.org';
    this.fallback = new MockRoutingProvider();
  }

  async calculateRoute(
    origin: Coordinates,
    destination: Coordinates,
    options?: RouteOptions
  ): Promise<RouteResult> {
    if (!isValidCoordinates(origin) || !isValidCoordinates(destination)) {
      throw new Error('Invalid coordinates supplied to calculateRoute');
    }

    const mode = options?.mode || 'driving';
    if (!this.supportedModes.includes(mode)) {
      throw new Error(`Travel mode "${mode}" is not supported by ${this.name}`);
    }

    const profile = mode === 'driving' ? 'car' : mode === 'cycling' ? 'bike' : 'foot';
    // OSRM expects coordinates in lng,lat order
    const url = `${this.baseUrl}/route/v1/${profile}/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return this.fallback.calculateRoute(origin, destination, options);
      }

      const data = await response.json();
      if (!data.routes || data.routes.length === 0) {
        return this.fallback.calculateRoute(origin, destination, options);
      }

      const route = data.routes[0];
      const geoCoords: [number, number][] = route.geometry?.coordinates || [];

      return {
        mode,
        distanceMeters: Math.round(route.distance),
        durationSeconds: Math.round(route.duration),
        coordinates: geoCoords.map(([lng, lat]) => ({ lat, lng })),
        summary: route.legs?.[0]?.summary || `Route via OSRM (${formatDistance(route.distance)})`,
        steps: route.legs?.[0]?.steps?.map((step: Record<string, unknown>) => ({
          instruction: String(step.name || 'Continue'),
          distanceMeters: Math.round(Number(step.distance || 0)),
          durationSeconds: Math.round(Number(step.duration || 0)),
        })),
      };
    } catch {
      return this.fallback.calculateRoute(origin, destination, options);
    }
  }
}

export const sharedRoutingProvider = new MockRoutingProvider();
