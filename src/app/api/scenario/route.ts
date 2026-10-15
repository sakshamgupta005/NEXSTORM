/**
 * POST /api/scenario
 * 
 * Validates scenario parameters and generates deterministic hyetograph and cell-level risk.
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess, handleApiCatch } from '@/lib/api/response'
import { isCitySupported } from '@/lib/city/registry'
import { calculateScenarioRisk, ScenarioInputSchema } from '@/lib/risk/scenario'

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return apiError('Invalid JSON payload in request body', {
        status: 400,
        code: 'INVALID_JSON',
      })
    }

    const parseResult = ScenarioInputSchema.safeParse(body)
    if (!parseResult.success) {
      const issueMessages = parseResult.error.issues
        .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
        .join('; ')

      return apiError(`Validation failed: ${issueMessages}`, {
        status: 400,
        code: 'VALIDATION_ERROR',
        details: parseResult.error.flatten(),
      })
    }

    const input = parseResult.data

    if (!isCitySupported(input.cityId)) {
      return apiError(`Unknown city '${input.cityId}'. Supported cities: amritsar`, {
        status: 400,
        code: 'UNKNOWN_CITY',
      })
    }

    const result = calculateScenarioRisk(input)
    return apiSuccess(result)
  } catch (err: unknown) {
    return handleApiCatch(err, 'Failed to evaluate scenario risk', {
      code: 'SCENARIO_EVALUATION_FAILED',
    })
  }
}
