/**
 * src/lib/weather/snapshots.ts
 * Manages versioned local snapshot storage and staleness fallbacks under public/data/snapshots/
 */

import fs from 'node:fs';
import path from 'node:path';
import type { RainfallSeries, WeatherSnapshot } from './types';
import { logger } from '../logging/logger';

const SNAPSHOT_DIR = path.resolve(process.cwd(), 'public', 'data', 'snapshots');

function ensureSnapshotDir(): void {
  try {
    if (!fs.existsSync(SNAPSHOT_DIR)) {
      fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
    }
  } catch (err) {
    logger.warn('Failed to ensure snapshot directory exists:', { error: String(err) });
  }
}

export function getSnapshotFilePath(cityId: string): string {
  return path.join(SNAPSHOT_DIR, `${cityId.toLowerCase()}-rainfall.json`);
}

/**
 * Saves a validated RainfallSeries as a versioned snapshot.
 */
export async function saveSnapshot(cityId: string, source: string, series: RainfallSeries): Promise<void> {
  ensureSnapshotDir();
  const filePath = getSnapshotFilePath(cityId);

  const snapshot: WeatherSnapshot<RainfallSeries> = {
    version: '1.0',
    savedAt: new Date().toISOString(),
    cityId,
    source,
    data: series,
  };

  try {
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch (err) {
    logger.warn(`Failed to write snapshot to ${filePath}:`, { error: String(err) });
  }
}

/**
 * Loads a cached snapshot if it exists and satisfies the maximum staleness limit.
 * Gracefully handles missing files, unparseable JSON, or corrupted structures.
 */
export async function loadSnapshot(
  cityId: string,
  maxStaleSeconds = 21600 // 6 hours default
): Promise<{ series: RainfallSeries; ageSeconds: number } | null> {
  const filePath = getSnapshotFilePath(cityId);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as WeatherSnapshot<RainfallSeries>;

    if (!parsed || parsed.version !== '1.0' || !parsed.savedAt || !parsed.data) {
      logger.warn(`Corrupted snapshot file rejected at ${filePath}`);
      return null;
    }

    const savedEpoch = Date.parse(parsed.savedAt);
    if (isNaN(savedEpoch)) {
      logger.warn(`Invalid savedAt timestamp in snapshot at ${filePath}`);
      return null;
    }

    if (savedEpoch > Date.now() + 60000) {
      logger.warn(`Future savedAt timestamp in snapshot at ${filePath} (${parsed.savedAt}); rejecting.`);
      return null;
    }

    const ageSeconds = Math.max(0, Math.floor((Date.now() - savedEpoch) / 1000));

    if (ageSeconds > maxStaleSeconds) {
      logger.warn(`Snapshot at ${filePath} is stale (${ageSeconds}s > ${maxStaleSeconds}s).`);
      return null;
    }

    // Attach cached provenance with accurate age
    const cachedSeries: RainfallSeries = {
      ...parsed.data,
      provenance: {
        ...parsed.data.provenance,
        kind: 'cached',
        ageSeconds,
        note: `Cached snapshot (${ageSeconds}s old) from ${parsed.source}`,
      },
    };

    return { series: cachedSeries, ageSeconds };
  } catch (err) {
    logger.warn(`Failed to read or parse snapshot at ${filePath}:`, { error: String(err) });
    return null;
  }
}
