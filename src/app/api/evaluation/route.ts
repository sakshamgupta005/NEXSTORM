/**
 * GET /api/evaluation
 * Returns static offline evaluation summary results from the hydrometeorological pipeline.
 * Validates frozen configuration integrity and ensures configHash matches the current frozen configuration.
 */

import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/api/response'
import { getCityConfig } from '@/lib/city/registry'
import { runScientificValidationAudit } from '@/lib/evaluation/validation'

export async function GET(req: NextRequest) {


  try {
    const { searchParams } = new URL(req.url)
    const cityId = (searchParams.get('cityId') || 'amritsar').toLowerCase()

    let config
    try {
      config = getCityConfig(cityId)
    } catch (err: unknown) {
      return apiError(
        `Failed to verify city configuration for '${cityId}': ${err instanceof Error ? err.message : String(err)}`,
        { status: 400, code: 'CONFIG_VERIFICATION_FAILED' }
      )
    }

    const summaryPath = path.resolve(
      process.cwd(),
      'public',
      'data',
      'evaluation',
      'summary.json'
    )

    if (!fs.existsSync(summaryPath)) {
      return apiError('Offline evaluation summary is unavailable.', {
        status: 404,
        code: 'EVALUATION_SUMMARY_MISSING',
      })
    }

    let summaryRaw: string
    let summary: Record<string, unknown>
    try {
      summaryRaw = fs.readFileSync(summaryPath, 'utf-8')
      summary = JSON.parse(summaryRaw)
    } catch (err) {
      return apiError('Malformed evaluation summary JSON file.', {
        status: 500,
        code: 'EVALUATION_SUMMARY_CORRUPT',
        internalError: err,
      })
    }

    // Verify schema integrity and config hash correspondence
    if (!summary || typeof summary !== 'object') {
      return apiError('Evaluation summary must be an object.', {
        status: 500,
        code: 'INVALID_SUMMARY_SCHEMA',
      })
    }

    if (summary.configHash !== config.configHash) {
      return apiError(
        `CONFIGURATION HASH INCONSISTENCY: evaluation summary was produced with configHash ${summary.configHash}, but current frozen configuration is ${config.configHash}. Refusing to serve mismatched evaluation results.`,
        {
          status: 500,
          code: 'CONFIG_HASH_MISMATCH',
          details: {
            summaryConfigHash: summary.configHash,
            currentConfigHash: config.configHash,
          },
        }
      )
    }

    const auditReport = runScientificValidationAudit(cityId)

    const payload = {
      source: 'static',
      configHash: config.configHash,
      ...summary,
      audit: auditReport,
    }

    return apiSuccess(payload)
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes('bail out of prerendering') ||
        (err as { digest?: string }).digest?.startsWith('DYNAMIC_SERVER_USAGE'))
    ) {
      throw err
    }
    const message = err instanceof Error ? err.message : 'Failed to retrieve evaluation summary'
    return apiError(message, {
      status: 500,
      code: 'EVALUATION_QUERY_FAILED',
      internalError: err,
    })
  }

}
