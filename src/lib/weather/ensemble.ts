/**
 * src/lib/weather/ensemble.ts
 * Multi-model ensemble forecast adapter using Open-Meteo Ensemble API.
 * Fallback order: ECMWF IFS -> GFS -> Deterministic fallback -> Degraded.
 */

import { createApiClient } from '../api/client';
import { sharedCache } from '../cache';
import { normalizeOpenMeteoResponse } from './normalize';
import { fetchDeterministicForecast, getForecastTtl } from './openmeteo';
import { recordSourceSuccess, recordSourceFailure } from './source-tracker';
import {
  DEFAULT_WEATHER_COORDS,
  type RainfallSeries,
  type WeatherAdapterResult,
  type WeatherFetchOptions,
} from './types';
import type { Provenance } from '../risk/types';

import { getCityConfig } from '../city/registry';

export type EnsembleFetchOptions = WeatherFetchOptions;

const DEFAULT_LAT = DEFAULT_WEATHER_COORDS.lat;
const DEFAULT_LON = DEFAULT_WEATHER_COORDS.lon;
const DEFAULT_TIMEZONE = DEFAULT_WEATHER_COORDS.timezone;

export function getOpenMeteoEnsembleUrl(): string {
  return process.env.OPENMETEO_ENSEMBLE_URL || 'https://ensemble-api.open-meteo.com/v1/ensemble';
}

/**
 * Attempts to fetch ensemble series for a specific model from Open-Meteo Ensemble API.
 */
async function fetchEnsembleModel(
  model: 'ecmwf_ifs025' | 'gfs025',
  options: EnsembleFetchOptions
): Promise<RainfallSeries> {
  const lat = options.lat ?? DEFAULT_LAT;
  const lon = options.lon ?? DEFAULT_LON;
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const horizonDays = Math.min(16, Math.max(1, Math.ceil((options.horizonH || 48) / 24)));
  const baseUrl = getOpenMeteoEnsembleUrl();

  const client = createApiClient({
    baseUrl,
    timeoutMs: 8000,
    retries: 2,
    retryDelayMs: 500,
  });

  const queryParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    models: model,
    hourly: 'precipitation',
    forecast_days: String(horizonDays),
    timezone,
  });

  const fullUrl = `${baseUrl}?${queryParams.toString()}`;
  const res = await client.get<unknown>(fullUrl);

  if (!res.ok || !res.data) {
    throw new Error(res.error || `Ensemble ${model} returned status ${res.status}`);
  }

  const { series } = normalizeOpenMeteoResponse(res.data, {
    cityId: options.cityId || 'amritsar',
    model,
    gridKm: 25,
    source: `Open-Meteo Ensemble (${model})`,
    isCached: false,
  });

  return series;
}

/**
 * Fetches ensemble forecasts following strict priority: ECMWF -> GFS -> Deterministic -> Degraded.
 */
export async function fetchEnsembleForecast(
  options: EnsembleFetchOptions = {}
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
      // Fallback if city config is not available
    }
  }

  lat = lat ?? DEFAULT_LAT;
  lon = lon ?? DEFAULT_LON;
  timezone = timezone ?? DEFAULT_TIMEZONE;
  const horizonDays = Math.min(16, Math.max(1, Math.ceil((options.horizonH || 48) / 24)));
  const ttl = getForecastTtl();

  const resolvedOptions: EnsembleFetchOptions = {
    ...options,
    cityId,
    lat,
    lon,
    timezone,
  };

  const cacheKey = `openmeteo:ensemble:${cityId}:${lat}:${lon}:${horizonDays}`;

  // 1. Check cache
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

  const fallbackNotes: string[] = [];

  // 2. Try ECMWF IFS first
  try {
    const ecmwfSeries = await fetchEnsembleModel('ecmwf_ifs025', resolvedOptions);
    recordSourceSuccess('Open-Meteo Ensemble (ECMWF)');
    await sharedCache.set(cacheKey, ecmwfSeries, ttl);
    return {
      status: 'ok',
      data: ecmwfSeries,
      provenance: ecmwfSeries.provenance,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordSourceFailure('Open-Meteo Ensemble (ECMWF)', errorMsg);
    fallbackNotes.push(`ECMWF IFS failed: ${errorMsg}`);
  }

  // 3. Fallback to GFS
  try {
    const gfsSeries = await fetchEnsembleModel('gfs025', resolvedOptions);
    recordSourceSuccess('Open-Meteo Ensemble (GFS)');
    gfsSeries.provenance.note = `${gfsSeries.provenance.note}; Fallback from ECMWF: ${fallbackNotes.join(', ')}`;
    await sharedCache.set(cacheKey, gfsSeries, ttl);
    return {
      status: 'ok',
      data: gfsSeries,
      provenance: gfsSeries.provenance,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordSourceFailure('Open-Meteo Ensemble (GFS)', errorMsg);
    fallbackNotes.push(`GFS failed: ${errorMsg}`);
  }

  // 4. Fallback to Deterministic forecast
  const detResult = await fetchDeterministicForecast(resolvedOptions);
  if (detResult.status === 'ok' && detResult.data) {
    const fallbackSeries: RainfallSeries = {
      ...detResult.data,
      members: undefined, // Explicitly no fake ensemble members
      provenance: {
        ...detResult.data.provenance,
        note: `Ensemble unavailable (${fallbackNotes.join('; ')}). Fallen back to deterministic forecast.`,
      },
    };
    return {
      status: 'ok',
      data: fallbackSeries,
      provenance: fallbackSeries.provenance,
      error: `Ensemble unavailable. Fallback to deterministic model.`,
    };
  }

  // 5. Degraded: no fake data
  const degradedProvenance: Provenance = {
    kind: 'derived',
    source: 'Open-Meteo Ensemble (Unavailable)',
    fetchedAt: new Date().toISOString(),
    note: `DEGRADED — All ensemble models and deterministic fallbacks failed: ${fallbackNotes.join('; ')}`,
  };

  return {
    status: 'degraded',
    provenance: degradedProvenance,
    error: fallbackNotes.join(' | '),
  };
}
