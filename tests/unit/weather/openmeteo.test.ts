import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchDeterministicForecast,
  getOpenMeteoBaseUrl,
  getForecastTtl,
  getForecastStaleMax,
} from '@/lib/weather/openmeteo';
import { sharedCache } from '@/lib/cache';
import * as snapshots from '@/lib/weather/snapshots';
import fs from 'node:fs';
import path from 'node:path';

describe('Open-Meteo Deterministic Weather Adapter', () => {
  const forecastFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../fixtures/openmeteo/forecast.json'), 'utf-8')
  );

  beforeEach(async () => {
    await sharedCache.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENMETEO_BASE_URL;
    delete process.env.FORECAST_TTL_SECONDS;
    delete process.env.FORECAST_STALE_MAX_SECONDS;
  });

  it('respects environment overrides for base URL and TTL configuration', () => {
    process.env.OPENMETEO_BASE_URL = 'https://custom.weather.internal/v1/forecast';
    process.env.FORECAST_TTL_SECONDS = '900';
    process.env.FORECAST_STALE_MAX_SECONDS = '7200';

    expect(getOpenMeteoBaseUrl()).toBe('https://custom.weather.internal/v1/forecast');
    expect(getForecastTtl()).toBe(900);
    expect(getForecastStaleMax()).toBe(7200);
  });

  it('fetches forecast successfully, caches it, and records live provenance', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(forecastFixture), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchDeterministicForecast({ cityId: 'amritsar', horizonH: 48 });

    expect(res.status).toBe('ok');
    expect(res.data?.cityId).toBe('amritsar');
    expect(res.provenance.kind).toBe('live');
    expect(fetchMock).toHaveBeenCalled();

    // Second call should hit in-memory cache without calling fetch again
    const res2 = await fetchDeterministicForecast({ cityId: 'amritsar', horizonH: 48 });
    expect(res2.status).toBe('ok');
    expect(res2.provenance.kind).toBe('cached');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to valid snapshot when upstream returns HTTP 500', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Internal Error', { status: 500 }))
    );

    const fakeSnapshot = {
      series: {
        cityId: 'amritsar',
        issueTime: '2026-10-14T00:00:00+05:30',
        hours: ['2026-10-14T00:00:00+05:30'],
        deterministic: [4.5],
        model: 'test_snapshot',
        gridKm: 9,
        provenance: { kind: 'cached' as const, source: 'Snapshot', ageSeconds: 120 },
      },
      ageSeconds: 120,
    };

    vi.spyOn(snapshots, 'loadSnapshot').mockResolvedValue(fakeSnapshot);

    const res = await fetchDeterministicForecast({ cityId: 'amritsar', skipCache: true });

    expect(res.status).toBe('ok');
    expect(res.data?.deterministic).toEqual([4.5]);
    expect(res.provenance.kind).toBe('cached');
  });

  it('returns degraded status when upstream fails and no snapshot is available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Rate Limited', { status: 429 }))
    );
    vi.spyOn(snapshots, 'loadSnapshot').mockResolvedValue(null);

    const res = await fetchDeterministicForecast({ cityId: 'amritsar', skipCache: true });

    expect(res.status).toBe('degraded');
    expect(res.data).toBeUndefined();
    expect(res.provenance.note).toContain('DEGRADED');
  });

  it('respects retries on network timeout and exhausts safely', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('Network connection reset'));
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(snapshots, 'loadSnapshot').mockResolvedValue(null);

    const res = await fetchDeterministicForecast({ cityId: 'amritsar', skipCache: true });

    expect(res.status).toBe('degraded');
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });
});
