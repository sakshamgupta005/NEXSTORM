/**
 * src/lib/weather/historical.ts
 * Historical weather and reanalysis adapters for offline replay, validation, and calibration.
 * NOTE: For offline analysis and future evaluation only; not for live forecasting.
 */

import { createApiClient } from '../api/client';
import { normalizeOpenMeteoResponse } from './normalize';
import { recordSourceSuccess, recordSourceFailure } from './source-tracker';
import type { RainfallSeries, WeatherAdapterResult } from './types';
import type { Provenance } from '../risk/types';

export interface HistoricalQueryOptions {
  cityId?: string;
  lat?: number;
  lon?: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timezone?: string;
}

const DEFAULT_LAT = 31.63;
const DEFAULT_LON = 74.87;
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function getOpenMeteoArchiveUrl(): string {
  return process.env.OPENMETEO_ARCHIVE_URL || 'https://archive-api.open-meteo.com/v1/archive';
}

/**
 * Fetches historical reanalysis data (ERA5/ERA5-Land) from Open-Meteo Archive API.
 */
export async function fetchHistoricalArchive(
  options: HistoricalQueryOptions
): Promise<WeatherAdapterResult<RainfallSeries>> {
  const cityId = options.cityId || 'amritsar';
  const lat = options.lat ?? DEFAULT_LAT;
  const lon = options.lon ?? DEFAULT_LON;
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const baseUrl = getOpenMeteoArchiveUrl();

  const client = createApiClient({
    baseUrl,
    timeoutMs: 10000,
    retries: 2,
    retryDelayMs: 500,
  });

  const queryParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: options.startDate,
    end_date: options.endDate,
    hourly: 'precipitation',
    timezone,
  });

  const fullUrl = `${baseUrl}?${queryParams.toString()}`;

  try {
    const res = await client.get<unknown>(fullUrl);

    if (!res.ok || !res.data) {
      throw new Error(res.error || `Archive API returned status ${res.status}`);
    }

    const { series, nullCount } = normalizeOpenMeteoResponse(res.data, {
      cityId,
      model: 'era5_reanalysis_archive',
      gridKm: 11,
      source: 'Open-Meteo Historical Archive API (ERA5 Reanalysis)',
      isCached: false,
    });

    const historicalSeries: RainfallSeries = {
      ...series,
      provenance: {
        kind: 'replay',
        source: 'Open-Meteo Historical Archive (ERA5)',
        fetchedAt: new Date().toISOString(),
        validFrom: options.startDate,
        validTo: options.endDate,
        note: `REPLAY/ARCHIVE — Observed reanalysis data from ${options.startDate} to ${options.endDate}`,
      },
    };

    recordSourceSuccess('Open-Meteo Archive');
    return {
      status: 'ok',
      data: historicalSeries,
      provenance: historicalSeries.provenance,
      nullCount,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordSourceFailure('Open-Meteo Archive', errorMsg);

    const degradedProvenance: Provenance = {
      kind: 'replay',
      source: 'Open-Meteo Historical Archive (Unavailable)',
      fetchedAt: new Date().toISOString(),
      note: `DEGRADED — Failed to fetch historical archive: ${errorMsg}`,
    };

    return {
      status: 'degraded',
      provenance: degradedProvenance,
      error: errorMsg,
    };
  }
}

/**
 * Fetches archived historical forecast predictions from Open-Meteo Historical Forecast API.
 */
export async function fetchHistoricalForecast(
  options: HistoricalQueryOptions
): Promise<WeatherAdapterResult<RainfallSeries>> {
  const cityId = options.cityId || 'amritsar';
  const lat = options.lat ?? DEFAULT_LAT;
  const lon = options.lon ?? DEFAULT_LON;
  const timezone = options.timezone || DEFAULT_TIMEZONE;
  const baseUrl = 'https://historical-forecast-api.open-meteo.com/v1/forecast';

  const client = createApiClient({
    baseUrl,
    timeoutMs: 10000,
    retries: 2,
    retryDelayMs: 500,
  });

  const queryParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: options.startDate,
    end_date: options.endDate,
    hourly: 'precipitation',
    timezone,
  });

  const fullUrl = `${baseUrl}?${queryParams.toString()}`;

  try {
    const res = await client.get<unknown>(fullUrl);

    if (!res.ok || !res.data) {
      throw new Error(res.error || `Historical Forecast API returned status ${res.status}`);
    }

    const { series, nullCount } = normalizeOpenMeteoResponse(res.data, {
      cityId,
      model: 'historical_forecast_run',
      gridKm: 11,
      source: 'Open-Meteo Historical Forecast API',
      isCached: false,
    });

    const historicalSeries: RainfallSeries = {
      ...series,
      provenance: {
        kind: 'replay',
        source: 'Open-Meteo Historical Forecasts',
        fetchedAt: new Date().toISOString(),
        validFrom: options.startDate,
        validTo: options.endDate,
        note: `REPLAY — Archived numerical forecasts issued for ${options.startDate} to ${options.endDate}`,
      },
    };

    recordSourceSuccess('Open-Meteo Historical Forecast');
    return {
      status: 'ok',
      data: historicalSeries,
      provenance: historicalSeries.provenance,
      nullCount,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    recordSourceFailure('Open-Meteo Historical Forecast', errorMsg);

    const degradedProvenance: Provenance = {
      kind: 'replay',
      source: 'Open-Meteo Historical Forecast (Unavailable)',
      fetchedAt: new Date().toISOString(),
      note: `DEGRADED — Failed to fetch historical forecast: ${errorMsg}`,
    };

    return {
      status: 'degraded',
      provenance: degradedProvenance,
      error: errorMsg,
    };
  }
}
