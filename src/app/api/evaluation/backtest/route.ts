/**
 * GET /api/evaluation/backtest
 * Executes reproducible historical backtesting against genuine weather reanalysis
 * and historical news-reported incident baseline for Amritsar.
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { isCitySupported } from '@/lib/city/registry'
import { runHistoricalBacktest } from '@/lib/evaluation/backtest'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const cityId = (searchParams.get('cityId') || 'amritsar').toLowerCase()

    if (!isCitySupported(cityId)) {
      return apiError(`Unknown city '${cityId}'. Supported cities: amritsar`, {
        status: 400,
        code: 'UNKNOWN_CITY',
      })
    }

    if (cityId !== 'amritsar') {
      return apiError(
        `Historical weather reanalysis backtesting is only available for calibrated baseline city 'amritsar' (requested '${cityId}'). '${cityId}' lacks an offline ERA5 reanalysis cache; see /api/evaluation?cityId=${cityId} for offline exploratory evaluation metrics.`,
        {
          status: 400,
          code: 'BACKTEST_CITY_UNAVAILABLE',
        }
      )
    }

    const rawSeason = searchParams.get('season')
    let startDate: string | undefined = searchParams.get('startDate') || undefined
    let endDate: string | undefined = searchParams.get('endDate') || undefined

    if (rawSeason === '2023') {
      startDate = '2023-06-01'
      endDate = '2023-09-30'
    } else if (rawSeason === '2024') {
      startDate = '2024-06-01'
      endDate = '2024-09-30'
    } else if (rawSeason === 'all') {
      startDate = '2023-06-01'
      endDate = '2024-09-30'
    }

    const report = runHistoricalBacktest({
      cityId,
      startDate,
      endDate,
    })

    return apiSuccess(report)
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes('bail out of prerendering') ||
        (err as { digest?: string }).digest?.startsWith('DYNAMIC_SERVER_USAGE'))
    ) {
      throw err
    }
    const errorMsg = err instanceof Error ? err.message : String(err)
    return apiError(`Failed to run historical backtest: ${errorMsg}`, {
      status: 500,
      code: 'BACKTEST_FAILED',
      internalError: err,
    })
  }
}
