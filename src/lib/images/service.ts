/**
 * src/lib/images/service.ts
 * Central Image Evidence & Ingestion Service for NEXSTORM.
 *
 * Ingests, analyzes, indexes, and binds image evidence across:
 * 1. Mapillary street-level imagery
 * 2. Citizen / field-captured smartphone photos
 * 3. Verified municipal incident report archives
 *
 * Enforces scientific guardrails:
 * - Content hashing (SHA-256) for deduplication and provenance integrity
 * - Temporal stratification: historical survey imagery (e.g. Mapillary) is strictly
 *   prevented from triggering active flood alerts.
 * - Multi-scale spatial binding to 250m grid cells, road segments, and building footprints.
 */

import { createHash } from 'node:crypto'
import { getCitySusceptibility } from '../city/registry'
import { logger } from '../logging/logger'
import { matchPointToGrid, type GridCellFeature } from '../spatial/grid-matcher'
import type { Wgs84Coordinates } from '../spatial/types'
import { FloodImageAnalyzer } from './analyzer'
import { INCIDENT_IMAGE_ARCHIVE } from './incident-archive'
import { mapillaryAdapter } from './mapillary'
import { visionProviderAdapter } from './vision-provider'
import { VisualRiskFeatureMapper } from './risk-mapper'
import type {
  BuildingImageEvidenceSummary,
  ImageEvidenceRecord,
  ImageSourceType,
  MapillaryQueryResult,
  RoadImageEvidenceSummary,
} from './types'

export interface IngestFieldPhotoInput {
  cityId?: string
  imageUrl: string
  thumbnailUrl?: string
  coordinates: Wgs84Coordinates
  capturedAt?: string
  categoryHint?: string
  severityHint?: string
  description?: string
  attribution?: string
  license?: string
  roadSegmentId?: string
  buildingId?: string
}

export class ImageEvidenceService {
  private static instance: ImageEvidenceService
  private imagesById = new Map<string, ImageEvidenceRecord>()
  private imagesByHash = new Map<string, ImageEvidenceRecord>()
  private imagesByCell = new Map<string, ImageEvidenceRecord[]>()
  private imagesByRoad = new Map<string, ImageEvidenceRecord[]>()
  private imagesByBuilding = new Map<string, ImageEvidenceRecord[]>()

  private constructor() {
    this.seedArchive()
  }

  public static getInstance(): ImageEvidenceService {
    if (!ImageEvidenceService.instance) {
      ImageEvidenceService.instance = new ImageEvidenceService()
    }
    return ImageEvidenceService.instance
  }

  /**
   * Pre-seeds verified incident image archive into memory.
   */
  private seedArchive(): void {
    for (const record of INCIDENT_IMAGE_ARCHIVE) {
      if (!record.observation) {
        record.observation = visionProviderAdapter.extractDeterministicObservations({
          imageUrl: record.imageUrl,
          description: record.scientificCaveat,
        })
      }
      if (!record.riskFeatures) {
        record.riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
          imageId: record.id,
          observation: record.observation,
          isHistorical: record.isHistorical,
          capturedAt: record.capturedAt,
          coordinates: record.coordinates,
          cellId: record.cellId,
          roadSegmentId: record.roadSegmentId,
          buildingId: record.buildingId,
          providerStatus: 'ok',
        })
      }
      this.indexRecord(record)
    }
  }

  /**
   * Internal indexing helper.
   */
  private indexRecord(record: ImageEvidenceRecord): void {
    this.imagesById.set(record.id, record)
    this.imagesByHash.set(record.contentHash, record)

    if (record.cellId) {
      const list = this.imagesByCell.get(record.cellId) || []
      list.push(record)
      this.imagesByCell.set(record.cellId, list)
    }

    if (record.roadSegmentId) {
      const list = this.imagesByRoad.get(record.roadSegmentId) || []
      list.push(record)
      this.imagesByRoad.set(record.roadSegmentId, list)
    }

    if (record.buildingId) {
      const list = this.imagesByBuilding.get(record.buildingId) || []
      list.push(record)
      this.imagesByBuilding.set(record.buildingId, list)
    }
  }

  /**
   * Computes deterministic SHA-256 content hash.
   */
  public generateContentHash(source: string, url: string, coords: Wgs84Coordinates, capturedAt: string): string {
    const raw = `${source}_${url}_${coords.lat.toFixed(5)}_${coords.lng.toFixed(5)}_${capturedAt}`
    return createHash('sha256').update(raw).digest('hex')
  }

  /**
   * Ingests a citizen-submitted or field-captured photo.
   */
  public ingestFieldPhoto(input: IngestFieldPhotoInput): ImageEvidenceRecord {
    const cityId = (input.cityId || 'amritsar').toLowerCase()
    const capturedAt = input.capturedAt || new Date().toISOString()
    const capturedMs = Date.parse(capturedAt)
    const nowMs = Date.now()
    const ageHours = (nowMs - (isNaN(capturedMs) ? nowMs : capturedMs)) / (1000 * 60 * 60)
    // Recent submissions (< 24h) are active evidence; older are historical baselines
    const isHistorical = ageHours > 24

    const contentHash = this.generateContentHash(
      'citizen_field_submission',
      input.imageUrl,
      input.coordinates,
      capturedAt
    )

    // Deduplication check
    const existing = this.imagesByHash.get(contentHash)
    if (existing) {
      return existing
    }

    // Spatial snapping to grid cell
    let cellId: string | undefined
    try {
      const susceptibility = getCitySusceptibility(cityId)
      if (susceptibility?.features) {
        const match = matchPointToGrid(
          input.coordinates,
          susceptibility.features as unknown as GridCellFeature[],
          {
            sourceName: 'NEXSTORM Spatial Grid Snapper',
            retrievalDate: new Date().toISOString(),
            license: 'CC-BY-4.0',
            evidenceKind: 'modeled',
          }
        )
        if (match.cellId && match.matchQuality !== 'unmatched') {
          cellId = match.cellId
        }
      }
    } catch {
      // Non-fatal if susceptibility grid is not loaded
    }

    // Visual classification using FloodNet & FloodRescue-AI taxonomy
    const analysis = FloodImageAnalyzer.analyze({
      imageUrl: input.imageUrl,
      categoryHint: input.categoryHint,
      severityHint: input.severityHint,
      description: input.description,
    })

    const recordId = `IMG-FIELD-${Date.now()}-${contentHash.slice(0, 8)}`

    // Extract structured observation
    const observation = visionProviderAdapter.extractDeterministicObservations({
      imageUrl: input.imageUrl,
      categoryHint: input.categoryHint,
      severityHint: input.severityHint,
      description: input.description,
    })

    // Deterministically map to versioned risk features
    const riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
      imageId: recordId,
      observation,
      isHistorical,
      capturedAt,
      coordinates: input.coordinates,
      cellId,
      roadSegmentId: input.roadSegmentId,
      buildingId: input.buildingId,
      providerStatus: 'ok',
    })

    const record: ImageEvidenceRecord = {
      id: recordId,
      source: 'citizen_field_submission',
      imageUrl: input.imageUrl,
      thumbnailUrl: input.thumbnailUrl || input.imageUrl,
      capturedAt,
      ingestedAt: new Date().toISOString(),
      coordinates: input.coordinates,
      geographicAccuracyMeters: 10.0, // Typical smartphone GPS horizontal accuracy
      cityId,
      cellId,
      roadSegmentId: input.roadSegmentId,
      buildingId: input.buildingId,
      attribution: input.attribution || 'Citizen Field Contributor',
      license: input.license || 'Proprietary Community Submission',
      contentHash,
      processingStatus: analysis.waterDetected ? 'verified_flooded' : 'verified_clear',
      isHistorical,
      observation,
      riskFeatures,
      analysis,
      provenance: {
        sourceName: 'Citizen Field Submission',
        retrievalDate: new Date().toISOString(),
        license: input.license || 'Proprietary',
        evidenceKind: 'observed',
      },
      scientificCaveat: isHistorical
        ? 'Historical field photo; does NOT indicate current road passage or building exposure.'
        : 'Active field photo; water presence and passability analyzed via FloodNet classification heuristics.',
    }

    this.indexRecord(record)
    logger.info(`[IMAGE_SERVICE] Ingested field image evidence ${recordId} (cell: ${cellId || 'none'})`)
    return record
  }

  /**
   * Asynchronously ingests and executes real AI provider image analysis (Gemini/OpenAI/VisionService).
   */
  public async ingestAndAnalyzeFieldPhoto(input: IngestFieldPhotoInput): Promise<ImageEvidenceRecord> {
    const cityId = (input.cityId || 'amritsar').toLowerCase()
    const capturedAt = input.capturedAt || new Date().toISOString()
    const capturedMs = Date.parse(capturedAt)
    const nowMs = Date.now()
    const ageHours = (nowMs - (isNaN(capturedMs) ? nowMs : capturedMs)) / (1000 * 60 * 60)
    const isHistorical = ageHours > 24

    const contentHash = this.generateContentHash(
      'citizen_field_submission',
      input.imageUrl,
      input.coordinates,
      capturedAt
    )

    const existing = this.imagesByHash.get(contentHash)
    if (existing) {
      return existing
    }

    let cellId: string | undefined
    try {
      const susceptibility = getCitySusceptibility(cityId)
      if (susceptibility?.features) {
        const match = matchPointToGrid(
          input.coordinates,
          susceptibility.features as unknown as GridCellFeature[],
          {
            sourceName: 'NEXSTORM Spatial Grid Snapper',
            retrievalDate: new Date().toISOString(),
            license: 'CC-BY-4.0',
            evidenceKind: 'modeled',
          }
        )
        if (match.cellId && match.matchQuality !== 'unmatched') {
          cellId = match.cellId
        }
      }
    } catch {
      // Non-fatal
    }

    const recordId = `IMG-AI-${Date.now()}-${contentHash.slice(0, 8)}`

    // Run active AI vision provider
    const visionResult = await visionProviderAdapter.analyzeImage({
      imageUrl: input.imageUrl,
      categoryHint: input.categoryHint,
      severityHint: input.severityHint,
      description: input.description,
    })

    const observation = visionResult.observation || visionProviderAdapter.extractDeterministicObservations(input)

    const riskFeatures = VisualRiskFeatureMapper.mapToRiskFeatures({
      imageId: recordId,
      observation,
      isHistorical,
      capturedAt,
      coordinates: input.coordinates,
      cellId,
      roadSegmentId: input.roadSegmentId,
      buildingId: input.buildingId,
      providerStatus: visionResult.status,
    })

    const analysis = FloodImageAnalyzer.analyze({
      imageUrl: input.imageUrl,
      categoryHint: input.categoryHint,
      severityHint: input.severityHint,
      description: input.description,
    })

    const record: ImageEvidenceRecord = {
      id: recordId,
      source: 'citizen_field_submission',
      imageUrl: input.imageUrl,
      thumbnailUrl: input.thumbnailUrl || input.imageUrl,
      capturedAt,
      ingestedAt: new Date().toISOString(),
      coordinates: input.coordinates,
      geographicAccuracyMeters: 10.0,
      cityId,
      cellId,
      roadSegmentId: input.roadSegmentId,
      buildingId: input.buildingId,
      attribution: input.attribution || 'Citizen Field Contributor',
      license: input.license || 'Proprietary Community Submission',
      contentHash,
      processingStatus: visionResult.status === 'ok' ? 'analyzed' : 'provider_error',
      isHistorical,
      observation,
      riskFeatures,
      analysis,
      provenance: {
        sourceName: `AI Vision Analysis (${visionResult.provider})`,
        retrievalDate: new Date().toISOString(),
        license: input.license || 'Proprietary',
        evidenceKind: 'observed',
      },
      scientificCaveat: isHistorical
        ? 'Historical field photo; does NOT indicate current road passage.'
        : `Active field photo; analyzed with ${visionResult.model} (${visionResult.provider}).`,
    }

    this.indexRecord(record)
    return record
  }

  /**
   * Fetches and ingests Mapillary street-level imagery for study area.
   */
  public async ingestMapillaryArea(bbox: [number, number, number, number], cityId: string = 'amritsar'): Promise<MapillaryQueryResult> {
    const result = await mapillaryAdapter.queryImagery({ bbox, cityId, limit: 30 })
    if (result.status === 'ok') {
      for (const img of result.images) {
        if (!this.imagesByHash.has(img.contentHash)) {
          this.indexRecord(img)
        }
      }
    }
    return result
  }

  /**
   * Retrieves image evidence records attached to a road segment.
   */
  public getImageEvidenceForRoad(
    roadSegmentId: string,
    currentOnly: boolean = false
  ): ImageEvidenceRecord[] {
    const records = this.imagesByRoad.get(roadSegmentId) || []
    if (currentOnly) {
      return records.filter((r) => !r.isHistorical)
    }
    return records
  }

  private haversineDistanceMeters(
    c1: { lat: number; lng: number },
    c2: { lat: number; lng: number }
  ): number {
    const dLat = ((c2.lat - c1.lat) * Math.PI) / 180
    const dLng = ((c2.lng - c1.lng) * Math.PI) / 180
    const lat1 = (c1.lat * Math.PI) / 180
    const lat2 = (c2.lat * Math.PI) / 180
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return 2 * 6371000 * Math.asin(Math.sqrt(a))
  }

  /**
   * Returns typed summary of road image evidence for inclusion in road evaluations.
   * Associates explicit road segment IDs and nearby geolocated photos (<= 25m).
   */
  public getRoadImageSummary(
    roadSegmentId: string,
    segmentCoords?: { start: Wgs84Coordinates; end: Wgs84Coordinates } | boolean,
    currentOnly: boolean = false,
    maxDistanceMeters: number = 25.0
  ): RoadImageEvidenceSummary[] {
    const isCurrentOnly = typeof segmentCoords === 'boolean' ? segmentCoords : currentOnly
    const coords = typeof segmentCoords === 'object' && segmentCoords !== null ? segmentCoords : undefined

    const direct = this.getImageEvidenceForRoad(roadSegmentId, isCurrentOnly)
    const seen = new Set<string>()
    const summaries: RoadImageEvidenceSummary[] = []

    for (const r of direct) {
      seen.add(r.id)
      summaries.push({
        imageId: r.id,
        source: r.source,
        capturedAt: r.capturedAt,
        isHistorical: r.isHistorical,
        floodedRoad: r.analysis.floodedRoad,
        passability: r.analysis.passability,
        confidence: r.analysis.confidence,
        thumbnailUrl: r.thumbnailUrl || r.imageUrl,
        riskFeatures: r.riskFeatures,
        distanceMeters: 0,
      })
    }

    if (coords && coords.start && coords.end) {
      const midLat = (coords.start.lat + coords.end.lat) / 2
      const midLng = (coords.start.lng + coords.end.lng) / 2
      const midCoord = { lat: midLat, lng: midLng }

      for (const r of this.imagesById.values()) {
        if (seen.has(r.id)) continue
        if (isCurrentOnly && r.isHistorical) continue
        if (!r.coordinates) continue

        const dStart = this.haversineDistanceMeters(r.coordinates, coords.start)
        const dEnd = this.haversineDistanceMeters(r.coordinates, coords.end)
        const dMid = this.haversineDistanceMeters(r.coordinates, midCoord)
        const minDist = Math.min(dStart, dEnd, dMid)

        if (minDist <= maxDistanceMeters) {
          seen.add(r.id)
          summaries.push({
            imageId: r.id,
            source: r.source,
            capturedAt: r.capturedAt,
            isHistorical: r.isHistorical,
            floodedRoad: r.analysis.floodedRoad,
            passability: r.analysis.passability,
            confidence: r.analysis.confidence,
            thumbnailUrl: r.thumbnailUrl || r.imageUrl,
            riskFeatures: r.riskFeatures,
            distanceMeters: Math.round(minDist * 10) / 10,
          })
        }
      }
    }

    return summaries
  }

  /**
   * Retrieves image evidence records associated with a grid cell.
   */
  public getImageEvidenceForCell(cellId: string, currentOnly: boolean = false): ImageEvidenceRecord[] {
    const records = this.imagesByCell.get(cellId) || []
    if (currentOnly) {
      return records.filter((r) => !r.isHistorical)
    }
    return records
  }

  /**
   * Retrieves image evidence records associated with a building footprint.
   */
  public getImageEvidenceForBuilding(buildingId: string, currentOnly: boolean = false): ImageEvidenceRecord[] {
    const records = this.imagesByBuilding.get(buildingId) || []
    if (currentOnly) {
      return records.filter((r) => !r.isHistorical)
    }
    return records
  }

  /**
   * Returns typed summary of building image evidence for inclusion in building exposure records.
   * Strictly respects location accuracy & proximity (<= 35m) to avoid cell-wide indiscriminate bleed.
   */
  public getBuildingImageSummary(
    buildingId: string,
    location?: { lat: number; lng: number } | string,
    currentOnly: boolean = false,
    maxDistanceMeters: number = 35.0
  ): BuildingImageEvidenceSummary[] {
    const direct = this.getImageEvidenceForBuilding(buildingId, currentOnly)
    const seen = new Set<string>()
    const summaries: BuildingImageEvidenceSummary[] = []

    for (const r of direct) {
      seen.add(r.id)
      summaries.push({
        imageId: r.id,
        source: r.source,
        capturedAt: r.capturedAt,
        isHistorical: r.isHistorical,
        floodedBuilding: r.analysis.floodedBuilding,
        waterDetected: r.analysis.waterDetected,
        confidence: r.analysis.confidence,
        thumbnailUrl: r.thumbnailUrl || r.imageUrl,
        riskFeatures: r.riskFeatures,
        distanceMeters: 0,
      })
    }

    if (location && typeof location === 'object' && 'lat' in location && 'lng' in location) {
      for (const r of this.imagesById.values()) {
        if (seen.has(r.id)) continue
        if (currentOnly && r.isHistorical) continue
        if (!r.coordinates) continue

        const dist = this.haversineDistanceMeters(r.coordinates, location)
        if (dist <= maxDistanceMeters) {
          seen.add(r.id)
          summaries.push({
            imageId: r.id,
            source: r.source,
            capturedAt: r.capturedAt,
            isHistorical: r.isHistorical,
            floodedBuilding: r.analysis.floodedBuilding,
            waterDetected: r.analysis.waterDetected,
            confidence: r.analysis.confidence,
            thumbnailUrl: r.thumbnailUrl || r.imageUrl,
            riskFeatures: r.riskFeatures,
            distanceMeters: Math.round(dist * 10) / 10,
          })
        }
      }
    }

    return summaries
  }

  /**
   * General query filter over all ingested image evidence.
   */
  public queryImages(filters: {
    cityId?: string
    source?: ImageSourceType
    currentOnly?: boolean
    waterDetected?: boolean
    floodedRoad?: boolean
    floodedBuilding?: boolean
    cellId?: string
    roadSegmentId?: string
  }): ImageEvidenceRecord[] {
    let list = Array.from(this.imagesById.values())

    if (filters.cityId) {
      const c = filters.cityId.toLowerCase()
      list = list.filter((img) => img.cityId.toLowerCase() === c)
    }

    if (filters.source) {
      list = list.filter((img) => img.source === filters.source)
    }

    if (filters.currentOnly) {
      list = list.filter((img) => !img.isHistorical)
    }

    if (filters.waterDetected !== undefined) {
      list = list.filter((img) => img.analysis.waterDetected === filters.waterDetected)
    }

    if (filters.floodedRoad !== undefined) {
      list = list.filter((img) => img.analysis.floodedRoad === filters.floodedRoad)
    }

    if (filters.floodedBuilding !== undefined) {
      list = list.filter((img) => img.analysis.floodedBuilding === filters.floodedBuilding)
    }

    if (filters.cellId) {
      list = list.filter((img) => img.cellId === filters.cellId)
    }

    if (filters.roadSegmentId) {
      list = list.filter((img) => img.roadSegmentId === filters.roadSegmentId)
    }

    return list
  }
}

export const imageEvidenceService = ImageEvidenceService.getInstance()
