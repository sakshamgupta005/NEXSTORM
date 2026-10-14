import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as rainfallGet } from '@/lib/../app/api/rainfall/route';
import { GET as alertsGet } from '@/lib/../app/api/official-alerts/route';
import { GET as healthGet } from '@/lib/../app/api/health/route';
import * as openmeteo from '@/lib/weather/openmeteo';
import * as sachet from '@/lib/weather/sachet';
import { recordSourceSuccess, recordSourceFailure } from '@/lib/weather/source-tracker';

describe('Weather & Alerts API Routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/rainfall', () => {
    it('returns 200 and structured payload for valid city and horizon', async () => {
      vi.spyOn(openmeteo, 'fetchDeterministicForecast').mockResolvedValue({
        status: 'ok',
        data: {
          cityId: 'amritsar',
          issueTime: '2026-10-14T00:00:00+05:30',
          hours: ['2026-10-14T00:00:00+05:30'],
          deterministic: [12.0],
          model: 'open_meteo_deterministic',
          gridKm: 9,
          provenance: { kind: 'live', source: 'Test' },
        },
        provenance: { kind: 'live', source: 'Test' },
      });

      const req = new NextRequest('http://localhost:3000/api/rainfall?cityId=amritsar&horizonH=48');
      const res = await rainfallGet(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ok');
      expect(body.data.series.deterministic).toEqual([12.0]);
      expect(body.data.summary.max1h).toBe(12.0);
      expect(body.data.summary.max24h).toBe(12.0);
      expect(body.data.summary.imdCategoryOfMax24h).toBe('Light Rain');
    });

    it('returns 400 when cityId is missing', async () => {
      const req = new NextRequest('http://localhost:3000/api/rainfall?horizonH=48');
      const res = await rainfallGet(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_QUERY');
    });

    it('returns 400 for unknown cityId', async () => {
      const req = new NextRequest('http://localhost:3000/api/rainfall?cityId=delhi');
      const res = await rainfallGet(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNKNOWN_CITY');
    });

    it('returns 400 when horizonH is out of bounds (>168)', async () => {
      const req = new NextRequest('http://localhost:3000/api/rainfall?cityId=amritsar&horizonH=500');
      const res = await rainfallGet(req);
      const body = await res.json();

      expect(res.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('INVALID_QUERY');
    });

    it('returns degraded status with summary when forecast is degraded', async () => {
      vi.spyOn(openmeteo, 'fetchDeterministicForecast').mockResolvedValue({
        status: 'degraded',
        provenance: { kind: 'derived', source: 'Unavailable', note: 'DEGRADED' },
        error: 'Upstream down',
      });

      const req = new NextRequest('http://localhost:3000/api/rainfall?cityId=amritsar');
      const res = await rainfallGet(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.status).toBe('degraded');
      expect(body.data.series).toBeUndefined();
      expect(body.data.summary.max1h).toBeNull();
    });
  });

  describe('GET /api/official-alerts', () => {
    it('returns 200 with filtered alerts array and official provenance', async () => {
      vi.spyOn(sachet, 'fetchSachetAlerts').mockResolvedValue({
        status: 'ok',
        data: [
          {
            id: 'alert-1',
            event: 'Waterlogging Alert',
            author: 'Punjab SDMA',
            severity: 'Severe',
          },
        ],
        provenance: { kind: 'official', source: 'SACHET' },
      });

      const req = new NextRequest('http://localhost:3000/api/official-alerts?state=punjab');
      const res = await alertsGet(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ok');
      expect(body.data.alerts.length).toBe(1);
      expect(body.data.alerts[0].event).toBe('Waterlogging Alert');
    });

    it('returns safe unavailable status when SACHET feed is unreachable', async () => {
      vi.spyOn(sachet, 'fetchSachetAlerts').mockResolvedValue({
        status: 'unavailable',
        data: [],
        provenance: { kind: 'official', source: 'SACHET (Unavailable)' },
        error: 'Connection timeout',
      });

      const req = new NextRequest('http://localhost:3000/api/official-alerts');
      const res = await alertsGet(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.status).toBe('unavailable');
      expect(body.data.alerts).toEqual([]);
    });
  });

  describe('GET /api/health source reporting', () => {
    it('reports per-source status in health check without initiating network calls', async () => {
      recordSourceSuccess('Open-Meteo Forecast');
      recordSourceFailure('NDMA SACHET RSS', 'Simulated 503');

      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const req = new NextRequest('http://localhost:3000/api/health');
      const res = await healthGet(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.status).toBe('healthy');
      expect(body.data.sources).toBeDefined();
      expect(body.data.sources['Open-Meteo Forecast'].status).toBe('healthy');
      expect(body.data.sources['NDMA SACHET RSS'].status).toBe('degraded');
      expect(body.data.sources['NDMA SACHET RSS'].lastError).toBe('Simulated 503');

      // Crucial requirement: Health checks must NEVER initiate external network requests!
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
