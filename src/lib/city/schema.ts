/**
 * src/lib/city/schema.ts
 * Strict Zod validation schemas for City Configuration Contracts in NEXSTORM.
 * Rejects malformed bounding boxes, invalid coordinate systems, unnormalized weights,
 * and inconsistent matrix structures.
 */

import { z } from 'zod'

export const cityReadinessStateSchema = z.enum([
  'configuration_only',
  'data_bootstrapped',
  'model_generated',
  'evidence_insufficient',
  'evaluation_ready',
  'pilot_eligible',
])

export const boundingBoxSchema = z
  .tuple([z.number(), z.number(), z.number(), z.number()])
  .refine(
    ([minLon, minLat, maxLon, maxLat]) => {
      return (
        minLon < maxLon &&
        minLat < maxLat &&
        minLon >= -180 &&
        maxLon <= 180 &&
        minLat >= -90 &&
        maxLat <= 90
      )
    },
    {
      message: 'Bounding box must be strictly [minLon, minLat, maxLon, maxLat] within valid geographic limits',
    }
  )

export const cityConfigSchema = z
  .object({
    id: z
      .string()
      .min(2)
      .max(32)
      .regex(/^[a-z0-9_-]+$/, 'City ID must contain only lowercase alphanumeric characters, dashes, or underscores'),
    name: z.string().min(2).max(128),
    state: z.string().optional().default('Punjab'),
    country: z.string().optional().default('India'),
    timezone: z.string().optional().default('Asia/Kolkata'),
    locale: z.string().optional().default('en-IN'),
    bbox: boundingBoxSchema,
    center: z.tuple([z.number(), z.number()]).optional(),
    crs: z.string().optional().default('EPSG:4326'),
    utmCrs: z.string().optional().default('EPSG:32643'),
    gridSizeM: z.number().int().positive().max(1000),
    cellCount: z.number().int().positive(),
    readinessState: cityReadinessStateSchema.optional().default('configuration_only'),
    weights: z
      .object({
        depression: z.number().min(0).max(1),
        flatness: z.number().min(0).max(1),
        builtUp: z.number().min(0).max(1),
        lowPoint: z.number().min(0).max(1),
        densityProxy: z.number().min(0).max(1),
      })
      .passthrough()
      .refine(
        (w) => {
          const sum = w.depression + w.flatness + w.builtUp + w.lowPoint + w.densityProxy
          return Math.abs(sum - 1.0) < 0.001
        },
        { message: 'Susceptibility feature weights must sum to 1.0 ± 0.001' }
      ),
    terrainOverride: z.object({
      applied: z.boolean(),
      reason: z.string(),
      std: z.number().nonnegative(),
    }),
    sBandCutoffs: z
      .tuple([z.number().positive(), z.number().positive()])
      .refine(([low, high]) => low < high && high < 1.0, {
        message: 'sBandCutoffs must be strictly increasing in range (0, 1)',
      }),
    rtiBandCutoffs: z
      .tuple([z.number().positive(), z.number().positive(), z.number().positive()])
      .refine(([r1, r2, r3]) => r1 < r2 && r2 < r3, {
        message: 'rtiBandCutoffs must be strictly increasing positive numbers',
      }),
    matrix: z.array(z.array(z.enum(['low', 'moderate', 'high']))).length(4),
    thresholds: z.object({
      T1h: z.number().positive(),
      T3h: z.number().positive(),
      T24h: z.number().positive(),
      T72h: z.number().positive(),
      provisional: z.boolean().optional(),
      derivedFrom: z.string().optional(),
      span: z.string().optional(),
    }),
    displayThreshold: z.number().min(0).max(1),
    confidenceCutoffs: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    sources: z.array(z.string()).min(1),
    provenance: z
      .object({
        demSource: z.string().optional(),
        landCoverSource: z.string().optional(),
        osmSource: z.string().optional(),
        weatherSource: z.string().optional(),
        incidentSource: z.string().optional(),
        bootstrappedAt: z.string().optional(),
      })
      .optional(),
    operationalStatus: z
      .object({
        alertsAllowed: z.boolean(),
        rolloutModeDefault: z.enum(['evaluation_only', 'test_mode', 'canary', 'general_availability']),
        restrictionsNote: z.string().optional(),
      })
      .optional(),
    version: z.string().default('1.0.0'),
    configHash: z.string().min(64).max(64),
  })

export type ValidatedCityConfig = z.infer<typeof cityConfigSchema>
