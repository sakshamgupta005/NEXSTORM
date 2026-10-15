/**
 * src/lib/weather/normalize.ts
 * Validation, timestamp conversion, and normalization for Open-Meteo rainfall series.
 */

import type { RainfallSeries, RainfallSummary } from './types';
import { OpenMeteoForecastResponseSchema } from './types';
import type { Provenance } from '../risk/types';

/**
 * Converts a raw Open-Meteo local timestamp string into an ISO 8601 string with +05:30 offset.
 * Example input: "2026-10-14T00:00" -> "2026-10-14T00:00:00+05:30"
 * Avoids double-appending timezone if already present.
 */
export function normalizeTimestampToIst(timeStr: string, utcOffsetSeconds = 19800): string {
  if (typeof timeStr !== 'string') {
    throw new Error(`Invalid timestamp value: ${timeStr}`);
  }

  // Already includes offset (+XX:XX or Z)
  if (timeStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr;
  }

  // Pad seconds if missing (e.g., "2026-10-14T00:00" -> "2026-10-14T00:00:00")
  const parts = timeStr.split(':');
  const normalizedTime = parts.length === 2 ? `${timeStr}:00` : timeStr;

  // For Asia/Kolkata or +19800s, attach +05:30
  if (utcOffsetSeconds === 19800) {
    return `${normalizedTime}+05:30`;
  }

  // Generic offset calculation
  const sign = utcOffsetSeconds >= 0 ? '+' : '-';
  const abs = Math.abs(utcOffsetSeconds);
  const hours = String(Math.floor(abs / 3600)).padStart(2, '0');
  const mins = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
  return `${normalizedTime}${sign}${hours}:${mins}`;
}

/**
 * Converts any timestamp (UTC with 'Z', explicit offset, or unqualified) to exact IST (+05:30) ISO string.
 * Example: "2023-07-08T20:00:00Z" -> "2023-07-09T01:30:00+05:30"
 */
export function toIstTimestamp(timeStr: string, defaultUtcOffsetSeconds = 19800): string {
  if (typeof timeStr !== 'string' || !timeStr.trim()) {
    throw new Error(`Invalid timestamp value: ${timeStr}`);
  }

  const trimmed = timeStr.trim();

  // If already ending with +05:30, ensure seconds are padded and return
  if (trimmed.endsWith('+05:30')) {
    const withoutOffset = trimmed.slice(0, -6);
    const parts = withoutOffset.split(':');
    return (parts.length === 2 ? `${withoutOffset}:00` : withoutOffset) + '+05:30';
  }

  // If ends with Z or has another offset, parse as UTC Date and format in IST
  if (trimmed.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Unparseable timestamp: ${timeStr}`);
    }
    // Shift milliseconds by +05:30 (19,800,000 ms) and extract UTC components
    const istMs = parsed.getTime() + 19800 * 1000;
    const istDate = new Date(istMs);
    const iso = istDate.toISOString(); // e.g. 2023-07-09T01:30:00.000Z
    return `${iso.slice(0, 19)}+05:30`;
  }

  // Unqualified local string: if defaultUtcOffsetSeconds is GMT (0), treat as UTC
  if (defaultUtcOffsetSeconds === 0) {
    const parsed = new Date(`${trimmed}Z`);
    if (!isNaN(parsed.getTime())) {
      const istMs = parsed.getTime() + 19800 * 1000;
      const istDate = new Date(istMs);
      return `${istDate.toISOString().slice(0, 19)}+05:30`;
    }
  }

  // Otherwise treat as already in local time and attach +05:30
  return normalizeTimestampToIst(trimmed, 19800);
}

/**
 * Extracts the calendar date string (YYYY-MM-DD) in city local time (default: Asia/Kolkata).
 * Prevents timezone-shift errors where a UTC evening timestamp maps to the wrong local date.
 */
export function toCityDateString(isoOrLocal: string, _timezone: string = 'Asia/Kolkata'): string {
  void _timezone;
  const istIso = toIstTimestamp(isoOrLocal);
  return istIso.slice(0, 10);
}

export const toAmritsarDateString = toCityDateString;

export interface NormalizationOptions {
  cityId: string;
  model: string;
  gridKm: number;
  source: string;
  isCached?: boolean;
  ageSeconds?: number;
}

/**
 * Normalizes Open-Meteo forecast or ensemble response into a RainfallSeries.
 */
export function normalizeOpenMeteoResponse(
  raw: unknown,
  options: NormalizationOptions
): { series: RainfallSeries; nullCount: number } {
  const parsed = OpenMeteoForecastResponseSchema.parse(raw);
  const hourly = parsed.hourly;

  const rawTimes = hourly.time;
  if (!Array.isArray(rawTimes) || rawTimes.length === 0) {
    throw new Error('Upstream payload contains no hourly timestamps.');
  }

  const times = rawTimes.map((t) => String(t));
  const hoursCount = times.length;

  let nullCount = 0;
  const missingIndices: number[] = [];

  // Process deterministic series (key: 'precipitation' or fallback 'rain')
  let deterministic: number[] | undefined;
  const detKey = hourly.precipitation ? 'precipitation' : (hourly.rain ? 'rain' : undefined);

  if (detKey && Array.isArray(hourly[detKey])) {
    const rawDet = hourly[detKey];
    if (rawDet.length !== hoursCount) {
      throw new Error(`Timestamp count (${hoursCount}) does not match precipitation count (${rawDet.length}).`);
    }

    deterministic = rawDet.map((val, idx) => {
      if (val === null || val === undefined) {
        nullCount++;
        missingIndices.push(idx);
        return 0; // tracked and flagged explicitly in dataQuality
      }
      if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
        throw new Error(`Invalid rainfall value at index ${idx}: ${val}`);
      }
      return val;
    });
  }

  // Process ensemble members (keys matching /^precipitation_member\d+$/)
  const memberKeys = Object.keys(hourly)
    .filter((k) => /^precipitation_member\d+$/.test(k))
    .sort();

  let members: number[][] | undefined;
  if (memberKeys.length > 0) {
    members = memberKeys.map((key) => {
      const arr = hourly[key];
      if (!Array.isArray(arr) || arr.length !== hoursCount) {
        throw new Error(`Member ${key} length (${arr?.length}) does not match timestamp count (${hoursCount}).`);
      }
      return arr.map((val, idx) => {
        if (val === null || val === undefined) {
          nullCount++;
          if (!missingIndices.includes(idx)) missingIndices.push(idx);
          return 0;
        }
        if (typeof val !== 'number' || !Number.isFinite(val) || val < 0) {
          throw new Error(`Invalid member rainfall value for ${key} at index ${idx}: ${val}`);
        }
        return val;
      });
    });
  }

  const offset = parsed.utc_offset_seconds ?? 19800;
  const hours = times.map((t) => normalizeTimestampToIst(t, offset));

  let note = `${options.model} — Open-Meteo ${options.isCached ? 'cached snapshot' : 'live forecast'}`;
  if (nullCount > 0) {
    note += ` (DATA QUALITY WARNING: ${nullCount} missing forecast interval(s) imputed as 0 mm; marked as degraded)`;
  }

  const provenance: Provenance = {
    kind: options.isCached ? 'cached' : 'live',
    source: options.source,
    fetchedAt: new Date().toISOString(),
    ageSeconds: options.ageSeconds ?? 0,
    note,
  };

  const completenessRatio = hoursCount > 0 ? (hoursCount - Math.min(hoursCount, nullCount)) / hoursCount : 1.0;

  const series: RainfallSeries = {
    cityId: options.cityId,
    issueTime: hours[0] || new Date().toISOString(),
    hours,
    deterministic,
    members,
    model: options.model,
    gridKm: options.gridKm,
    provenance,
    dataQuality: {
      nullCount,
      completenessRatio: Math.round(completenessRatio * 10000) / 10000,
      missingIndices,
      policy: nullCount > 0 ? 'imputed_zero_marked_degraded' : 'complete_unmodified',
      isDegraded: nullCount > 0,
    },
  };

  return { series, nullCount };
}

/**
 * Evaluates official IMD 24-hour rainfall classification standard.
 * Reference: India Meteorological Department rainfall intensity thresholds.
 */
export function getImdRainfallCategory(mm24h: number | null): string | null {
  if (mm24h === null || mm24h < 0 || !Number.isFinite(mm24h)) return null;
  if (mm24h === 0) return 'No Rain';
  if (mm24h < 2.5) return 'Very Light Rain';
  if (mm24h <= 15.5) return 'Light Rain';
  if (mm24h <= 64.4) return 'Moderate Rain';
  if (mm24h <= 115.5) return 'Heavy Rain';
  if (mm24h <= 204.4) return 'Very Heavy Rain';
  return 'Extremely Heavy Rain';
}

/**
 * Calculates max1h, max24h, and IMD category from a validated RainfallSeries.
 */
export function calculateRainfallSummary(series?: RainfallSeries): RainfallSummary {
  if (!series) {
    return { max1h: null, max24h: null, imdCategoryOfMax24h: null };
  }

  const values: number[] = series.deterministic || (series.members?.[0] ?? []);
  if (values.length === 0) {
    return { max1h: null, max24h: null, imdCategoryOfMax24h: null };
  }

  let max1h = 0;
  for (const v of values) {
    if (v > max1h) max1h = v;
  }

  // Trailing 24-hour window accumulation
  let max24h = 0;
  for (let i = 0; i < values.length; i++) {
    const startIdx = Math.max(0, i - 23);
    let windowSum = 0;
    for (let j = startIdx; j <= i; j++) {
      windowSum += values[j] || 0;
    }
    if (windowSum > max24h) {
      max24h = windowSum;
    }
  }

  // Round to 2 decimal places
  const rounded1h = Math.round(max1h * 100) / 100;
  const rounded24h = Math.round(max24h * 100) / 100;

  return {
    max1h: rounded1h,
    max24h: rounded24h,
    imdCategoryOfMax24h: getImdRainfallCategory(rounded24h),
  };
}
