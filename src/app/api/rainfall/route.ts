/**
 * src/app/api/rainfall/route.ts
 * GET /api/rainfall?cityId=amritsar&horizonH=48
 * Provides validated, cached numerical rainfall forecast series with IMD summary metrics.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api/response';
import { isValidCityId } from '@/lib/city/registry';
import { fetchDeterministicForecast } from '@/lib/weather/openmeteo';
import { calculateRainfallSummary } from '@/lib/weather/normalize';
import type { RainfallSeries, RainfallSummary } from '@/lib/weather/types';
import type { Provenance } from '@/lib/risk/types';
import { ValueMeta, ValueMetaPresets } from '@/lib/metadata';

const QuerySchema = z.object({
  cityId: z.string().min(1, 'cityId is required'),
  horizonH: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 48))
    .pipe(z.number().int().min(1).max(168)),
});

export interface RainfallApiResponse {
  status: 'ok' | 'degraded';
  series?: RainfallSeries;
  summary: RainfallSummary;
  provenance: Provenance;
  valueMeta: Record<string, ValueMeta>;
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? undefined;
  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

  const parseResult = QuerySchema.safeParse(searchParams);
  if (!parseResult.success) {
    return apiError('Invalid query parameters', {
      status: 400,
      code: 'INVALID_QUERY',
      details: parseResult.error.format(),
      requestId,
    });
  }

  const { cityId, horizonH } = parseResult.data;

  // Validate city against registry
  if (!isValidCityId(cityId)) {
    return apiError(`Unknown cityId: '${cityId}'. Registered cities: amritsar`, {
      status: 400,
      code: 'UNKNOWN_CITY',
      requestId,
    });
  }

  // Fetch forecast with resilience, cache, and snapshot fallback
  const result = await fetchDeterministicForecast({
    cityId,
    horizonH,
  });

  const summary = calculateRainfallSummary(result.data);

  const valueMeta: Record<string, ValueMeta> =
    result.status === 'ok'
      ? {
          max24h: ValueMetaPresets.rainfall24h(
            'live',
            result.provenance.kind === 'cached' ? 'Cached snapshot' : 'Current forecast run',
            result.provenance.source
          ),
          total24hMm: ValueMetaPresets.rainfall24h(
            'live',
            result.provenance.kind === 'cached' ? 'Cached snapshot' : 'Current forecast run',
            result.provenance.source
          ),
          max1h: ValueMetaPresets.rainfall1h(
            'live',
            result.provenance.kind === 'cached' ? 'Cached snapshot' : 'Current forecast run',
            result.provenance.source
          ),
          peak1hRate: ValueMetaPresets.rainfall1h(
            'live',
            result.provenance.kind === 'cached' ? 'Cached snapshot' : 'Current forecast run',
            result.provenance.source
          ),
          imdCategory: ValueMetaPresets.imdCategory(),
        }
      : {
          max24h: ValueMetaPresets.unavailable(
            'Forecast 24h Rainfall',
            result.error || 'Upstream provider unavailable'
          ),
          total24hMm: ValueMetaPresets.unavailable(
            'Forecast 24h Rainfall',
            result.error || 'Upstream provider unavailable'
          ),
          max1h: ValueMetaPresets.unavailable(
            'Peak 1h Rainfall Rate',
            result.error || 'Upstream provider unavailable'
          ),
          peak1hRate: ValueMetaPresets.unavailable(
            'Peak 1h Rainfall Rate',
            result.error || 'Upstream provider unavailable'
          ),
          imdCategory: ValueMetaPresets.unavailable(
            'Rainfall Intensity Standard',
            result.error || 'Upstream provider unavailable'
          ),
        };

  const payload: RainfallApiResponse = {
    status: result.status === 'ok' ? 'ok' : 'degraded',
    series: result.data,
    summary,
    provenance: result.provenance,
    valueMeta,
  };

  return apiSuccess(payload, {
    status: 200,
    requestId,
  });
}
