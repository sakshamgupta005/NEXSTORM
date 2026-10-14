/**
 * GET /api/risk
 * 
 * Supports /api/risk?cityId=amritsar&mode=scenario&peakMm1h=...&durationH=...&antecedentMm72h=...
 * Delegates to scenario calculation. Returns HTTP 501 for unreleased modes (live, replay).
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { isCitySupported } from '@/lib/city/registry'
import { calculateScenarioRisk, ScenarioInputSchema } from '@/lib/risk/scenario'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const mode = (searchParams.get('mode') || 'scenario').toLowerCase()
    const cityId = searchParams.get('cityId') || ''

    if (mode === 'live' || mode === 'replay') {
      return apiError(
        `Mode '${mode}' is not yet implemented. Real-time forecasting and historical replay will be released in later stages.`,
        {
          status: 501,
          code: 'NOT_IMPLEMENTED',
          details: {
            mode,
            supportedModes: ['scenario'],
          },
        }
      )
    }

    if (mode !== 'scenario') {
      return apiError(
        `Invalid mode '${mode}'. Supported mode in P1 is 'scenario'.`,
        {
          status: 400,
          code: 'INVALID_MODE',
        }
      )
    }

    const rawPeak = searchParams.get('peakMm1h')
    const rawDuration = searchParams.get('durationH')
    const rawAntecedent = searchParams.get('antecedentMm72h')

    const parseResult = ScenarioInputSchema.safeParse({
      cityId,
      peakMm1h: rawPeak ? Number(rawPeak) : NaN,
      durationH: rawDuration ? Number(rawDuration) : NaN,
      antecedentMm72h: rawAntecedent !== null ? Number(rawAntecedent) : 0,
    })

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
    if (
      err instanceof Error &&
      (err.message.includes('bail out of prerendering') ||
        (err as { digest?: string }).digest?.startsWith('DYNAMIC_SERVER_USAGE'))
    ) {
      throw err
    }
    const message = err instanceof Error ? err.message : 'Failed to query risk'
    return apiError(message, {
      status: 500,
      code: 'RISK_QUERY_FAILED',
      internalError: err,
    })
  }
}
