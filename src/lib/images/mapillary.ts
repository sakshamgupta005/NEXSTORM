/**
 * src/lib/images/mapillary.ts
 * Mapillary v4 Graph API Integration for NEXSTORM.
 *
 * Fetches georeferenced street-level imagery and capture metadata for configured study areas.
 * Enforces strict scientific guardrails:
 * - When MAPILLARY_ACCESS_TOKEN is missing, documents the blocker explicitly without fabricating data.
 * - Distinguishes baseline street survey imagery from current flood events via isHistorical.
 */

import { createHash } from 'node:crypto'
import { isValidEnvValue } from '../env'
import { logger } from '../logging/logger'
import { FloodImageAnalyzer } from './analyzer'
import type { ImageEvidenceRecord, MapillaryQueryOptions, MapillaryQueryResult } from './types'

const MAPILLARY_GRAPH_URL = 'https://graph.mapillary.com/images'

export class MapillaryAdapter {
  private static instance: MapillaryAdapter

  private constructor() {}

  public static getInstance(): MapillaryAdapter {
    if (!MapillaryAdapter.instance) {
      MapillaryAdapter.instance = new MapillaryAdapter()
    }
    return MapillaryAdapter.instance
  }

  /**
   * Checks if Mapillary API credentials are configured and valid.
   */
  public isConfigured(): boolean {
    const token = process.env.MAPILLARY_ACCESS_TOKEN
    return isValidEnvValue(token)
  }

  /**
   * Fetches geolocated street-level imagery within the specified bounding box.
   */
  public async queryImagery(options: MapillaryQueryOptions): Promise<MapillaryQueryResult> {
    const token = process.env.MAPILLARY_ACCESS_TOKEN

    if (!isValidEnvValue(token)) {
      logger.info(
        '[MAPILLARY] MAPILLARY_ACCESS_TOKEN is not configured or is a placeholder. Street-level imagery retrieval is blocked.'
      )
      return {
        status: 'blocked',
        reason:
          'MAPILLARY_ACCESS_TOKEN is not configured. Street-level imagery queries require a valid developer token from https://www.mapillary.com/dashboard/developers',
        totalFetched: 0,
        images: [],
      }
    }

    const [minLng, minLat, maxLng, maxLat] = options.bbox
    const limit = Math.min(options.limit || 20, 100)
    const bboxStr = `${minLng},${minLat},${maxLng},${maxLat}`

    const url = new URL(MAPILLARY_GRAPH_URL)
    url.searchParams.set('fields', 'id,computed_geometry,captured_at,thumb_1024_url,thumb_256_url,creator')
    url.searchParams.set('bbox', bboxStr)
    url.searchParams.set('limit', String(limit))

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `OAuth ${token!.trim()}`,
        },
        signal: AbortSignal.timeout(10000), // 10s strict timeout
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        logger.error(`[MAPILLARY] API error ${response.status}: ${errorText}`)
        return {
          status: 'error',
          reason: `Mapillary API returned HTTP ${response.status}: ${response.statusText}`,
          totalFetched: 0,
          images: [],
        }
      }

      const json = await response.json()
      const data: Array<{
        id: string
        computed_geometry?: { coordinates: [number, number] }
        captured_at?: number
        thumb_1024_url?: string
        thumb_256_url?: string
        creator?: { username?: string }
      }> = json.data || []

      const nowMs = Date.now()
      const cityId = options.cityId || 'amritsar'

      const images: ImageEvidenceRecord[] = []

      for (const item of data) {
        if (!item.computed_geometry?.coordinates) continue

        const [lng, lat] = item.computed_geometry.coordinates
        const capturedMs = item.captured_at ? item.captured_at : nowMs
        const capturedAt = new Date(capturedMs).toISOString()
        const ageHours = (nowMs - capturedMs) / (1000 * 60 * 60)
        // Street photos older than 24 hours are historical baselines, not current flood observations
        const isHistorical = ageHours > 24

        const contentHash = createHash('sha256')
          .update(`mapillary_${item.id}_${capturedAt}`)
          .digest('hex')

        const analysis = FloodImageAnalyzer.analyze({
          imageUrl: item.thumb_1024_url,
          description: `Mapillary street survey image captured at [${lat.toFixed(4)}, ${lng.toFixed(4)}]`,
        })

        images.push({
          id: `MAPILLARY-${item.id}`,
          source: 'mapillary',
          imageUrl: item.thumb_1024_url || '',
          thumbnailUrl: item.thumb_256_url,
          capturedAt,
          ingestedAt: new Date().toISOString(),
          coordinates: { lat, lng },
          geographicAccuracyMeters: 5.0, // Typical GPS precision for vehicle/mobile Mapillary capture
          cityId,
          attribution: `Mapillary contributor ${item.creator?.username || 'community'} (CC-BY-SA 4.0)`,
          license: 'CC-BY-SA-4.0',
          contentHash,
          processingStatus: 'analyzed',
          isHistorical,
          analysis,
          provenance: {
            sourceName: 'Mapillary Street-Level Imagery (Graph API v4)',
            sourceUrl: `https://www.mapillary.com/app/?pKey=${item.id}`,
            retrievalDate: new Date().toISOString(),
            license: 'CC-BY-SA-4.0',
            evidenceKind: 'observed',
          },
          scientificCaveat: isHistorical
            ? 'Historical baseline street-level survey; does NOT indicate current flood or waterlogging condition.'
            : 'Recent street-level imagery; passability evaluated by FloodNet visual classifier.',
        })
      }

      return {
        status: 'ok',
        totalFetched: images.length,
        images,
      }
    } catch (err) {
      logger.error(`[MAPILLARY] Fetch exception: ${err instanceof Error ? err.message : String(err)}`)
      return {
        status: 'error',
        reason: err instanceof Error ? err.message : 'Unknown network failure querying Mapillary API',
        totalFetched: 0,
        images: [],
      }
    }
  }
}

export const mapillaryAdapter = MapillaryAdapter.getInstance()
