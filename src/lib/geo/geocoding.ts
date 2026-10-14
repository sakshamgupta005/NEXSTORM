import { Coordinates, GeocodingResult, IGeocodingProvider } from './types';
import { calculateDistance, isValidCoordinates } from './math';

export const MOCK_GEOCODING_DATABASE: Array<{
  keywords: string[];
  result: GeocodingResult;
}> = [
  {
    keywords: ['san francisco', 'sf', 'golden gate'],
    result: {
      displayName: 'San Francisco, California, United States',
      coordinates: { lat: 37.7749, lng: -122.4194 },
      boundingBox: { minLat: 37.708, maxLat: 37.812, minLng: -122.518, maxLng: -122.355 },
      addressComponents: {
        city: 'San Francisco',
        state: 'California',
        country: 'United States',
        postcode: '94103',
      },
      confidence: 0.98,
    },
  },
  {
    keywords: ['london', 'westminster', 'big ben'],
    result: {
      displayName: 'London, Greater London, England, United Kingdom',
      coordinates: { lat: 51.5074, lng: -0.1278 },
      boundingBox: { minLat: 51.286, maxLat: 51.692, minLng: -0.51, maxLng: 0.334 },
      addressComponents: {
        city: 'London',
        state: 'England',
        country: 'United Kingdom',
        postcode: 'SW1A 1AA',
      },
      confidence: 0.97,
    },
  },
  {
    keywords: ['tokyo', 'shibuya', 'shinjuku'],
    result: {
      displayName: 'Tokyo, Japan',
      coordinates: { lat: 35.6762, lng: 139.6503 },
      boundingBox: { minLat: 35.5, maxLat: 35.8, minLng: 139.5, maxLng: 139.9 },
      addressComponents: {
        city: 'Tokyo',
        country: 'Japan',
        postcode: '100-0001',
      },
      confidence: 0.96,
    },
  },
  {
    keywords: ['new york', 'nyc', 'manhattan'],
    result: {
      displayName: 'New York, NY, United States',
      coordinates: { lat: 40.7128, lng: -74.006 },
      boundingBox: { minLat: 40.477, maxLat: 40.917, minLng: -74.259, maxLng: -73.7 },
      addressComponents: {
        city: 'New York',
        state: 'New York',
        country: 'United States',
        postcode: '10001',
      },
      confidence: 0.99,
    },
  },
  {
    keywords: ['berlin', 'brandenburg gate'],
    result: {
      displayName: 'Berlin, Germany',
      coordinates: { lat: 52.52, lng: 13.405 },
      boundingBox: { minLat: 52.34, maxLat: 52.68, minLng: 13.09, maxLng: 13.76 },
      addressComponents: {
        city: 'Berlin',
        country: 'Germany',
        postcode: '10115',
      },
      confidence: 0.95,
    },
  },
  {
    keywords: ['bengaluru', 'bangalore', 'koramangala'],
    result: {
      displayName: 'Bengaluru, Karnataka, India',
      coordinates: { lat: 12.9716, lng: 77.5946 },
      boundingBox: { minLat: 12.8, maxLat: 13.15, minLng: 77.4, maxLng: 77.8 },
      addressComponents: {
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        postcode: '560001',
      },
      confidence: 0.94,
    },
  },
];

/**
 * Deterministic Mock Geocoding Provider for local development and offline automated testing.
 */
export class MockGeocodingProvider implements IGeocodingProvider {
  readonly name = 'mock-geocoding';

  async geocode(
    query: string,
    options?: { limit?: number; countryCode?: string }
  ): Promise<GeocodingResult[]> {
    if (!query || typeof query !== 'string' || query.trim() === '') {
      return [];
    }

    const cleanQuery = query.toLowerCase().trim();
    const limit = options?.limit ?? 5;

    const matches = MOCK_GEOCODING_DATABASE.filter((entry) =>
      entry.keywords.some((kw) => cleanQuery.includes(kw) || kw.includes(cleanQuery))
    ).map((entry) => entry.result);

    if (matches.length > 0) {
      return matches.slice(0, limit);
    }

    // Fallback: If query contains numeric coordinates like "37.77, -122.41", parse them
    const coordMatch = cleanQuery.match(/^(-?\d+(\.\d+)?),\s*(-?\d+(\.\d+)?)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[3]);
      if (isValidCoordinates({ lat, lng })) {
        return [
          {
            displayName: `Location at ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
            coordinates: { lat, lng },
            confidence: 1.0,
          },
        ];
      }
    }

    // Default synthetic result for arbitrary query so offline prototypes function smoothly
    return [
      {
        displayName: `${query.trim()}, Simulated Region`,
        coordinates: { lat: 37.7749, lng: -122.4194 },
        confidence: 0.5,
      },
    ];
  }

  async reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult | null> {
    if (!isValidCoordinates(coordinates)) {
      return null;
    }

    // Find closest match within 50km
    let closest: GeocodingResult | null = null;
    let minDistance = 50_000; // 50km

    for (const entry of MOCK_GEOCODING_DATABASE) {
      const dist = calculateDistance(coordinates, entry.result.coordinates);
      if (dist < minDistance) {
        minDistance = dist;
        closest = {
          ...entry.result,
          displayName: `Near ${entry.result.displayName}`,
          confidence: Math.max(0.4, 1 - dist / 50_000),
        };
      }
    }

    if (closest) {
      return closest;
    }

    return {
      displayName: `Coordinate Point (${coordinates.lat.toFixed(4)}°, ${coordinates.lng.toFixed(4)}°)`,
      coordinates,
      confidence: 0.7,
    };
  }
}

/**
 * OpenStreetMap Nominatim Geocoding Provider.
 * Free, open geocoding adhering to OSM Usage Policies.
 */
export class NominatimGeocodingProvider implements IGeocodingProvider {
  readonly name = 'osm-nominatim';
  private baseUrl: string;
  private userAgent: string;

  constructor(options?: { baseUrl?: string; userAgent?: string }) {
    this.baseUrl = options?.baseUrl || 'https://nominatim.openstreetmap.org';
    this.userAgent = options?.userAgent || 'HackathonStarterApp/1.0';
  }

  async geocode(
    query: string,
    options?: { limit?: number; countryCode?: string }
  ): Promise<GeocodingResult[]> {
    if (!query || query.trim() === '') return [];

    try {
      const params = new URLSearchParams({
        q: query.trim(),
        format: 'jsonv2',
        addressdetails: '1',
        limit: String(options?.limit ?? 5),
      });

      if (options?.countryCode) {
        params.append('countrycodes', options.countryCode.toLowerCase());
      }

      const response = await fetch(`${this.baseUrl}/search?${params.toString()}`, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) return [];

      const raw = await response.json();
      if (!Array.isArray(raw)) return [];

      return raw.map((item: Record<string, unknown>) => {
        const lat = parseFloat(String(item.lat));
        const lng = parseFloat(String(item.lon));
        const address = (item.address as Record<string, string>) || {};

        return {
          displayName: String(item.display_name || query),
          coordinates: { lat, lng },
          addressComponents: {
            road: address.road,
            city: address.city || address.town || address.village,
            state: address.state,
            country: address.country,
            postcode: address.postcode,
          },
          confidence: typeof item.importance === 'number' ? item.importance : 0.8,
        };
      });
    } catch {
      return [];
    }
  }

  async reverseGeocode(coordinates: Coordinates): Promise<GeocodingResult | null> {
    if (!isValidCoordinates(coordinates)) return null;

    try {
      const params = new URLSearchParams({
        lat: String(coordinates.lat),
        lon: String(coordinates.lng),
        format: 'jsonv2',
        addressdetails: '1',
      });

      const response = await fetch(`${this.baseUrl}/reverse?${params.toString()}`, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) return null;

      const item = await response.json();
      if (!item || item.error) return null;

      const address = (item.address as Record<string, string>) || {};

      return {
        displayName: String(item.display_name || `${coordinates.lat}, ${coordinates.lng}`),
        coordinates,
        addressComponents: {
          road: address.road,
          city: address.city || address.town || address.village,
          state: address.state,
          country: address.country,
          postcode: address.postcode,
        },
        confidence: 0.9,
      };
    } catch {
      return null;
    }
  }
}

export const sharedGeocodingProvider = new MockGeocodingProvider();
