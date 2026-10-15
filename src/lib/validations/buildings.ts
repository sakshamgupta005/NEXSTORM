/**
 * src/lib/validations/buildings.ts
 * Zod validation schemas for building-level exposure queries.
 */

import { z } from 'zod'
import { spatialBboxFields } from './geo'

export const buildingQuerySchema = z.object({
  cityId: z.string().optional().default('amritsar'),
  cellId: z.string().regex(/^[A-Za-z0-9_-]+$/, 'Invalid cellId format').optional(),
  ...spatialBboxFields,
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
