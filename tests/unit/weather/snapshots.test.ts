import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { saveSnapshot, loadSnapshot, getSnapshotFilePath } from '@/lib/weather/snapshots';
import type { RainfallSeries } from '@/lib/weather/types';
import fs from 'node:fs';

describe('Weather Snapshots Storage & Staleness Fallback', () => {
  const testCity = 'testcity';
  const filePath = getSnapshotFilePath(testCity);

  const sampleSeries: RainfallSeries = {
    cityId: testCity,
    issueTime: '2026-10-14T00:00:00+05:30',
    hours: ['2026-10-14T00:00:00+05:30'],
    deterministic: [5.2],
    model: 'test_model',
    gridKm: 9,
    provenance: { kind: 'live', source: 'Test Upstream' },
  };

  beforeEach(() => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  afterEach(() => {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  it('saves and reloads a valid snapshot with cached provenance', async () => {
    await saveSnapshot(testCity, 'Test Source', sampleSeries);
    expect(fs.existsSync(filePath)).toBe(true);

    const loaded = await loadSnapshot(testCity, 3600); // 1 hour max stale
    expect(loaded).not.toBeNull();
    expect(loaded?.series.cityId).toBe(testCity);
    expect(loaded?.series.provenance.kind).toBe('cached');
    expect(loaded?.series.provenance.ageSeconds).toBeDefined();
    expect(loaded?.series.deterministic).toEqual([5.2]);
  });

  it('rejects a snapshot that exceeds maximum staleness', async () => {
    // Write snapshot with savedAt 10 hours ago
    const oldDate = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
    const staleSnapshot = {
      version: '1.0',
      savedAt: oldDate,
      cityId: testCity,
      source: 'Old Source',
      data: sampleSeries,
    };

    fs.writeFileSync(filePath, JSON.stringify(staleSnapshot), 'utf-8');

    // maxStale = 3600s (1 hour)
    const result = await loadSnapshot(testCity, 3600);
    expect(result).toBeNull();
  });

  it('returns null safely when no snapshot file exists', async () => {
    const result = await loadSnapshot('nonexistent_city', 3600);
    expect(result).toBeNull();
  });

  it('handles corrupt JSON or malformed schema gracefully without throwing', async () => {
    fs.writeFileSync(filePath, 'NOT_VALID_JSON{:::broken', 'utf-8');

    const result = await loadSnapshot(testCity, 3600);
    expect(result).toBeNull();
  });

  it('handles snapshot missing required version or savedAt safely', async () => {
    fs.writeFileSync(filePath, JSON.stringify({ version: '9.9', foo: 'bar' }), 'utf-8');

    const result = await loadSnapshot(testCity, 3600);
    expect(result).toBeNull();
  });
});
