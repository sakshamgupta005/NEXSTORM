/**
 * src/lib/weather/types.ts
 * Type contracts and schemas for NEXSTORM weather adapters.
 */

import { z } from 'zod';
import type { Provenance } from '../risk/types';

export interface WeatherFetchOptions {
  cityId?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  horizonH?: number;
  skipCache?: boolean;
}

export const DEFAULT_WEATHER_COORDS = {
  lat: 31.63,
  lon: 74.87,
  timezone: 'Asia/Kolkata',
} as const;

export interface DataQualityMetadata {
  nullCount: number;
  completenessRatio: number;
  missingIndices: number[];
  policy: 'complete_unmodified' | 'imputed_zero_marked_degraded' | 'missing_intervals_flagged';
  isDegraded: boolean;
}

export interface RainfallSeries {
  cityId: string;
  issueTime: string; // ISO timestamp
  hours: string[]; // ISO timestamps including +05:30
  deterministic?: number[]; // mm/h
  members?: number[][]; // [member][hour], mm/h
  model: string;
  gridKm: number;
  provenance: Provenance;
  dataQuality?: DataQualityMetadata;
}

export interface SachetAlert {
  id: string;
  event: string;
  severity?: string;
  areaDescription?: string;
  areaCodes?: string[];
  effective?: string;
  expires?: string;
  link?: string;
  author?: string;
}

export interface WeatherSnapshot<T = RainfallSeries> {
  version: '1.0';
  savedAt: string; // ISO timestamp
  cityId: string;
  source: string;
  data: T;
}

export type WeatherStatus = 'ok' | 'degraded' | 'unavailable';

export interface WeatherAdapterResult<T> {
  status: WeatherStatus;
  data?: T;
  provenance: Provenance;
  nullCount?: number;
  error?: string;
}

export interface SourceHealthEntry {
  source: string;
  lastProbeTime?: string;
  lastSuccessTime?: string;
  lastFailureTime?: string;
  status: 'healthy' | 'degraded' | 'unknown';
  lastError?: string;
}

/**
 * Raw Open-Meteo Deterministic Forecast Zod Schema
 */
export const OpenMeteoHourlySchema = z.object({
  time: z.array(z.string()),
  precipitation: z.array(z.number().nullable()).optional(),
  rain: z.array(z.number().nullable()).optional(),
});

export const OpenMeteoForecastResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  generationtime_ms: z.number().optional(),
  utc_offset_seconds: z.number().default(0),
  timezone: z.string().optional(),
  timezone_abbreviation: z.string().optional(),
  elevation: z.number().optional(),
  hourly: z
    .object({
      time: z.array(z.string()),
    })
    .catchall(z.array(z.union([z.number(), z.null()]))),
  hourly_units: z.record(z.string(), z.string()).optional(),
});

export type OpenMeteoForecastResponse = z.infer<typeof OpenMeteoForecastResponseSchema>;

/**
 * Normalization Summary
 */
export interface RainfallSummary {
  max1h: number | null;
  max24h: number | null;
  imdCategoryOfMax24h: string | null;
}
