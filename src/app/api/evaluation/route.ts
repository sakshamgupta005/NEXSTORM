/**
 * GET /api/evaluation
 * Returns static offline evaluation summary results from the hydrometeorological pipeline.
 * Validates frozen configuration integrity and ensures configHash matches the current frozen configuration.
 */

import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'
import { apiError, apiSuccess, handleApiCatch } from '@/lib/api/response'
import { getCityConfig } from '@/lib/city/registry'
import { runScientificValidationAudit } from '@/lib/evaluation/validation'
import { ValueMetaPresets } from '@/lib/metadata'

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

    if (cityId === 'jalandhar') {
      const jalEvalPath = path.resolve(
        process.cwd(),
        'public',
        'data',
        'cities',
        'jalandhar',
        'evaluation_results.json'
      )
      const jalQualityPath = path.resolve(
        process.cwd(),
        'public',
        'data',
        'cities',
        'jalandhar',
        'quality_report.json'
      )

      if (!fs.existsSync(jalEvalPath)) {
        return apiError('Offline evaluation results for Jalandhar are unavailable.', {
          status: 404,
          code: 'EVALUATION_RESULTS_MISSING',
        })
      }

      let evalData: Record<string, unknown>
      try {
        evalData = JSON.parse(fs.readFileSync(jalEvalPath, 'utf-8'))
      } catch (err) {
        return apiError('Malformed Jalandhar evaluation JSON file.', {
          status: 500,
          code: 'EVALUATION_SUMMARY_CORRUPT',
          internalError: err,
        })
      }

      const qualityReport = fs.existsSync(jalQualityPath)
        ? JSON.parse(fs.readFileSync(jalQualityPath, 'utf-8'))
        : null

      return apiSuccess({
        source: 'static_exploratory',
        cityId: 'jalandhar',
        configHash: config.configHash,
        ...evalData,
        audit: qualityReport,
        valueMeta: {
          ...((evalData.valueMeta as Record<string, unknown>) || {}),
          evaluationStatus: ValueMetaPresets.unavailable(
            'Jalandhar Offline Backtest',
            'ERA5 reanalysis archive and georeferenced incident corpus are not yet established for Jalandhar.'
          ),
        },
      })
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
      valueMeta: {
        ...((summary.valueMeta as Record<string, unknown>) || {}),
        modelPod: ValueMetaPresets.evaluationMetric('POD (Hit Rate)', 'Probability of detection across 7 verified historical storm events'),
        baselinePod: ValueMetaPresets.evaluationMetric('Baseline POD', 'Probability of detection using standard 64.5 mm rainfall threshold'),
        historicalArchive: ValueMetaPresets.historicalReanalysis('Reanalysis Evaluation Span', '2010-2024 ERA5-Land monsoon season reanalysis archive', 'monsoons'),
      },
    }

    return apiSuccess(payload)
  } catch (err: unknown) {
    return handleApiCatch(err, 'Failed to retrieve evaluation summary', {
      code: 'EVALUATION_QUERY_FAILED',
    })
  }
}

