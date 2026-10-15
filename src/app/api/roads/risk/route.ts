/**
 * src/app/api/roads/risk/route.ts
 * GET /api/roads/risk — Evaluates road-segment waterlogging risk and returns filtered segments
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess, handleApiCatch } from '@/lib/api/response'
import { roadRiskService } from '@/lib/roads/service'
import { roadRiskQuerySchema } from '@/lib/validations/roads'
import { ValueMetaPresets } from '@/lib/metadata'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const rawParams = {
      cityId: searchParams.get('cityId') || 'amritsar',
      bbox: searchParams.get('bbox') || undefined,
      minLng: searchParams.get('minLng') || undefined,
      minLat: searchParams.get('minLat') || undefined,
      maxLng: searchParams.get('maxLng') || undefined,
      maxLat: searchParams.get('maxLat') || undefined,
      highway:
        searchParams.getAll('highway').length > 1
          ? searchParams.getAll('highway')
          : searchParams.get('highway') || undefined,
      riskClass:
        searchParams.getAll('riskClass').length > 1
          ? searchParams.getAll('riskClass')
          : searchParams.get('riskClass') || undefined,
      hasObservation: searchParams.get('hasObservation') || undefined,
      isUnderpass: searchParams.get('isUnderpass') || undefined,
      hasUnderpass: searchParams.get('hasUnderpass') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const parsed = roadRiskQuerySchema.safeParse(rawParams)
    if (!parsed.success) {
      return apiError('Invalid query parameters for road risk assessment', {
        status: 400,
        code: 'INVALID_QUERY_PARAMS',
        details: parsed.error.format(),
      })
    }

    const query = parsed.data
    if (query.cityId?.toLowerCase() !== 'amritsar') {
      return apiError(
        `Road network data is currently only prepared for Amritsar (requested '${query.cityId}')`,
        {
          status: 404,
          code: 'CITY_NOT_PREPARED',
        }
      )
    }

    const result = roadRiskService.queryRoads(query)

    return apiSuccess({
      cityId: query.cityId,
      total: result.total,
      count: result.count,
      items: result.items,
      // Backwards-compatible aliases
      totalMatching: result.total,
      roads: result.items,
      provenance: {
        sourceName:
          'OpenStreetMap Road Network (14,853 segments) + NEXSTORM 250m Susceptibility Grid',
        retrievalDate: new Date().toISOString(),
        license: 'ODbL 1.0',
        evidenceKind: 'modeled',
      },
      valueMeta: {
        roadRisk: ValueMetaPresets.roadRisk(),
      },
    })
  } catch (err: unknown) {
    return handleApiCatch(err, 'Failed to query road segment risk', {
      code: 'ROAD_RISK_QUERY_ERROR',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
