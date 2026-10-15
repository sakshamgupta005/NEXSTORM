/**
 * src/lib/weather/openmeteo.ts
 * Deterministic weather forecast adapter using Open-Meteo.
 * Integrates resilience (retries, timeouts), ICache, and snapshot fallback.
 */

import { createApiClient } from '../api/client';
import { sharedCache } from '../cache';
import { getCityConfig } from '../city/registry';
import { normalizeOpenMeteoResponse } from './normalize';
import { saveSnapshot, loadSnapshot } from './snapshots';
import { recordSourceSuccess, recordSourceFailure } from './source-tracker';
import {
  DEFAULT_WEATHER_COORDS,
  type RainfallSeries,
  type WeatherAdapterResult,
  type WeatherFetchOptions,
} from './types';
import type { Provenance } from '../risk/types';

export type ForecastFetchOptions = WeatherFetchOptions;

const DEFAULT_LAT = DEFAULT_WEATHER_COORDS.lat;
const DEFAULT_LON = DEFAULT_WEATHER_COORDS.lon;
const DEFAULT_TIMEZONE = DEFAULT_WEATHER_COORDS.timezone;

export function getForecastTtl(): number {
  const val = process.env.FORECAST_TTL_SECONDS;
  const parsed = val ? parseInt(val, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1800; // 30 mins
}

export function getForecastStaleMax(): number {
  const val = process.env.FORECAST_STALE_MAX_SECONDS;
  const parsed = val ? parseInt(val, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 21600; // 6 hours
}

export function getOpenMeteoBaseUrl(): string {
  return process.env.OPENMETEO_BASE_URL || 'https://api.open-meteo.com/v1/forecast';
}

/**
 * Fetches deterministic forecast from Open-Meteo with caching and snapshot fallbacks.
 */
export async function fetchDeterministicForecast(
  options: ForecastFetchOptions = {}
): Promise<WeatherAdapterResult<RainfallSeries>> {
  const cityId = options.cityId || 'amritsar';
  let lat = options.lat;
  let lon = options.lon;
  let timezone = options.timezone;

  if (lat === undefined || lon === undefined || timezone === undefined) {
    try {
      const cfg = getCityConfig(cityId);
      if (lat === undefined || lon === undefined) {
        if (cfg.center) {
          lat = lat ?? cfg.center[0];
          lon = lon ?? cfg.center[1];
        } else if (cfg.bbox) {
          lat = lat ?? (cfg.bbox[1] + cfg.bbox[3]) / 2;
          lon = lon ?? (cfg.bbox[0] + cfg.bbox[2]) / 2;
        }
      }
      timezone = timezone ?? cfg.timezone ?? DEFAULT_TIMEZONE;
    } catch {
      // Fallback to Amritsar defaults if city config is not available
    }
  }

  lat = lat ?? DEFAULT_LAT;
  lon = lon ?? DEFAULT_LON;
  timezone = timezone ?? DEFAULT_TIMEZONE;
  const horizonDays = Math.min(16, Math.max(1, Math.ceil((options.horizonH || 48) / 24)));

  const ttl = getForecastTtl();
  const maxStale = getForecastStaleMax();
  const baseUrl = getOpenMeteoBaseUrl();

  const cacheKey = `openmeteo:forecast:${cityId}:${lat}:${lon}:${horizonDays}`;

  // 1. Check in-memory cache
  if (!options.skipCache) {
    const cached = await sharedCache.get<RainfallSeries>(cacheKey);
    if (cached) {
      return {
        status: 'ok',
        data: cached,
        provenance: {
          ...cached.provenance,
          kind: 'cached',
        },
      };
    }
  }

  // 2. Setup resilient client (8s timeout, 2 retries with backoff)
  const client = createApiClient({
    baseUrl,
    timeoutMs: 8000,
    retries: 2,
    retryDelayMs: 500,
  });

  const queryParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'precipitation,rain',
    forecast_days: String(horizonDays),
    past_days: '1',
    timezone,
  });

  const fullUrl = `${baseUrl}?${queryParams.toString()}`;

  try {
    const res = await client.get<unknown>(fullUrl);

    if (!res.ok || !res.data) {
      throw new Error(res.error || `Upstream returned status ${res.status}`);
    }

    const { series, nullCount } = normalizeOpenMeteoResponse(res.data, {
      cityId,
      model: 'open_meteo_deterministic',
      gridKm: 9,
      source: 'Open-Meteo Deterministic Forecast API',
      isCached: false,
    });

    // Upstream fetch succeeded: record health, save snapshot, populate cache
    recordSourceSuccess('Open-Meteo Forecast');
    await saveSnapshot(cityId, 'Open-Meteo Forecast', series);
    await sharedCache.set(cacheKey, series, ttl);

    return {
      status: 'ok',
      data: series,
      provenance: series.provenance,
      nullCount,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordSourceFailure('Open-Meteo Forecast', errorMsg);

    // 3. Fallback to valid snapshot within staleness limits
    const snapshotResult = await loadSnapshot(cityId, maxStale);
    if (snapshotResult) {
      return {
        status: 'ok',
        data: snapshotResult.series,
        provenance: snapshotResult.series.provenance,
        error: `Upstream error (${errorMsg}); returned cached snapshot.`,
      };
    }

    // 4. Degraded response: no fake data
    const degradedProvenance: Provenance = {
      kind: 'derived',
      source: 'Open-Meteo Forecast (Unavailable)',
      fetchedAt: new Date().toISOString(),
      note: `DEGRADED — Failed to fetch upstream forecast: ${errorMsg}. No fresh snapshot available.`,
    };

    return {
      status: 'degraded',
      provenance: degradedProvenance,
      error: errorMsg,
    };
  }
}
