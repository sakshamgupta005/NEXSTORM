import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isValidCoordinates,
  calculateDistance,
  calculateBearing,
  destinationPoint,
  calculateBoundingBox,
  isPointInBoundingBox,
  formatDistance,
  formatDuration,
  formatCoordinates,
  isGeolocationSupported,
  requestGeolocation,
  MockGeocodingProvider,
  NominatimGeocodingProvider,
  MockRoutingProvider,
  OSRMRoutingProvider,
  MockNearbySearchProvider,
  OverpassNearbySearchProvider,
  TravelMode,
} from '@/lib/geo';

describe('Geospatial Math & Validation Toolkit', () => {
  it('validates coordinates according to WGS84 standard ranges', () => {
    expect(isValidCoordinates({ lat: 37.7749, lng: -122.4194 })).toBe(true);
    expect(isValidCoordinates({ lat: 0, lng: 0 })).toBe(true);
    expect(isValidCoordinates({ lat: 90, lng: 180 })).toBe(true);
    expect(isValidCoordinates({ lat: -90, lng: -180 })).toBe(true);

    // Invalid ranges
    expect(isValidCoordinates({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidCoordinates({ lat: -95, lng: 10 })).toBe(false);
    expect(isValidCoordinates({ lat: 0, lng: 181 })).toBe(false);
    expect(isValidCoordinates({ lat: 0, lng: -185 })).toBe(false);

    // Non-finite and malformed
    expect(isValidCoordinates({ lat: NaN, lng: 0 })).toBe(false);
    expect(isValidCoordinates({ lat: Infinity, lng: 0 })).toBe(false);
    expect(isValidCoordinates(null)).toBe(false);
    expect(isValidCoordinates(undefined)).toBe(false);
    expect(isValidCoordinates('37.77, -122.41')).toBe(false);
  });

  it('accurately calculates Haversine straight-line distances in meters and kilometers', () => {
    const sf = { lat: 37.7749, lng: -122.4194 };
    const nyc = { lat: 40.7128, lng: -74.006 };

    // Known approximate great-circle distance SF to NYC is ~4,130 km (+/- 50km)
    const distMeters = calculateDistance(sf, nyc, 'meters');
    const distKm = calculateDistance(sf, nyc, 'kilometers');
    const distMiles = calculateDistance(sf, nyc, 'miles');

    expect(distKm).toBeGreaterThan(4100);
    expect(distKm).toBeLessThan(4200);
    expect(distMeters).toBeCloseTo(distKm * 1000, -2);
    expect(distMiles).toBeCloseTo(distKm * 0.621371, 0);

    // Distance to self is 0
    expect(calculateDistance(sf, sf)).toBe(0);
  });

  it('calculates initial compass bearing between two points', () => {
    const origin = { lat: 0, lng: 0 };
    const directlyNorth = { lat: 10, lng: 0 };
    const directlyEast = { lat: 0, lng: 10 };

    expect(calculateBearing(origin, directlyNorth)).toBeCloseTo(0, 0);
    expect(calculateBearing(origin, directlyEast)).toBeCloseTo(90, 0);
  });

  it('computes destination coordinate given distance and bearing', () => {
    const origin = { lat: 0, lng: 0 };
    // 111.19 km (~1 degree latitude) directly north
    const dest = destinationPoint(origin, 111_195, 0);
    expect(dest.lat).toBeCloseTo(1, 0);
    expect(dest.lng).toBeCloseTo(0, 0);
  });

  it('computes bounding box and checks point enclosure', () => {
    const points = [
      { lat: 10, lng: 20 },
      { lat: 15, lng: 25 },
      { lat: 12, lng: 22 },
    ];

    const bbox = calculateBoundingBox(points);
    expect(bbox.minLat).toBe(10);
    expect(bbox.maxLat).toBe(15);
    expect(bbox.minLng).toBe(20);
    expect(bbox.maxLng).toBe(25);

    expect(isPointInBoundingBox({ lat: 12, lng: 22 }, bbox)).toBe(true);
    expect(isPointInBoundingBox({ lat: 9, lng: 22 }, bbox)).toBe(false);
    expect(isPointInBoundingBox({ lat: 12, lng: 26 }, bbox)).toBe(false);
  });

  it('formats distance, duration, and coordinates cleanly', () => {
    expect(formatDistance(450)).toBe('450 m');
    expect(formatDistance(12_400)).toBe('12.4 km');
    expect(formatDistance(-5)).toBe('0 m');

    expect(formatDuration(45)).toBe('1 min');
    expect(formatDuration(1800)).toBe('30 min');
    expect(formatDuration(5400)).toBe('1 hr 30 min');

    expect(formatCoordinates({ lat: 37.7749, lng: -122.4194 })).toBe('37.7749°, -122.4194°');
    expect(formatCoordinates({ lat: NaN, lng: 0 })).toBe('Invalid coordinates');
  });
});

describe('Browser Geolocation Adapter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects geolocation capability in browser environment', () => {
    expect(typeof isGeolocationSupported()).toBe('boolean');
  });

  it('resolves coordinates successfully when browser grants permission', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 37.7749,
            longitude: -122.4194,
            accuracy: 15,
            altitude: null,
            heading: null,
            speed: null,
          },
          timestamp: 1700000000,
        });
      }),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };

    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

    const result = await requestGeolocation();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.coordinates.lat).toBe(37.7749);
      expect(result.data.coordinates.lng).toBe(-122.4194);
      expect(result.data.accuracyMeters).toBe(15);
    }
  });

  it('normalizes PERMISSION_DENIED error when user declines consent', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((_, error) => {
        error({ code: 1, message: 'User denied Geolocation' });
      }),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };

    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

    const result = await requestGeolocation();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('PERMISSION_DENIED');
      expect(result.error.message).toContain('denied');
    }
  });

  it('normalizes TIMEOUT error when position fix times out', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((_, error) => {
        error({ code: 3, message: 'Timeout expired' });
      }),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    };

    vi.stubGlobal('navigator', { geolocation: mockGeolocation });

    const result = await requestGeolocation({ timeoutMs: 5000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('TIMEOUT');
      expect(result.error.message).toContain('timed out');
    }
  });
});

describe('Geocoding & Reverse Geocoding Providers', () => {
  it('MockGeocodingProvider matches known cities deterministically', async () => {
    const provider = new MockGeocodingProvider();

    // Forward geocode
    const results = await provider.geocode('San Francisco');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].coordinates.lat).toBeCloseTo(37.7749, 2);
    expect(results[0].coordinates.lng).toBeCloseTo(-122.4194, 2);
    expect(results[0].addressComponents?.city).toBe('San Francisco');

    // Empty query returns empty array
    expect(await provider.geocode('')).toEqual([]);
    expect(await provider.geocode('   ')).toEqual([]);

    // Reverse geocode
    const reverse = await provider.reverseGeocode({ lat: 51.5074, lng: -0.1278 });
    expect(reverse).not.toBeNull();
    expect(reverse?.displayName).toContain('London');
  });

  it('NominatimGeocodingProvider handles network errors gracefully without crashing', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network offline'));
    const provider = new NominatimGeocodingProvider({ baseUrl: 'http://invalid-nominatim.local' });

    // Should return empty array or null without throwing
    const results = await provider.geocode('Paris');
    expect(Array.isArray(results)).toBe(true);

    const rev = await provider.reverseGeocode({ lat: 48.8566, lng: 2.3522 });
    expect(rev).toBeNull();
  });
});

describe('Routing Providers & Travel Modes', () => {
  it('MockRoutingProvider calculates routes with realistic distance, duration, steps, and polyline', async () => {
    const provider = new MockRoutingProvider();
    const origin = { lat: 37.7749, lng: -122.4194 };
    const destination = { lat: 37.8044, lng: -122.2712 }; // SF to Oakland

    // Driving mode
    const drivingRoute = await provider.calculateRoute(origin, destination, { mode: 'driving' });
    expect(drivingRoute.mode).toBe('driving');
    expect(drivingRoute.distanceMeters).toBeGreaterThan(0);
    expect(drivingRoute.durationSeconds).toBeGreaterThan(0);
    expect(drivingRoute.coordinates.length).toBeGreaterThanOrEqual(5);
    expect(drivingRoute.steps?.length).toBeGreaterThan(0);

    // Walking mode (same distance, longer duration)
    const walkingRoute = await provider.calculateRoute(origin, destination, { mode: 'walking' });
    expect(walkingRoute.mode).toBe('walking');
    expect(walkingRoute.durationSeconds).toBeGreaterThan(drivingRoute.durationSeconds);

    // Cycling mode
    const cyclingRoute = await provider.calculateRoute(origin, destination, { mode: 'cycling' });
    expect(cyclingRoute.mode).toBe('cycling');
    expect(cyclingRoute.durationSeconds).toBeLessThan(walkingRoute.durationSeconds);
    expect(cyclingRoute.durationSeconds).toBeGreaterThan(drivingRoute.durationSeconds);
  });

  it('rejects invalid coordinates or unsupported travel modes with descriptive errors', async () => {
    const provider = new MockRoutingProvider();
    const origin = { lat: 37.7749, lng: -122.4194 };
    const destination = { lat: 37.8044, lng: -122.2712 };

    await expect(
      provider.calculateRoute({ lat: 999, lng: 0 }, destination)
    ).rejects.toThrow('Invalid coordinates');

    await expect(
      provider.calculateRoute(origin, destination, { mode: 'flight' as unknown as TravelMode })
    ).rejects.toThrow('is not supported');
  });

  it('OSRMRoutingProvider falls back gracefully when router is unavailable', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('OSRM offline'));
    const osrm = new OSRMRoutingProvider({ baseUrl: 'http://invalid-osrm-host.local' });
    const origin = { lat: 37.7749, lng: -122.4194 };
    const destination = { lat: 37.8044, lng: -122.2712 };

    const route = await osrm.calculateRoute(origin, destination);
    expect(route).toBeDefined();
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.coordinates.length).toBeGreaterThan(0);
  });
});

describe('Nearby Search Providers', () => {
  it('MockNearbySearchProvider discovers categorized POIs within radius sorted by distance', async () => {
    const provider = new MockNearbySearchProvider();
    const center = { lat: 37.7749, lng: -122.4194 };

    // Search all places within 5km
    const places = await provider.searchNearby({
      center,
      radiusMeters: 5000,
      limit: 5,
    });

    expect(places.length).toBe(5);
    expect(places[0].distanceMeters).toBeDefined();
    // Sorted ascending by proximity
    for (let i = 1; i < places.length; i++) {
      expect(places[i].distanceMeters!).toBeGreaterThanOrEqual(places[i - 1].distanceMeters!);
    }

    // Filter by category
    const cafes = await provider.searchNearby({
      center,
      radiusMeters: 5000,
      category: 'cafe',
    });
    expect(cafes.length).toBe(2);
    expect(cafes.every((c) => c.category === 'cafe')).toBe(true);
  });

  it('OverpassNearbySearchProvider falls back gracefully on network failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Overpass offline'));
    const overpass = new OverpassNearbySearchProvider({ endpoint: 'http://invalid-overpass.local' });
    const center = { lat: 37.7749, lng: -122.4194 };

    const places = await overpass.searchNearby({ center, radiusMeters: 2000 });
    expect(Array.isArray(places)).toBe(true);
    expect(places.length).toBeGreaterThan(0);
  });
});
