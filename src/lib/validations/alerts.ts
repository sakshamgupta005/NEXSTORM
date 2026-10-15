/**
 * src/lib/validations/alerts.ts
 * Zod validation schemas for subscriber registration, preview, and dispatch endpoints.
 */

import { z } from 'zod'

export const alertSensitivitySchema = z.enum([
  'high_sensitivity',
  'moderate_sensitivity',
  'high_risk',
  'extreme',
])

export const alertChannelSchema = z.enum(['email', 'sms', 'webhook'])

export const geofenceTargetSchema = z.object({
  type: z.enum(['citywide', 'cells', 'corridor', 'bbox']),
  cellIds: z.array(z.string().min(1)).optional(),
  roadCorridor: z.string().min(1).optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
})

export const quietHoursSchema = z.object({
  enabled: z.boolean().default(false),
  startLocalHour: z.number().int().min(0).max(23),
  endLocalHour: z.number().int().min(0).max(23),
  timezone: z.string().default('Asia/Kolkata'),
})

export const subscribeRequestSchema = z.object({
  cityId: z.string().optional().default('amritsar'),
  channel: alertChannelSchema,
  destination: z.string().min(3).max(256),
  sensitivity: alertSensitivitySchema.default('moderate_sensitivity'),
  geofence: geofenceTargetSchema.default({ type: 'citywide' }),
  quietHours: quietHoursSchema.optional(),
  isTestSubscriber: z.boolean().default(false),
})

export const unsubscribeRequestSchema = z.object({
  subscriberId: z.string().min(1),
})

export const previewAlertRequestSchema = z.object({
  cityId: z.string().optional().default('amritsar'),
  sensitivity: alertSensitivitySchema.optional().default('moderate_sensitivity'),
  peakMm1h: z.number().min(0).max(200).optional(),
  durationH: z.number().min(1).max(24).optional(),
  antecedentMm72h: z.number().min(0).max(500).optional(),
})

export const dispatchRequestSchema = z.object({
  cityId: z.string().optional().default('amritsar'),
  sensitivity: alertSensitivitySchema.optional(),
  peakMm1h: z.number().min(0).max(200).optional(),
  durationH: z.number().min(1).max(24).optional(),
  antecedentMm72h: z.number().min(0).max(500).optional(),
  forceTestProvider: z.boolean().optional().default(false),
})
