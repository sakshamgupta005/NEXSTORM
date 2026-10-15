/**
 * src/lib/alerts/geofence.ts
 * Geospatial targeting, geofence validation, and quiet-hours evaluation for NEXSTORM P20.
 */

import { getCitySusceptibility, getCityConfig } from '../city/registry'
import type { AlertDecision, GeofenceTarget, QuietHoursConfig, SubscriberPreference } from './types'

export interface GeofenceMatchResult {
  matches: boolean
  matchedCells: string[]
  matchedCorridor?: string
  reason: string
}

/**
 * Validates subscriber geofence configuration against Amritsar physical boundaries.
 */
export function validateGeofenceTarget(target: GeofenceTarget, cityId: string = 'amritsar'): { valid: boolean; error?: string } {
  if (!target || !target.type) {
    return { valid: false, error: 'Missing geofence type' }
  }

  const config = getCityConfig(cityId)
  const [minLon, minLat, maxLon, maxLat] = config.bbox

  if (target.type === 'cells') {
    if (!Array.isArray(target.cellIds) || target.cellIds.length === 0) {
      return { valid: false, error: 'Geofence type "cells" requires at least one non-empty cell ID' }
    }
    const susceptibility = getCitySusceptibility(cityId)
    const knownCells = new Set(susceptibility.features.map((f) => f.properties.id))
    for (const cid of target.cellIds) {
      if (!knownCells.has(cid)) {
        return { valid: false, error: `Invalid cellId '${cid}' not present in ${cityId} grid` }
      }
    }
  } else if (target.type === 'bbox') {
    if (!target.bbox || target.bbox.length !== 4) {
      return { valid: false, error: 'Geofence type "bbox" requires [minLon, minLat, maxLon, maxLat]' }
    }
    const [bMinLon, bMinLat, bMaxLon, bMaxLat] = target.bbox
    if (bMinLon >= bMaxLon || bMinLat >= bMaxLat) {
      return { valid: false, error: 'Inverted bounding box: min coordinates must be strictly less than max' }
    }
    if (bMinLon < minLon || bMaxLon > maxLon || bMinLat < minLat || bMaxLat > maxLat) {
      return { valid: false, error: `Bounding box ${JSON.stringify(target.bbox)} extends outside ${cityId} boundaries` }
    }
  } else if (target.type === 'corridor') {
    if (!target.roadCorridor || typeof target.roadCorridor !== 'string' || target.roadCorridor.trim().length === 0) {
      return { valid: false, error: 'Geofence type "corridor" requires a valid non-empty roadCorridor name or ID' }
    }
  }

  return { valid: true }
}

/**
 * Evaluates whether an alert decision matches a subscriber's targeted geofence.
 * Guarantees single-match deduplication even if subscriber selected multiple overlapping criteria.
 */
export function matchSubscriberGeofence(
  subscriber: SubscriberPreference,
  decision: AlertDecision
): GeofenceMatchResult {
  if (subscriber.cityId !== decision.cityId) {
    return { matches: false, matchedCells: [], reason: 'City mismatch' }
  }

  const { geofence } = subscriber

  // 1. Citywide targeting
  if (geofence.type === 'citywide') {
    if (decision.affectedCells.length > 0) {
      return {
        matches: true,
        matchedCells: decision.affectedCells,
        reason: 'Citywide subscription matched active alert cells',
      }
    }
    return { matches: false, matchedCells: [], reason: 'No affected cells in decision' }
  }

  // 2. Cell-specific targeting
  if (geofence.type === 'cells' && geofence.cellIds) {
    const subscriberCellSet = new Set(geofence.cellIds)
    const intersection = decision.affectedCells.filter((cid) => subscriberCellSet.has(cid))
    if (intersection.length > 0) {
      return {
        matches: true,
        matchedCells: intersection,
        reason: `Matched ${intersection.length} targeted cells`,
      }
    }
    return { matches: false, matchedCells: [], reason: 'Target cells not affected by current hazard' }
  }

  // 3. Corridor targeting
  if (geofence.type === 'corridor' && geofence.roadCorridor) {
    const targetCorridor = geofence.roadCorridor.toLowerCase()
    const matchesCorridor = decision.affectedRoadIds.some((r) => r.toLowerCase().includes(targetCorridor))
    if (matchesCorridor) {
      return {
        matches: true,
        matchedCells: decision.affectedCells,
        matchedCorridor: geofence.roadCorridor,
        reason: `Matched road corridor '${geofence.roadCorridor}'`,
      }
    }
    return { matches: false, matchedCells: [], reason: 'Target road corridor not affected' }
  }

  // 4. Bounding box targeting
  if (geofence.type === 'bbox' && geofence.bbox) {
    const [bMinLon, bMinLat, bMaxLon, bMaxLat] = geofence.bbox
    const susceptibility = getCitySusceptibility(decision.cityId)
    const affectedSet = new Set(decision.affectedCells)

    const matchedCells: string[] = []
    for (const f of susceptibility.features) {
      if (!affectedSet.has(f.properties.id)) continue
      // Approximate centroid from first coordinate ring
      const coords = f.geometry.coordinates[0]
      if (!coords || coords.length === 0) continue
      let sumLon = 0
      let sumLat = 0
      for (const pt of coords) {
        sumLon += pt[0]
        sumLat += pt[1]
      }
      const cLon = sumLon / coords.length
      const cLat = sumLat / coords.length

      if (cLon >= bMinLon && cLon <= bMaxLon && cLat >= bMinLat && cLat <= bMaxLat) {
        matchedCells.push(f.properties.id)
      }
    }

    if (matchedCells.length > 0) {
      return {
        matches: true,
        matchedCells,
        reason: `Matched ${matchedCells.length} cells within subscriber bounding box`,
      }
    }
    return { matches: false, matchedCells: [], reason: 'No affected cells fall within subscriber bounding box' }
  }

  return { matches: false, matchedCells: [], reason: 'Unsupported or unmatched geofence' }
}

/**
 * Checks whether quiet hours currently apply to the subscriber.
 * Severe risk alerts (RTI >= 1.5) bypass quiet hours for life-safety warnings.
 */
export function isQuietHoursActive(
  config: QuietHoursConfig | undefined,
  decisionState: AlertDecision['state'],
  currentDate: Date = new Date()
): { isQuiet: boolean; reason?: string } {
  if (!config || !config.enabled) {
    return { isQuiet: false }
  }

  // Severe risk alerts bypass quiet hours
  if (decisionState === 'severe_risk') {
    return { isQuiet: false, reason: 'Severe risk alert bypasses quiet hours' }
  }

  try {
    // Get local hour in subscriber's timezone (default Asia/Kolkata)
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: config.timezone || 'Asia/Kolkata',
      hour: 'numeric',
      hour12: false,
    })
    const localHour = parseInt(timeFormatter.format(currentDate), 10)

    const start = config.startLocalHour
    const end = config.endLocalHour

    let inQuiet = false
    if (start <= end) {
      inQuiet = localHour >= start && localHour < end
    } else {
      // Overnight interval (e.g. 22:00 to 07:00)
      inQuiet = localHour >= start || localHour < end
    }

    if (inQuiet) {
      return {
        isQuiet: true,
        reason: `Current local time (${localHour}:00 in ${config.timezone}) is within quiet hours (${start}:00 - ${end}:00)`,
      }
    }
  } catch {
    // If timezone parsing fails, fail-safe to non-quiet
    return { isQuiet: false }
  }

  return { isQuiet: false }
}
