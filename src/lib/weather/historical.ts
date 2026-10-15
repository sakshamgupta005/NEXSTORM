import fs from 'node:fs';
import path from 'node:path';
import { createApiClient } from '../api/client';
import { normalizeOpenMeteoResponse, toIstTimestamp } from './normalize';
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

function validateDateRange(startDate: string, endDate: string): string | null {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(startDate)) return `Invalid startDate format '${startDate}', expected YYYY-MM-DD`;
  if (!dateRegex.test(endDate)) return `Invalid endDate format '${endDate}', expected YYYY-MM-DD`;
  if (startDate > endDate) return `Invalid date range: startDate '${startDate}' is after endDate '${endDate}'`;
  return null;
}

/**
 * Fetches historical reanalysis data (ERA5/ERA5-Land) from Open-Meteo Archive API.
 */
export async function fetchHistoricalArchive(
  options: HistoricalQueryOptions
): Promise<WeatherAdapterResult<RainfallSeries>> {
  const dateErr = validateDateRange(options.startDate, options.endDate);
  if (dateErr) {
    recordSourceFailure('Open-Meteo Archive', dateErr);
    return {
      status: 'degraded',
      provenance: {
        kind: 'replay',
        source: 'Open-Meteo Historical Archive (Invalid Request)',
        fetchedAt: new Date().toISOString(),
        note: `DEGRADED — ${dateErr}`,
      },
      error: dateErr,
    };
  }

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
  const dateErr = validateDateRange(options.startDate, options.endDate);
  if (dateErr) {
    recordSourceFailure('Open-Meteo Historical Forecast', dateErr);
    return {
      status: 'degraded',
      provenance: {
        kind: 'replay',
        source: 'Open-Meteo Historical Forecast (Invalid Request)',
        fetchedAt: new Date().toISOString(),
        note: `DEGRADED — ${dateErr}`,
      },
      error: dateErr,
    };
  }

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

export interface LocalArchiveOptions {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  warmupHours?: number; // Antecedent hours before startDate (e.g. 72)
}

/**
 * Loads Amritsar historical precipitation series from local ERA5-Land reanalysis cache (2010-2024).
 * Slices the requested range with optional warm-up period.
 * Does not make external network requests when the requested range is within the local cache.
 */
export function loadAmritsarHistoricalArchive(
  options: LocalArchiveOptions = {}
): WeatherAdapterResult<RainfallSeries> {
  const cachePath = path.resolve(process.cwd(), 'pipeline', 'cache', 'open_meteo_archive_jjas.json');

  if (!fs.existsSync(cachePath)) {
    return {
      status: 'degraded',
      provenance: {
        kind: 'replay',
        source: 'ERA5-Land Local Archive (Missing)',
        fetchedAt: new Date().toISOString(),
        note: `DEGRADED — Local historical archive not found at ${cachePath}`,
      },
      error: `Local archive file not found: ${cachePath}`,
    };
  }

  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const times: string[] = parsed.hourly.time;
    const precip: number[] = parsed.hourly.precipitation;

    let startIndex = 0;
    let endIndex = times.length - 1;

    if (options.startDate) {
      const targetStart = `${options.startDate}T00:00`;
      const idx = times.findIndex((t) => t >= targetStart);
      if (idx !== -1) {
        const warmup = options.warmupHours || 0;
        startIndex = Math.max(0, idx - warmup);
      }
    }

    if (options.endDate) {
      const targetEnd = `${options.endDate}T23:59`;
      for (let i = times.length - 1; i >= 0; i--) {
        if (times[i] <= targetEnd) {
          endIndex = i;
          break;
        }
      }
    }

    if (startIndex > endIndex) {
      return {
        status: 'degraded',
        provenance: {
          kind: 'replay',
          source: 'ERA5-Land Local Archive',
          fetchedAt: new Date().toISOString(),
          note: `DEGRADED — Empty interval for range ${options.startDate} to ${options.endDate}`,
        },
        error: `No records found in range ${options.startDate} to ${options.endDate}`,
      };
    }

    const slicedTimes = times.slice(startIndex, endIndex + 1);
    const slicedPrecip = precip.slice(startIndex, endIndex + 1);

    // Convert GMT/UTC timestamps to IST (+05:30)
    const hours = slicedTimes.map((t) => toIstTimestamp(t, parsed.utc_offset_seconds ?? 0));

    const series: RainfallSeries = {
      cityId: 'amritsar',
      issueTime: hours[0] || new Date().toISOString(),
      hours,
      deterministic: slicedPrecip,
      model: 'ECMWF ERA5-Land Reanalysis (Local Archive)',
      gridKm: 11,
      provenance: {
        kind: 'replay',
        source: 'ERA5-Land Reanalysis Hourly Archive (Amritsar 2010-2024)',
        fetchedAt: new Date().toISOString(),
        validFrom: options.startDate || slicedTimes[0],
        validTo: options.endDate || slicedTimes[slicedTimes.length - 1],
        note: `REPLAY/ARCHIVE — Local ERA5-Land reanalysis data (${hours.length} hours from ${hours[0]} to ${hours[hours.length - 1]})`,
      },
      dataQuality: {
        nullCount: 0,
        completenessRatio: 1.0,
        missingIndices: [],
        policy: 'complete_unmodified',
        isDegraded: false,
      },
    };

    return {
      status: 'ok',
      data: series,
      provenance: series.provenance,
      nullCount: 0,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      status: 'degraded',
      provenance: {
        kind: 'replay',
        source: 'ERA5-Land Local Archive (Corrupt)',
        fetchedAt: new Date().toISOString(),
        note: `DEGRADED — Failed to parse local archive: ${errorMsg}`,
      },
      error: errorMsg,
    };
  }
}
