import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchEnsembleForecast } from '@/lib/weather/ensemble';
import * as openmeteo from '@/lib/weather/openmeteo';
import { sharedCache } from '@/lib/cache';
import fs from 'node:fs';
import path from 'node:path';

describe('Open-Meteo Ensemble Weather Adapter', () => {
  const ensembleFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../fixtures/openmeteo/ensemble.json'), 'utf-8')
  );

  beforeEach(async () => {
    await sharedCache.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches ECMWF IFS ensemble on initial priority attempt', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(ensembleFixture), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const res = await fetchEnsembleForecast({ cityId: 'amritsar', horizonH: 48 });

    expect(res.status).toBe('ok');
    expect(res.data?.model).toBe('ecmwf_ifs025');
    expect(res.data?.members?.length).toBe(50);
  });

  it('falls back to GFS when ECMWF IFS fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('ecmwf_ifs025')) {
        return Promise.resolve(new Response('ECMWF IFS quota exceeded', { status: 503 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify(ensembleFixture), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }));

    const res = await fetchEnsembleForecast({ cityId: 'amritsar', skipCache: true });

    expect(res.status).toBe('ok');
    expect(res.data?.model).toBe('gfs025');
    expect(res.provenance.note).toContain('Fallback from ECMWF');
  });

  it('falls back to deterministic forecast when both ECMWF and GFS fail', async () => {
    // Both ensemble calls fail
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Ensemble unavailable', { status: 500 })));

    // Mock deterministic fallback succeeding
    vi.spyOn(openmeteo, 'fetchDeterministicForecast').mockResolvedValue({
      status: 'ok',
      data: {
        cityId: 'amritsar',
        issueTime: '2026-10-14T00:00:00+05:30',
        hours: ['2026-10-14T00:00:00+05:30'],
        deterministic: [3.4],
        model: 'open_meteo_deterministic',
        gridKm: 9,
        provenance: { kind: 'live', source: 'Deterministic Fallback' },
      },
      provenance: { kind: 'live', source: 'Deterministic Fallback' },
    });

    const res = await fetchEnsembleForecast({ cityId: 'amritsar', skipCache: true });

    expect(res.status).toBe('ok');
    expect(res.data?.deterministic).toEqual([3.4]);
    expect(res.data?.members).toBeUndefined(); // Explicitly no fake ensemble members
    expect(res.provenance.note).toContain('Ensemble unavailable');
  });

  it('returns degraded status when all models and deterministic fallback fail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Global Down', { status: 500 })));
    vi.spyOn(openmeteo, 'fetchDeterministicForecast').mockResolvedValue({
      status: 'degraded',
      provenance: { kind: 'derived', source: 'Failed' },
      error: 'All failed',
    });

    const res = await fetchEnsembleForecast({ cityId: 'amritsar', skipCache: true });

    expect(res.status).toBe('degraded');
    expect(res.data).toBeUndefined();
    expect(res.provenance.note).toContain('DEGRADED');
  });
});
