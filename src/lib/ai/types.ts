/**
 * Unified AI Provider Types & Normalization Contracts
 */

import { z } from 'zod'

export type AIProvider = 'mock' | 'openai' | 'gemini' | 'groq'

export type AIErrorCode =
  | 'MISSING_API_KEY'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED_PROVIDER'
  | 'UPSTREAM_ERROR'

export interface AIErrorDetail {
  code: AIErrorCode
  message: string
  status?: number
  retryable?: boolean
}

export interface AIUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface AIFallbackConfig {
  provider: AIProvider
  model?: string
  apiKey?: string
}

export interface AIOptions {
  prompt: string
  system?: string
  provider?: AIProvider
  model?: string
  temperature?: number
  apiKey?: string
  timeoutMs?: number
  /** Explicit fallback provider or configuration if the primary provider fails */
  fallback?: AIProvider | AIFallbackConfig
}

export interface AIStructuredOptions<T> extends AIOptions {
  schema: z.ZodType<T>
  schemaName?: string
  mockResponse?: T
  /** Strictly bounded number of repair attempts for invalid JSON / schema mismatches (max 2) */
  maxRepairAttempts?: number
}

export interface AIProviderResponse<T = string> {
  success: boolean
  data?: T
  error?: string
  errorDetail?: AIErrorDetail
  provider: AIProvider
  model: string
  latencyMs: number
  usage?: AIUsage
}

export interface AIResult<T = string> {
  success: boolean
  data?: T
  error?: string
  errorDetail?: AIErrorDetail
  provider: AIProvider
  model: string
  latencyMs: number
  attempts: number
  fallbackAttempted: boolean
  primaryError?: string
  repairAttempts?: number
  usage?: AIUsage
}
