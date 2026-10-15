/**
 * src/app/api/official-alerts/route.ts
 * GET /api/official-alerts?state=punjab
 * Fetches and filters official NDMA SACHET CAP emergency alerts.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiSuccess, apiError } from '@/lib/api/response';
import { fetchSachetAlerts } from '@/lib/weather/sachet';
import type { SachetAlert } from '@/lib/weather/types';
import type { Provenance } from '@/lib/risk/types';
import { ValueMeta, ValueMetaPresets } from '@/lib/metadata';

const QuerySchema = z.object({
  state: z.string().optional().default('punjab'),
});

export interface OfficialAlertsApiResponse {
  status: 'ok' | 'unavailable';
  alerts: SachetAlert[];
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

  const { state } = parseResult.data;

  const result = await fetchSachetAlerts({
    stateFilter: state,
  });

  const valueMeta: Record<string, ValueMeta> = {
    alerts:
      result.status === 'ok'
        ? ValueMetaPresets.officialAlert(result.provenance?.source, result.provenance?.note)
        : ValueMetaPresets.unavailable('Statutory Emergency Alert', 'NDMA SACHET feed unreachable'),
    officialAlerts:
      result.status === 'ok'
        ? ValueMetaPresets.officialAlert(result.provenance?.source, result.provenance?.note)
        : ValueMetaPresets.unavailable('Statutory Emergency Alert', 'NDMA SACHET feed unreachable'),
  };

  const payload: OfficialAlertsApiResponse = {
    status: result.status === 'ok' ? 'ok' : 'unavailable',
    alerts: result.data || [],
    provenance: result.provenance,
    valueMeta,
  };

  return apiSuccess(payload, {
    status: 200,
    requestId,
  });
}
