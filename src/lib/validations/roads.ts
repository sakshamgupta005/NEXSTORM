/**
 * src/lib/validations/roads.ts
 * Zod validation schemas for road risk queries and route evaluation endpoints.
 */

import { z } from 'zod'
import { spatialBboxFields } from './geo'

export const roadRiskQuerySchema = z.object({
  cityId: z.string().optional().default('amritsar'),
  ...spatialBboxFields,
  highway: z
    .union([
      z.string().transform((s) => s.split(',').map((x) => x.trim())),
      z.array(z.string()),
    ])
    .optional(),
  riskClass: z
    .union([
      z.enum(['low', 'moderate', 'high']),
      z.array(z.enum(['low', 'moderate', 'high'])),
    ])
    .optional(),
  hasObservation: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((val) => (typeof val === 'string' ? val === 'true' : val)),
  hasUnderpass: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((val) => (typeof val === 'string' ? val === 'true' : val)),
  isUnderpass: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((val) => (typeof val === 'string' ? val === 'true' : val)),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
  offset: z.coerce.number().min(0).optional().default(0),
})

export const candidateRouteSchema = z
  .object({
    routeId: z.string().min(1).max(100),
    name: z.string().max(200).optional(),
    description: z.string().max(500).optional(),
    segmentIds: z.array(z.string().min(1)).optional(),
    coordinates: z
      .array(z.tuple([z.number(), z.number()]))
      .min(2, 'Route coordinates must contain at least 2 points')
      .optional(),
  })
  .refine(
    (data) =>
      (data.segmentIds && data.segmentIds.length > 0) ||
      (data.coordinates && data.coordinates.length >= 2),
    {
      message:
        'Candidate route must contain either segmentIds or at least 2 coordinates',
    }
  )

export const routeCompareRequestSchema = z.object({
  cityId: z.string().optional().default('amritsar'),
  routes: z
    .array(candidateRouteSchema)
    .min(1, 'At least one candidate route is required for evaluation'),
})

export const routingPlanSchema = z.object({
  cityId: z.string().optional().default('amritsar'),
  origin: z
    .tuple([
      z.number().min(74.0).max(76.5, 'Origin longitude must be within Punjab study area (74.0 - 76.5)'),
      z.number().min(30.5).max(32.5, 'Origin latitude must be within Punjab study area (30.5 - 32.5)'),
    ]),
  destination: z
    .tuple([
      z.number().min(74.0).max(76.5, 'Destination longitude must be within Punjab study area (74.0 - 76.5)'),
      z.number().min(30.5).max(32.5, 'Destination latitude must be within Punjab study area (30.5 - 32.5)'),
    ]),
  originName: z.string().max(100).optional(),
  destinationName: z.string().max(100).optional(),
})

