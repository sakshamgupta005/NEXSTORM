/**
 * src/lib/spatial/point-in-polygon.ts
 * Deterministic point-in-polygon (PIP) test using Ray Casting with Bounding-Box pre-filtering
 * and explicit boundary-edge handling.
 */

export type PointContainment = 'inside' | 'boundary' | 'outside'

const EPSILON = 1e-9

/**
 * Checks whether point [lng, lat] falls within a bounding box [minLng, minLat, maxLng, maxLat].
 */
export function isPointInBbox(
  pt: [number, number],
  bbox: [number, number, number, number]
): boolean {
  const [x, y] = pt
  const [minX, minY, maxX, maxY] = bbox
  return x >= minX - EPSILON && x <= maxX + EPSILON && y >= minY - EPSILON && y <= maxY + EPSILON
}

/**
 * Checks if a point lies on a line segment AB.
 */
function isPointOnSegment(
  pt: [number, number],
  a: [number, number],
  b: [number, number]
): boolean {
  const [px, py] = pt
  const [ax, ay] = a
  const [bx, by] = b

  // Check bounding box of segment
  if (
    px < Math.min(ax, bx) - EPSILON ||
    px > Math.max(ax, bx) + EPSILON ||
    py < Math.min(ay, by) - EPSILON ||
    py > Math.max(ay, by) + EPSILON
  ) {
    return false
  }

  // Cross product to test collinearity: (py - ay)*(bx - ax) - (px - ax)*(by - ay) == 0
  const cross = (py - ay) * (bx - ax) - (px - ax) * (by - ay)
  return Math.abs(cross) < 1e-8
}

/**
 * Ray-casting algorithm over a single closed linear ring of coordinates.
 * Returns true if inside, false if outside.
 */
export function isPointInRing(pt: [number, number], ring: number[][]): boolean {
  if (ring.length < 3) return false

  const [px, py] = pt
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0]
    const yi = ring[i][1]
    const xj = ring[j][0]
    const yj = ring[j][1]

    // Check if point lies directly on edge
    if (isPointOnSegment(pt, [xi, yi], [xj, yj])) {
      return true
    }

    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
    if (intersect) {
      inside = !inside
    }
  }

  return inside
}

/**
 * Tests containment of a point in a GeoJSON Polygon (exterior ring minus interior hole rings).
 */
export function isPointInGeoJsonPolygon(
  pt: [number, number],
  polygonCoords: number[][][]
): PointContainment {
  if (!Array.isArray(polygonCoords) || polygonCoords.length === 0) {
    return 'outside'
  }

  const exterior = polygonCoords[0]
  if (!isPointInRing(pt, exterior)) {
    return 'outside'
  }

  // Check if inside any interior hole ring (if so, point is in a hole, hence outside)
  for (let h = 1; h < polygonCoords.length; h++) {
    const hole = polygonCoords[h]
    if (isPointInRing(pt, hole)) {
      return 'outside'
    }
  }

  return 'inside'
}

/**
 * Tests containment of a point in GeoJSON geometry (Polygon or MultiPolygon).
 */
export function isPointInGeometry(
  pt: [number, number],
  geometry: { type: string; coordinates: number[][][] | number[][][][] }
): boolean {
  if (!geometry || !geometry.coordinates) return false

  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][]
    return isPointInGeoJsonPolygon(pt, coords) === 'inside'
  }

  if (geometry.type === 'MultiPolygon') {
    const coords = geometry.coordinates as number[][][][]
    for (const polyCoords of coords) {
      if (isPointInGeoJsonPolygon(pt, polyCoords) === 'inside') {
        return true
      }
    }
    return false
  }

  return false
}
