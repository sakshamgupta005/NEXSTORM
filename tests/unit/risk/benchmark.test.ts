import { describe, expect, it } from 'vitest'
import { computeRiskGrid, computeTimeline } from '@/lib/risk/engine'
import type { CityConfig, SusceptibilityFeature, SusceptibilityGeoJson } from '@/lib/city/registry'
import type { RainfallSeries } from '@/lib/weather/types'

describe('Engine Performance Benchmark', () => {
  it('computes 51 members x 2500 cells x 48 hours in under 1.5 seconds', () => {
    const NUM_MEMBERS = 51
    const NUM_CELLS = 2500
    const NUM_HOURS = 48

    // 1. Create realistic dummy config
    const config: CityConfig = {
      id: 'amritsar',
      name: 'Amritsar',
      bbox: [74.8, 31.575, 74.935, 31.685],
      gridSizeM: 250,
      cellCount: NUM_CELLS,
      weights: {
        depression: 0.3,
        flatness: 0.1,
        builtUp: 0.3,
        lowPoint: 0.15,
        densityProxy: 0.15,
      },
      terrainOverride: { applied: false, reason: 'none', std: 1.5 },
      sBandCutoffs: [0.33, 0.66],
      rtiBandCutoffs: [0.5, 1.0, 1.5],
      matrix: [
        ['low', 'low', 'low'],
        ['low', 'low', 'moderate'],
        ['low', 'moderate', 'high'],
        ['moderate', 'high', 'high'],
      ],
      thresholds: {
        T1h: 3.5,
        T3h: 8.9,
        T24h: 64.5,
        T72h: 44.8,
        provisional: false,
      },
      displayThreshold: 0.4,
      confidenceCutoffs: [0.8, 0.5],
      sources: ['Benchmark'],
      version: '1.0.0',
      configHash: 'benchmark_hash',
    }

    // 2. Create 2,500 susceptibility features
    const features: SusceptibilityFeature[] = new Array(NUM_CELLS)
    for (let i = 0; i < NUM_CELLS; i++) {
      const s = (i % 100) / 100 // distributed 0..0.99
      features[i] = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [74.8, 31.6],
              [74.81, 31.6],
              [74.81, 31.61],
              [74.8, 31.61],
              [74.8, 31.6],
            ],
          ],
        },
        properties: {
          id: `B-${String(i).padStart(4, '0')}`,
          s,
          synthetic: false,
        },
      }
    }

    const susceptibility: SusceptibilityGeoJson = {
      type: 'FeatureCollection',
      features,
    }

    // 3. Create 51 ensemble members x 48 hours
    const members: number[][] = []
    for (let m = 0; m < NUM_MEMBERS; m++) {
      const memberSeries = new Array(NUM_HOURS)
      for (let h = 0; h < NUM_HOURS; h++) {
        // Pseudo-random rainfall pulse
        memberSeries[h] = Math.max(0, Math.sin(m * 0.1 + h * 0.2) * 5.0)
      }
      members.push(memberSeries)
    }

    const series: RainfallSeries = {
      cityId: 'amritsar',
      issueTime: '2026-10-14T10:00:00Z',
      hours: Array.from({ length: NUM_HOURS }, (_, h) => `2026-10-14T${String(h).padStart(2, '0')}:00:00Z`),
      members,
      model: 'benchmark_ensemble',
      gridKm: 25,
      provenance: {
        kind: 'simulated',
        source: 'benchmark',
      },
    }

    // 4. Measure execution
    const startTime = performance.now()

    // Timeline calculation across all 48 hours
    const timeline = computeTimeline(series, config, susceptibility)
    expect(timeline.length).toBe(NUM_HOURS)

    // Full grid calculations across ALL 48 hours
    for (let h = 0; h < NUM_HOURS; h++) {
      const gridResult = computeRiskGrid({
        config,
        susceptibility,
        series,
        hourIndex: h,
      })
      expect(gridResult.cells.length).toBe(NUM_CELLS)
      expect(gridResult.hasEnsemble).toBe(true)
    }

    const durationMs = performance.now() - startTime
    console.log(
      `[PERFORMANCE BENCHMARK] 51 members x 2500 cells x 48 hours completed in ${durationMs.toFixed(2)}ms (Target: < 1500ms, Node ${process.version})`
    )

    // Verify under 1.5 seconds (1500 ms)
    expect(durationMs).toBeLessThan(1500)
  })
})
