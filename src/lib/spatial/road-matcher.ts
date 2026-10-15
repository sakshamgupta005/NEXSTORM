/**
 * src/lib/spatial/road-matcher.ts
 * Projects point observations onto road network centerlines with strict distance tolerance.
 * Enforces honest 'unmatched' status when observation exceeds snapping threshold.
 */

import { euclideanDistanceUtm, utm43nToWgs84, wgs84ToUtm43n } from './crs'
import type { ProvenanceMetadata, RoadObservationMatch, UtmCoordinates, Wgs84Coordinates } from './types'

export interface RoadSegmentGeometry {
  segmentId: string
  osmid: string
  name: string | null
  highway: string
  // Array of coordinates along the polyline (in WGS84)
  coordinates: Wgs84Coordinates[]
}

/**
 * Projects point P onto line segment AB in projected UTM43N coordinates.
 * Returns the projected point Q, scalar parameter t in [0, 1], and Euclidean distance in meters.
 */
export function projectPointOntoSegmentUtm(
  p: UtmCoordinates,
  a: UtmCoordinates,
  b: UtmCoordinates
): { projected: UtmCoordinates; t: number; distanceMeters: number } {
  const abX = b.easting - a.easting
  const abY = b.northing - a.northing
  const abLenSq = abX * abX + abY * abY

  if (abLenSq === 0) {
    // Segment is a single point
    return {
      projected: a,
      t: 0,
      distanceMeters: euclideanDistanceUtm(p, a),
    }
  }

  const apX = p.easting - a.easting
  const apY = p.northing - a.northing

  // Scalar projection t = (AP . AB) / |AB|^2
  const rawT = (apX * abX + apY * abY) / abLenSq
  const t = Math.max(0.0, Math.min(1.0, rawT))

  const q: UtmCoordinates = {
    easting: a.easting + t * abX,
    northing: a.northing + t * abY,
    zone: 43,
    hemisphere: 'N',
  }

  const distanceMeters = euclideanDistanceUtm(p, q)
  return { projected: q, t, distanceMeters }
}

/**
 * Matches a point observation to the nearest road segment in a candidate set.
 * Rejects match if closest road exceeds toleranceMeters.
 */
export function matchObservationToRoadSegment(
  observationId: string,
  point: Wgs84Coordinates,
  roadSegments: RoadSegmentGeometry[],
  provenance: ProvenanceMetadata,
  toleranceMeters: number = 30.0
): RoadObservationMatch {
  if (roadSegments.length === 0) {
    return {
      observationId,
      originalCoord: point,
      matchedSegmentId: null,
      snappedCoord: null,
      distanceToSegmentMeters: Infinity,
      fractionAlongSegment: null,
      matchQuality: 'unmatched',
      toleranceMeters,
      provenance,
      reason: 'No candidate road segments available in search radius.',
    }
  }

  const pUtm = wgs84ToUtm43n(point)

  let closestSegmentId: string | null = null
  let minDistance = Infinity
  let bestProjectedUtm: UtmCoordinates | null = null
  let bestFraction: number | null = null

  for (const road of roadSegments) {
    const coords = road.coordinates
    if (coords.length < 2) continue

    // Convert road points to UTM
    const utmCoords = coords.map((c) => wgs84ToUtm43n(c))

    // Iterate through line segments of the polyline
    for (let i = 0; i < utmCoords.length - 1; i++) {
      const a = utmCoords[i]
      const b = utmCoords[i + 1]

      const { projected, t, distanceMeters } = projectPointOntoSegmentUtm(pUtm, a, b)

      if (distanceMeters < minDistance) {
        minDistance = distanceMeters
        closestSegmentId = road.segmentId
        bestProjectedUtm = projected
        // Approximate fraction along entire polyline
        const overallFraction = (i + t) / (utmCoords.length - 1)
        bestFraction = Math.round(overallFraction * 1000) / 1000
      }
    }
  }

  // Enforce distance threshold
  if (minDistance <= toleranceMeters && closestSegmentId && bestProjectedUtm) {
    const snappedWgs84 = utm43nToWgs84(bestProjectedUtm)

    return {
      observationId,
      originalCoord: point,
      matchedSegmentId: closestSegmentId,
      snappedCoord: snappedWgs84,
      distanceToSegmentMeters: Math.round(minDistance * 10) / 10,
      fractionAlongSegment: bestFraction,
      matchQuality: 'projected_segment',
      toleranceMeters,
      provenance,
    }
  }

  return {
    observationId,
    originalCoord: point,
    matchedSegmentId: null,
    snappedCoord: null,
    distanceToSegmentMeters: Number.isFinite(minDistance) ? Math.round(minDistance * 10) / 10 : Infinity,
    fractionAlongSegment: null,
    matchQuality: 'unmatched',
    toleranceMeters,
    provenance,
    reason: `Distance to nearest roadway (${Math.round(minDistance)}m) exceeds maximum allowable snapping tolerance (${toleranceMeters}m).`,
  }
}
