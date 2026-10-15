/**
 * src/lib/validations/geo.ts
 * Shared geospatial validation schemas and parameter transforms.
 */

import { z } from 'zod'

/**
 * Validates a bounding box supplied either as a comma-separated string ("minLng,minLat,maxLng,maxLat")
 * or a 4-number tuple.
 */
export const bboxParamSchema = z
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
  .optional()

/**
 * Shared coordinate boundary fields for spatial queries.
 */
export const spatialBboxFields = {
  bbox: bboxParamSchema,
  minLng: z.coerce.number().min(74.0).max(76.0).optional(),
  minLat: z.coerce.number().min(31.0).max(33.0).optional(),
  maxLng: z.coerce.number().min(74.0).max(76.0).optional(),
  maxLat: z.coerce.number().min(31.0).max(33.0).optional(),
}
