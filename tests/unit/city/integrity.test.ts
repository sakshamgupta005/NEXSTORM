import { describe, expect, it } from 'vitest'
import {
  computeCanonicalConfigHash,
  getCityConfig,
  getCitySusceptibility,
  validateSusceptibilityGeoJson,
  verifyConfigIntegrity,
  type CityConfig,
  type SusceptibilityGeoJson,
} from '@/lib/city/registry'

describe('City Configuration Integrity & Data Validation', () => {
  const FROZEN_CONFIG_HASH = '74f463261a4c15cdc850b8d5be687bee4e59fd2950b7b93395449f3dacefcd49'

  it('canonical config hash exactly matches Python reference hash', () => {
    const config = getCityConfig('amritsar')
    expect(config.configHash).toBe(FROZEN_CONFIG_HASH)

    const recomputed = computeCanonicalConfigHash(config as unknown as Record<string, unknown>)
    expect(recomputed).toBe(FROZEN_CONFIG_HASH)
  })

  it('rejects tampered configuration with an explicit error', () => {
    const config = getCityConfig('amritsar')
    const tampered: CityConfig = {
      ...config,
      thresholds: {
        ...config.thresholds,
        T1h: 99.9, // Unauthorized change
      },
    }

    expect(() => verifyConfigIntegrity(tampered)).toThrowError(
      /CONFIGURATION INTEGRITY ERROR: configHash mismatch/
    )
  })

  it('rejects configuration missing configHash attribute', () => {
    const config = getCityConfig('amritsar')
    const tampered = { ...config } as Partial<CityConfig>
    delete tampered.configHash

    expect(() => verifyConfigIntegrity(tampered as CityConfig)).toThrowError(
      /missing required 'configHash'/
    )
  })

  it('validates verified susceptibility GeoJSON without errors', () => {
    const geojson = getCitySusceptibility('amritsar')
    expect(geojson.type).toBe('FeatureCollection')
    expect(geojson.features.length).toBe(1998)
  })

  it('strictly rejects any feature with synthetic: true', () => {
    const fakeGeoJson: SusceptibilityGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[74.8, 31.6], [74.81, 31.6], [74.81, 31.61], [74.8, 31.6]]],
          },
          properties: {
            id: 'A-FAKE',
            s: 0.5,
            synthetic: true, // Forbidden in production
          },
        },
      ],
    }

    expect(() => validateSusceptibilityGeoJson(fakeGeoJson, 'amritsar')).toThrowError(
      /synthetic data is strictly rejected in production/
    )
  })

  it('strictly rejects malformed geometry or invalid susceptibility values', () => {
    const invalidSGeoJson: SusceptibilityGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [[[74.8, 31.6], [74.81, 31.6], [74.81, 31.61], [74.8, 31.6]]],
          },
          properties: {
            id: 'A-BAD-S',
            s: 1.5, // Out of bounds [0, 1]
            synthetic: false,
          },
        },
      ],
    }

    expect(() => validateSusceptibilityGeoJson(invalidSGeoJson, 'amritsar')).toThrowError(
      /invalid susceptibility score s/
    )
  })
})
