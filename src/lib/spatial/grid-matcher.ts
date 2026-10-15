/**
 * src/lib/spatial/grid-matcher.ts
 * Deterministic spatial matching of point observations and building centroids
 * to Amritsar analysis grid cells (250m city cells and 50m campus cells).
 */

import { euclideanDistanceUtm, wgs84ToUtm43n } from './crs'
import { isPointInBbox, isPointInGeometry } from './point-in-polygon'
import type { PointGridMatch, ProvenanceMetadata, Wgs84Coordinates } from './types'

export interface GridCellFeature {
  properties: {
    id: string
    s: number
    [key: string]: unknown
  }
  geometry: {
    type: string
    coordinates: number[][][] | number[][][][]
  }
  bbox?: [number, number, number, number] // [minLng, minLat, maxLng, maxLat]
}

/**
 * Computes bounding box [minLng, minLat, maxLng, maxLat] from polygon coordinates.
 */
export function computeFeatureBbox(geometry: { type: string; coordinates: number[][][] | number[][][][] }): [number, number, number, number] {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  function scanRing(ring: number[][]) {
    for (const [x, y] of ring) {
      if (x < minLng) minLng = x
      if (y < minLat) minLat = y
      if (x > maxLng) maxLng = x
      if (y > maxLat) maxLat = y
    }
  }

  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][]
    if (coords && coords[0]) {
      scanRing(coords[0])
    }
  } else if (geometry.type === 'MultiPolygon') {
    const coords = geometry.coordinates as number[][][][]
    for (const poly of coords) {
      if (poly && poly[0]) scanRing(poly[0])
    }
  }

  return [minLng, minLat, maxLng, maxLat]
}

/**
 * Computes centroid [lng, lat] from a Polygon's exterior ring coordinates.
 */
export function computePolygonCentroid(geometry: { type: string; coordinates: number[][][] | number[][][][] }): Wgs84Coordinates {
  let ring: number[][] = []
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][]
    if (coords && coords[0]) ring = coords[0]
  } else if (geometry.type === 'MultiPolygon') {
    const coords = geometry.coordinates as number[][][][]
    if (coords && coords[0] && coords[0][0]) ring = coords[0][0]
  }

  if (ring.length === 0) {
    return { lng: 0, lat: 0 }
  }

  let sumLng = 0
  let sumLat = 0
  const n = ring.length - 1 || 1 // Avoid double counting closing vertex

  for (let i = 0; i < n; i++) {
    sumLng += ring[i][0]
    sumLat += ring[i][1]
  }

  return {
    lng: Math.round((sumLng / n) * 1e6) / 1e6,
    lat: Math.round((sumLat / n) * 1e6) / 1e6,
  }
}

/**
 * Matches a point coordinate to its containing analysis grid cell.
 * Preserves unmatched status honestly when point falls outside grid bounds.
 */
export function matchPointToGrid(
  point: Wgs84Coordinates,
  gridFeatures: GridCellFeature[],
  provenance: ProvenanceMetadata
): PointGridMatch {
  const ptTuple: [number, number] = [point.lng, point.lat]

  for (const cell of gridFeatures) {
    // 1. Fast Bbox rejection
    const bbox = cell.bbox || computeFeatureBbox(cell.geometry)
    if (!isPointInBbox(ptTuple, bbox)) {
      continue
    }

    // 2. Exact Ray-Casting Point-in-Polygon check
    if (isPointInGeometry(ptTuple, cell.geometry)) {
      const centroid = computePolygonCentroid(cell.geometry)
      const ptUtm = wgs84ToUtm43n(point)
      const centroidUtm = wgs84ToUtm43n(centroid)
      const distanceToCentroidMeters = euclideanDistanceUtm(ptUtm, centroidUtm)

      return {
        point,
        cellId: cell.properties.id,
        matchQuality: 'exact_inside',
        susceptibilityScore: cell.properties.s,
        distanceToCentroidMeters,
        provenance,
      }
    }
  }

  // Fallback: point does not intersect any grid cell
  return {
    point,
    cellId: null,
    matchQuality: 'unmatched',
    susceptibilityScore: null,
    distanceToCentroidMeters: null,
    provenance,
    limitation: 'Coordinates fall outside the verified municipal analysis grid boundary.',
  }
}
