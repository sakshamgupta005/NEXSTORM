import { describe, it, expect } from 'vitest';
import {
  normalizeTimestampToIst,
  normalizeOpenMeteoResponse,
  calculateRainfallSummary,
  getImdRainfallCategory,
} from '@/lib/weather/normalize';
import fs from 'node:fs';
import path from 'node:path';

describe('Weather Normalization & Validation', () => {
  const forecastFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../fixtures/openmeteo/forecast.json'), 'utf-8')
  );
  const ensembleFixture = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../../fixtures/openmeteo/ensemble.json'), 'utf-8')
  );

  describe('Timestamp conversion to +05:30 IST', () => {
    it('converts local date-time strings to ISO with +05:30 offset', () => {
      const res = normalizeTimestampToIst('2026-10-14T00:00', 19800);
      expect(res).toBe('2026-10-14T00:00:00+05:30');
    });

    it('does not double-append offset if string already has offset or Z', () => {
      expect(normalizeTimestampToIst('2026-10-14T00:00:00+05:30')).toBe('2026-10-14T00:00:00+05:30');
      expect(normalizeTimestampToIst('2026-10-14T00:00:00Z')).toBe('2026-10-14T00:00:00Z');
    });

    it('handles seconds already in the input string', () => {
      const res = normalizeTimestampToIst('2026-10-14T15:30:45', 19800);
      expect(res).toBe('2026-10-14T15:30:45+05:30');
    });
  });

  describe('Deterministic forecast normalization', () => {
    it('normalizes valid forecast fixture correctly', () => {
      const { series, nullCount } = normalizeOpenMeteoResponse(forecastFixture, {
        cityId: 'amritsar',
        model: 'open_meteo_deterministic',
        gridKm: 9,
        source: 'Open-Meteo Deterministic',
      });

      expect(series.cityId).toBe('amritsar');
      expect(series.hours.length).toBe(forecastFixture.hourly.time.length);
      expect(series.deterministic).toBeDefined();
      expect(series.deterministic?.length).toBe(series.hours.length);
      expect(series.hours[0]).toContain('+05:30');
      expect(nullCount).toBe(0);
    });

    it('counts null values and reports them instead of silently ignoring', () => {
      const payloadWithNulls = {
        ...forecastFixture,
        hourly: {
          time: ['2026-10-14T00:00', '2026-10-14T01:00'],
          precipitation: [2.5, null],
        },
      };

      const { series, nullCount } = normalizeOpenMeteoResponse(payloadWithNulls, {
        cityId: 'amritsar',
        model: 'test',
        gridKm: 9,
        source: 'test',
      });

      expect(nullCount).toBe(1);
      expect(series.deterministic).toEqual([2.5, 0]);
    });

    it('rejects negative rainfall values', () => {
      const payloadWithNegatives = {
        ...forecastFixture,
        hourly: {
          time: ['2026-10-14T00:00'],
          precipitation: [-5.0],
        },
      };

      expect(() =>
        normalizeOpenMeteoResponse(payloadWithNegatives, {
          cityId: 'amritsar',
          model: 'test',
          gridKm: 9,
          source: 'test',
        })
      ).toThrow(/Invalid rainfall value/);
    });

    it('rejects non-finite rainfall values like NaN or Infinity', () => {
      const payloadWithInfinity = {
        ...forecastFixture,
        hourly: {
          time: ['2026-10-14T00:00'],
          precipitation: [Infinity],
        },
      };

      expect(() =>
        normalizeOpenMeteoResponse(payloadWithInfinity, {
          cityId: 'amritsar',
          model: 'test',
          gridKm: 9,
          source: 'test',
        })
      ).toThrow();
    });

    it('rejects mismatched array lengths between time and precipitation', () => {
      const mismatched = {
        ...forecastFixture,
        hourly: {
          time: ['2026-10-14T00:00', '2026-10-14T01:00'],
          precipitation: [1.2],
        },
      };

      expect(() =>
        normalizeOpenMeteoResponse(mismatched, {
          cityId: 'amritsar',
          model: 'test',
          gridKm: 9,
          source: 'test',
        })
      ).toThrow(/does not match/);
    });

    it('rejects malformed payload missing hourly field', () => {
      expect(() =>
        normalizeOpenMeteoResponse({}, {
          cityId: 'amritsar',
          model: 'test',
          gridKm: 9,
          source: 'test',
        })
      ).toThrow();
    });
  });

  describe('Ensemble forecast normalization', () => {
    it('normalizes valid multi-member ensemble fixture correctly', () => {
      const { series } = normalizeOpenMeteoResponse(ensembleFixture, {
        cityId: 'amritsar',
        model: 'ecmwf_ifs025',
        gridKm: 25,
        source: 'Open-Meteo Ensemble',
      });

      expect(series.members).toBeDefined();
      expect(series.members?.length).toBe(50); // 50 members (precipitation_member01..50)
      expect(series.deterministic).toBeDefined(); // control precipitation
      expect(series.members?.[0]?.length).toBe(series.hours.length);
    });

    it('handles empty ensemble members cleanly without fabrication', () => {
      const noMembers = {
        ...forecastFixture,
        hourly: {
          time: ['2026-10-14T00:00'],
          precipitation: [1.0],
        },
      };

      const { series } = normalizeOpenMeteoResponse(noMembers, {
        cityId: 'amritsar',
        model: 'test',
        gridKm: 9,
        source: 'test',
      });

      expect(series.members).toBeUndefined();
      expect(series.deterministic).toEqual([1.0]);
    });
  });

  describe('Rainfall summary calculations and IMD categorization', () => {
    it('calculates max1h and max24h trailing sums accurately', () => {
      // 30 hours of constant 2mm/h rain
      const hours = Array.from({ length: 30 }, (_, i) => `2026-10-14T${String(i % 24).padStart(2, '0')}:00:00+05:30`);
      const det = Array(30).fill(2); // 2mm each hour

      const summary = calculateRainfallSummary({
        cityId: 'amritsar',
        issueTime: hours[0],
        hours,
        deterministic: det,
        model: 'test',
        gridKm: 9,
        provenance: { kind: 'live', source: 'test' },
      });

      expect(summary.max1h).toBe(2);
      expect(summary.max24h).toBe(48); // 24 * 2mm = 48mm
      expect(summary.imdCategoryOfMax24h).toBe('Moderate Rain');
    });

    it('correctly maps IMD rainfall categories across boundaries', () => {
      expect(getImdRainfallCategory(0)).toBe('No Rain');
      expect(getImdRainfallCategory(1.5)).toBe('Very Light Rain');
      expect(getImdRainfallCategory(15.0)).toBe('Light Rain');
      expect(getImdRainfallCategory(50.0)).toBe('Moderate Rain');
      expect(getImdRainfallCategory(100.0)).toBe('Heavy Rain');
      expect(getImdRainfallCategory(150.0)).toBe('Very Heavy Rain');
      expect(getImdRainfallCategory(250.0)).toBe('Extremely Heavy Rain');
      expect(getImdRainfallCategory(null)).toBeNull();
    });
  });
});
