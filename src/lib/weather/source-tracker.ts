/**
 * src/lib/weather/source-tracker.ts
 * In-memory source status and latency tracker for upstream health reporting.
 * Safe for use in health probes without initiating network requests.
 */

import type { SourceHealthEntry } from './types';

const sourceHealthMap = new Map<string, SourceHealthEntry>();

// Initialize default known sources
const KNOWN_SOURCES = [
  'Open-Meteo Forecast',
  'Open-Meteo Ensemble (ECMWF)',
  'Open-Meteo Ensemble (GFS)',
  'Open-Meteo Archive',
  'Open-Meteo Historical Forecast',
  'NDMA SACHET RSS',
];

for (const name of KNOWN_SOURCES) {
  sourceHealthMap.set(name, {
    source: name,
    status: 'unknown',
  });
}

export function recordSourceSuccess(source: string): void {
  const now = new Date().toISOString();
  const existing = sourceHealthMap.get(source) || { source, status: 'unknown' };
  sourceHealthMap.set(source, {
    ...existing,
    source,
    lastProbeTime: now,
    lastSuccessTime: now,
    status: 'healthy',
    lastError: undefined,
  });
}

export function recordSourceFailure(source: string, error: string): void {
  const now = new Date().toISOString();
  const existing = sourceHealthMap.get(source) || { source, status: 'unknown' };
  sourceHealthMap.set(source, {
    ...existing,
    source,
    lastProbeTime: now,
    lastFailureTime: now,
    status: 'degraded',
    lastError: error,
  });
}

export function getSourceHealthSummary(): Record<string, SourceHealthEntry> {
  const out: Record<string, SourceHealthEntry> = {};
  for (const [key, val] of sourceHealthMap.entries()) {
    out[key] = { ...val };
  }
  return out;
}

export function resetSourceHealth(): void {
  for (const name of KNOWN_SOURCES) {
    sourceHealthMap.set(name, {
      source: name,
      status: 'unknown',
    });
  }
}
