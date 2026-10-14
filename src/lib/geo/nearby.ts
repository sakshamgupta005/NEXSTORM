import {
  Coordinates,
  INearbySearchProvider,
  NearbyPlace,
  NearbySearchOptions,
} from './types';
import { calculateDistance, destinationPoint, isValidCoordinates } from './math';

export const STANDARD_CATEGORIES = [
  'restaurant',
  'cafe',
  'hospital',
  'pharmacy',
  'park',
  'school',
  'transit_station',
  'grocery',
] as const;

/**
 * Deterministic Mock Nearby Search Provider.
 * Generates plausible, categorized local amenities around any center coordinate.
 */
export class MockNearbySearchProvider implements INearbySearchProvider {
  readonly name = 'mock-nearby';

  async searchNearby(options: NearbySearchOptions): Promise<NearbyPlace[]> {
    if (!isValidCoordinates(options.center)) {
      throw new Error('Invalid center coordinates supplied to searchNearby');
    }

    const radius = Math.max(100, Math.min(options.radiusMeters || 5000, 50_000));
    const limit = options.limit ?? 10;
    const requestedCategory = options.category?.toLowerCase();

    const sampleTemplates = [
      { name: 'Metro Central Station', category: 'transit_station', bearing: 45, distRatio: 0.25 },
      { name: 'City General Hospital', category: 'hospital', bearing: 120, distRatio: 0.4 },
      { name: 'Greenleaf Public Park', category: 'park', bearing: 210, distRatio: 0.3 },
      { name: 'Sunrise Bakery & Cafe', category: 'cafe', bearing: 300, distRatio: 0.15 },
      { name: 'Artisan Bistro', category: 'restaurant', bearing: 85, distRatio: 0.5 },
      { name: 'Corner Care Pharmacy', category: 'pharmacy', bearing: 160, distRatio: 0.35 },
      { name: 'Fresh Mart Grocery', category: 'grocery', bearing: 240, distRatio: 0.6 },
      { name: 'Oakridge Community School', category: 'school', bearing: 330, distRatio: 0.7 },
      { name: 'Espresso Lounge', category: 'cafe', bearing: 15, distRatio: 0.45 },
      { name: 'Downtown Trattoria', category: 'restaurant', bearing: 195, distRatio: 0.8 },
    ];

    const results: NearbyPlace[] = [];

    for (let i = 0; i < sampleTemplates.length; i++) {
      const tmpl = sampleTemplates[i];
      if (requestedCategory && requestedCategory !== 'all' && tmpl.category !== requestedCategory) {
        continue;
      }

      const distMeters = Math.round(radius * tmpl.distRatio);
      const coords = destinationPoint(options.center, distMeters, tmpl.bearing);

      results.push({
        id: `place_${i + 1}`,
        name: tmpl.name,
        category: tmpl.category,
        coordinates: coords,
        distanceMeters: Math.round(calculateDistance(options.center, coords)),
        address: `${100 + i * 15} Civic Avenue`,
        tags: {
          amenity: tmpl.category,
          source: 'mock-dataset',
        },
      });
    }

    // Sort by proximity ascending
    results.sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0));

    return results.slice(0, limit);
  }
}

/**
 * OpenStreetMap Overpass API Provider for real-world POI discovery.
 */
export class OverpassNearbySearchProvider implements INearbySearchProvider {
  readonly name = 'osm-overpass';
  private endpoint: string;
  private fallback: MockNearbySearchProvider;

  constructor(options?: { endpoint?: string }) {
    this.endpoint = options?.endpoint || 'https://overpass-api.de/api/interpreter';
    this.fallback = new MockNearbySearchProvider();
  }

  async searchNearby(options: NearbySearchOptions): Promise<NearbyPlace[]> {
    if (!isValidCoordinates(options.center)) {
      throw new Error('Invalid center coordinates supplied to searchNearby');
    }

    const radius = Math.min(options.radiusMeters || 2000, 10_000);
    const limit = options.limit ?? 15;

    // Build Overpass QL query around center circle
    const amenityFilter = options.category && options.category !== 'all'
      ? `["amenity"="${options.category}"]`
      : '["amenity"]';

    const ql = `[out:json][timeout:10];
      node(around:${radius},${options.center.lat},${options.center.lng})${amenityFilter};
      out body ${limit};`;

    try {
      const response = await fetch(`${this.endpoint}?data=${encodeURIComponent(ql)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      });

      if (!response.ok) {
        return this.fallback.searchNearby(options);
      }

      const data = await response.json();
      if (!data.elements || !Array.isArray(data.elements)) {
        return this.fallback.searchNearby(options);
      }

      return data.elements.map((el: Record<string, unknown>, idx: number) => {
        const lat = Number(el.lat);
        const lng = Number(el.lon);
        const tags = (el.tags as Record<string, string>) || {};
        const coords: Coordinates = { lat, lng };

        return {
          id: String(el.id || `node_${idx}`),
          name: tags.name || `${tags.amenity || 'Place'} (${idx + 1})`,
          category: tags.amenity,
          coordinates: coords,
          distanceMeters: Math.round(calculateDistance(options.center, coords)),
          address: tags['addr:street'] ? `${tags['addr:housenumber'] || ''} ${tags['addr:street']}`.trim() : undefined,
          tags,
        };
      });
    } catch {
      return this.fallback.searchNearby(options);
    }
  }
}

export const sharedNearbySearchProvider = new MockNearbySearchProvider();
