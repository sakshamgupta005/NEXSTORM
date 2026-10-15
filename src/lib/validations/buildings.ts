/**
 * src/lib/validations/buildings.ts
 * Zod validation schemas for building-level exposure queries.
 */

import { z } from 'zod'

export const buildingQuerySchema = z.object({
  cityId: z.string().optional().default('amritsar'),
  cellId: z.string().regex(/^[A-Za-z0-9_-]+$/, 'Invalid cellId format').optional(),
  bbox: z
    .union([
      z.string().transform((str, ctx) => {
        const parts = str.split(',').map((x) => parseFloat(x.trim()))
        if (parts.length !== 4 || parts.some((n) => isNaN(n))) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'bbox must be 4 comma-separated numbers: minLng,minLat,maxLng,maxLat',
          })
          return z.NEVER
        }
        return parts as [number, number, number, number]
      }),
      z.tuple([z.number(), z.number(), z.number(), z.number()]),
    ])
    .optional(),
  minLng: z.coerce.number().min(74.0).max(76.0).optional(),
  minLat: z.coerce.number().min(31.0).max(33.0).optional(),
  maxLng: z.coerce.number().min(74.0).max(76.0).optional(),
  maxLat: z.coerce.number().min(31.0).max(33.0).optional(),
  exposureCategory: z
    .union([
      z.enum(['high_catchment', 'moderate_catchment', 'low_catchment', 'unmatched']),
      z.array(z.enum(['high_catchment', 'moderate_catchment', 'low_catchment', 'unmatched'])),
    ])
    .optional(),
  minAreaM2: z.coerce.number().min(0).optional(),
  maxAreaM2: z.coerce.number().min(0).optional(),
  limit: z.coerce.number().min(1).max(500).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
})
