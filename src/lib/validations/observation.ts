/**
 * src/lib/validations/observation.ts
 * Zod validation schemas for waterlogging observation submissions and verifications.
 */

import { z } from 'zod'

// Amritsar Geographic Bounding Box Limits (with generous buffer for peri-urban areas)
export const AMRITSAR_BOUNDS = {
  minLat: 31.50,
  maxLat: 31.80,
  minLng: 74.70,
  maxLng: 75.05,
}

export const waterloggingCategorySchema = z.enum([
  'ponding',
  'street_flooding',
  'underpass_submersion',
  'drain_overflow',
  'receding_water',
])

export const waterloggingSeveritySchema = z.enum([
  'minor_curb',
  'moderate_ankle',
  'severe_knee_or_higher',
  'impassable_vehicles',
])

export const coordinatesSchema = z.object({
  lat: z
    .number()
    .min(AMRITSAR_BOUNDS.minLat, `Latitude must be >= ${AMRITSAR_BOUNDS.minLat} (Amritsar pilot bounds)`)
    .max(AMRITSAR_BOUNDS.maxLat, `Latitude must be <= ${AMRITSAR_BOUNDS.maxLat} (Amritsar pilot bounds)`),
  lng: z
    .number()
    .min(AMRITSAR_BOUNDS.minLng, `Longitude must be >= ${AMRITSAR_BOUNDS.minLng} (Amritsar pilot bounds)`)
    .max(AMRITSAR_BOUNDS.maxLng, `Longitude must be <= ${AMRITSAR_BOUNDS.maxLng} (Amritsar pilot bounds)`),
})

export const createObservationSchema = z.object({
  cityId: z.string().optional().default('amritsar'),
  coordinates: coordinatesSchema,
  observedAt: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'observedAt must be a valid ISO-8601 date string',
    })
    .refine((val) => Date.parse(val) <= Date.now() + 60_000, {
      message: 'observedAt cannot be in the future',
    })
    .refine((val) => Date.parse(val) >= Date.now() - 7 * 24 * 60 * 60 * 1000, {
      message: 'Community observations cannot be older than 7 days',
    }),
  category: waterloggingCategorySchema,
  severity: waterloggingSeveritySchema,
  description: z
    .string()
    .max(500, 'Description must not exceed 500 characters')
    .optional(),
  photoUrl: z
    .string()
    .max(2048, 'Photo URL is too long')
    .refine((val) => !val.startsWith('javascript:'), {
      message: 'Dangerous URL scheme rejected',
    })
    .optional(),
})

export const verifyObservationSchema = z.object({
  status: z.enum(['verified', 'rejected', 'under_review']),
  verifiedBy: z.string().min(2, 'verifiedBy identifier is required').max(100),
  verificationMethod: z.enum([
    'field_inspection',
    'traffic_police_notice',
    'news_report',
    'sensor_telemetry',
    'municipal_advisory',
  ]),
  verificationNotes: z.string().max(1000).optional(),
})

export const observationQuerySchema = z.object({
  cityId: z.string().optional().default('amritsar'),
  status: z
    .union([
      z.enum(['submitted', 'under_review', 'corroborated', 'verified', 'rejected', 'expired']),
      z.array(z.enum(['submitted', 'under_review', 'corroborated', 'verified', 'rejected', 'expired'])),
    ])
    .optional(),
  category: waterloggingCategorySchema.optional(),
  severity: waterloggingSeveritySchema.optional(),
  cellId: z.string().optional(),
  roadSegmentId: z.string().optional(),
  freshOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
  limit: z.coerce.number().min(1).max(200).optional().default(50),
})
