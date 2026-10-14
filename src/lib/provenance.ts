import type { Provenance } from './risk/types'

/**
 * Creates standardized provenance descriptor for simulated rainfall scenarios.
 */
export function createSimulatedRainfallProvenance(source: string = 'NEXSTORM Triangular Hyetograph Generator'): Provenance {
  return {
    kind: 'simulated',
    source,
    fetchedAt: new Date().toISOString(),
    note: 'DEMO DATA — Deterministic triangular hyetograph simulation for research and stress-testing.',
  }
}

/**
 * Creates standardized provenance descriptor for synthetic susceptibility grid.
 */
export function createSyntheticSusceptibilityProvenance(source: string = 'NEXSTORM Seeded Spatial Grid (250m)'): Provenance {
  return {
    kind: 'derived',
    source,
    fetchedAt: new Date().toISOString(),
    note: 'DEMO DATA — Synthetic seeded susceptibility baseline. Not verified municipal drainage or surveyed elevation data.',
  }
}

/**
 * Creates standardized provenance descriptor for relative risk calculation.
 */
export function createDerivedRiskProvenance(): Provenance {
  return {
    kind: 'derived',
    source: 'NEXSTORM Multi-Window RTI & Risk Matrix Engine v1.0',
    fetchedAt: new Date().toISOString(),
    note: 'DEMO DATA — Relative waterlogging risk estimate based on provisional thresholds.',
  }
}
