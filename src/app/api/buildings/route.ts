/**
 * src/app/api/buildings/route.ts
 * GET /api/buildings — Retrieves building-level flood exposure records filtered by viewport bbox or cellId.
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { buildingExposureService } from '@/lib/buildings/service'
import { buildingQuerySchema } from '@/lib/validations/buildings'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const rawParams = {
      cityId: searchParams.get('cityId') || 'amritsar',
      cellId: searchParams.get('cellId') || undefined,
      bbox: searchParams.get('bbox') || undefined,
      minLng: searchParams.get('minLng') || undefined,
      minLat: searchParams.get('minLat') || undefined,
      maxLng: searchParams.get('maxLng') || undefined,
      maxLat: searchParams.get('maxLat') || undefined,
      exposureCategory:
        searchParams.getAll('exposureCategory').length > 1
          ? searchParams.getAll('exposureCategory')
          : searchParams.get('exposureCategory') || undefined,
      minAreaM2: searchParams.get('minAreaM2') || undefined,
      maxAreaM2: searchParams.get('maxAreaM2') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    }

    const parsed = buildingQuerySchema.safeParse(rawParams)
    if (!parsed.success) {
      return apiError('Invalid query parameters for building exposure assessment', {
        status: 400,
        code: 'INVALID_QUERY_PARAMS',
        details: parsed.error.format(),
      })
    }

    const query = parsed.data
    if (query.cityId?.toLowerCase() !== 'amritsar') {
      return apiError(
        `Building footprint data is currently only prepared for Amritsar (requested '${query.cityId}')`,
        {
          status: 404,
          code: 'CITY_NOT_PREPARED',
        }
      )
    }

    const result = buildingExposureService.queryBuildings(query)

    return apiSuccess({
      cityId: query.cityId,
      total: result.total,
      count: result.count,
      items: result.items,
      provenance: {
        sourceName: 'Google Open Buildings V3 (S2 Cell 391) + NEXSTORM 250m Susceptibility Grid',
        retrievalDate: '2026-10-15T11:50:29Z',
        license: 'CC-BY-4.0',
        evidenceKind: 'modeled',
      },
      scientificCaveat:
        'Building exposure represents macro-catchment terrain runoff propensity. It does NOT predict indoor water depth, structural damage, or plinth elevation clearance.',
    })
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes('bail out of prerendering') ||
        (err as { digest?: string }).digest?.startsWith('DYNAMIC_SERVER_USAGE'))
    ) {
      throw err
    }
    return apiError('Failed to query building exposure records', {
      status: 500,
      code: 'BUILDING_QUERY_ERROR',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
