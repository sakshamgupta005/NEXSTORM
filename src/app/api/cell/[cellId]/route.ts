/**
 * GET /api/cell/[cellId]
 * Retrieves cell-level susceptibility factor contributions, terrain override metadata,
 * nearby validated incident hotspots (<= 500m), and limitations.
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess, handleApiCatch } from '@/lib/api/response'
import { isCitySupported } from '@/lib/city/registry'
import { explainCellRisk } from '@/lib/risk/explain'

export async function GET(


  req: NextRequest,
  context: { params: Promise<{ cellId: string }> }
) {
  try {
    const { cellId } = await context.params
    if (!cellId || typeof cellId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(cellId)) {
      return apiError(
        `Invalid or malformed cellId '${cellId}'. Expected alphanumeric ID like 'A-0001'.`,
        {
          status: 400,
          code: 'INVALID_CELL_ID',
        }
      )
    }

    const { searchParams } = new URL(req.url)
    const cityId = (searchParams.get('cityId') || 'amritsar').toLowerCase()

    if (!isCitySupported(cityId)) {
      return apiError(`Unsupported city '${cityId}'.`, {
        status: 400,
        code: 'UNSUPPORTED_CITY',
      })
    }

    try {
      const explanation = explainCellRisk(cellId, cityId)
      return apiSuccess(explanation)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('not found in susceptibility grid')) {
        return apiError(msg, {
          status: 404,
          code: 'CELL_NOT_FOUND',
        })
      }
      throw err
    }
  } catch (err: unknown) {
    return handleApiCatch(err, 'Failed to retrieve cell explanation', {
      code: 'CELL_EXPLANATION_FAILED',
    })
  }

}
