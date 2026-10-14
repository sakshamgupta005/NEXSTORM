/**
 * Unified AI Client Interface with Provider Adapters, Fallback & Bounded Repair
 * 
 * Capabilities:
 * - Modular provider adapters (Mock, OpenAI, Gemini, Groq)
 * - Safe schema validation via Zod with strictly bounded repair attempts
 * - Explicit fallback provider support without unexpected costs or silent switches
 * - Normalized errors, latency, and exact token usage accounting
 * - Falsy fixture handling (supports false, 0, null, "")
 */
import type {
  AIProvider,
  AIOptions,
  AIStructuredOptions,
  AIResult,
  AIProviderResponse,
  AIFallbackConfig,
  AIErrorDetail,
} from './types'
import { executeMock } from './adapters/mock'
import { executeOpenAICompatible } from './adapters/openai'
import { executeGemini } from './adapters/gemini'

export * from './types'

export function resolveProvider(requested?: AIProvider): AIProvider {
  if (requested) return requested
  if (process.env.OPENAI_API_KEY) return 'openai'
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return 'gemini'
  if (process.env.GROQ_API_KEY) return 'groq'
  return 'mock'
}

async function callAdapter(
  options: AIOptions,
  provider: AIProvider
): Promise<AIProviderResponse<string>> {
  switch (provider) {
    case 'mock':
      return executeMock(options)
    case 'openai':
    case 'groq':
      return executeOpenAICompatible(options, provider)
    case 'gemini':
      return executeGemini(options)
    default: {
      const errorDetail: AIErrorDetail = {
        code: 'UNSUPPORTED_PROVIDER',
        message: `Unsupported provider: ${provider}`,
        retryable: false,
      }
      return {
        success: false,
        error: errorDetail.message,
        errorDetail,
        provider,
        model: options.model ?? 'unknown',
        latencyMs: 0,
      }
    }
  }
}

/**
 * Generates plain text completion with optional explicit fallback support.
 */
export async function generateText(options: AIOptions): Promise<AIResult<string>> {
  const start = Date.now()
  const primaryProvider = resolveProvider(options.provider)

  // 1. Execute primary provider
  const primaryResponse = await callAdapter(
    { ...options, provider: primaryProvider },
    primaryProvider
  )

  // If primary succeeds OR no fallback is configured, return immediately
  if (primaryResponse.success || !options.fallback) {
    return {
      success: primaryResponse.success,
      data: primaryResponse.data,
      error: primaryResponse.error,
      errorDetail: primaryResponse.errorDetail,
      provider: primaryResponse.provider,
      model: primaryResponse.model,
      latencyMs: Date.now() - start,
      attempts: 1,
      fallbackAttempted: false,
      usage: primaryResponse.usage,
    }
  }

  // 2. Explicit Fallback Execution
  const fallbackConfig: AIFallbackConfig =
    typeof options.fallback === 'string'
      ? { provider: options.fallback }
      : options.fallback

  const fallbackOptions: AIOptions = {
    ...options,
    provider: fallbackConfig.provider,
    model: fallbackConfig.model,
    apiKey: fallbackConfig.apiKey,
    fallback: undefined, // Prevent recursive fallback
  }

  const fallbackResponse = await callAdapter(
    fallbackOptions,
    fallbackConfig.provider
  )

  return {
    success: fallbackResponse.success,
    data: fallbackResponse.data,
    error: fallbackResponse.error,
    errorDetail: fallbackResponse.errorDetail,
    provider: fallbackResponse.provider,
    model: fallbackResponse.model,
    latencyMs: Date.now() - start,
    attempts: 2,
    fallbackAttempted: true,
    primaryError: primaryResponse.error,
    usage: fallbackResponse.usage,
  }
}

function cleanMarkdownJson(raw: string): string {
  let clean = raw.trim()
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```json?\s*/i, '')
    if (clean.endsWith('```')) {
      clean = clean.slice(0, -3)
    }
    clean = clean.trim()
  }
  return clean
}

/**
 * Generates structured, type-safe data validated against a Zod schema.
 * Features strictly bounded repair attempts and falsy fixture support.
 */
export async function generateStructured<T>(
  options: AIStructuredOptions<T>
): Promise<AIResult<T>> {
  const start = Date.now()
  const primaryProvider = resolveProvider(options.provider)

  // Fast mock return - supports falsy values (false, 0, "", null)
  if (primaryProvider === 'mock') {
    if (options.mockResponse !== undefined) {
      return {
        success: true,
        data: options.mockResponse,
        provider: 'mock',
        model: options.model ?? 'mock-model',
        latencyMs: Date.now() - start,
        attempts: 1,
        fallbackAttempted: false,
      }
    }

    // Synthesize empty mock data from schema if possible
    try {
      const parsed = options.schema.parse({})
      return {
        success: true,
        data: parsed,
        provider: 'mock',
        model: options.model ?? 'mock-model',
        latencyMs: Date.now() - start,
        attempts: 1,
        fallbackAttempted: false,
      }
    } catch {
      const errorDetail: AIErrorDetail = {
        code: 'VALIDATION_ERROR',
        message: 'Mock provider requires options.mockResponse when schema has required fields.',
        retryable: false,
      }
      return {
        success: false,
        error: errorDetail.message,
        errorDetail,
        provider: 'mock',
        model: options.model ?? 'mock-model',
        latencyMs: Date.now() - start,
        attempts: 1,
        fallbackAttempted: false,
      }
    }
  }

  const schemaInstructions = `Return ONLY raw JSON matching this schema without markdown code fences or conversational explanation.`
  const prompt = `${options.prompt}\n\n${schemaInstructions}`

  let currentTextRes = await generateText({
    ...options,
    prompt,
  })

  if (!currentTextRes.success || !currentTextRes.data) {
    return {
      success: false,
      error: currentTextRes.error || 'Structured generation failed',
      errorDetail: currentTextRes.errorDetail,
      provider: currentTextRes.provider,
      model: currentTextRes.model,
      latencyMs: Date.now() - start,
      attempts: currentTextRes.attempts,
      fallbackAttempted: currentTextRes.fallbackAttempted,
      primaryError: currentTextRes.primaryError,
      repairAttempts: 0,
      usage: currentTextRes.usage,
    }
  }

  // Strictly bounded repair budget (max 2 attempts)
  const maxRepairs = Math.min(Math.max(0, options.maxRepairAttempts ?? 0), 2)
  let repairAttempts = 0
  let lastErrorDetail: AIErrorDetail | undefined

  while (repairAttempts <= maxRepairs) {
    const rawContent = currentTextRes.data ?? ''
    const cleanJson = cleanMarkdownJson(rawContent)

    try {
      const rawParsed = JSON.parse(cleanJson)
      const validated = options.schema.safeParse(rawParsed)

      if (validated.success) {
        return {
          success: true,
          data: validated.data,
          provider: currentTextRes.provider,
          model: currentTextRes.model,
          latencyMs: Date.now() - start,
          attempts: currentTextRes.attempts,
          fallbackAttempted: currentTextRes.fallbackAttempted,
          primaryError: currentTextRes.primaryError,
          repairAttempts,
          usage: currentTextRes.usage,
        }
      }

      const issueMessage = validated.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
      lastErrorDetail = {
        code: 'VALIDATION_ERROR',
        message: `Validation error: ${issueMessage}`,
        retryable: true,
      }
    } catch (parseError) {
      lastErrorDetail = {
        code: 'INVALID_RESPONSE',
        message: `Failed to parse response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        retryable: true,
      }
    }

    repairAttempts++

    if (repairAttempts <= maxRepairs) {
      const repairPrompt = `${options.prompt}\n\nYour previous output was invalid JSON or failed schema validation: ${lastErrorDetail.message}\nPlease fix it and return ONLY valid JSON matching the format.`
      currentTextRes = await generateText({
        ...options,
        prompt: repairPrompt,
      })

      if (!currentTextRes.success || !currentTextRes.data) {
        break
      }
    }
  }

  return {
    success: false,
    error: lastErrorDetail?.message || 'Structured validation failed',
    errorDetail: lastErrorDetail,
    provider: currentTextRes.provider,
    model: currentTextRes.model,
    latencyMs: Date.now() - start,
    attempts: currentTextRes.attempts,
    fallbackAttempted: currentTextRes.fallbackAttempted,
    primaryError: currentTextRes.primaryError,
    repairAttempts: Math.min(repairAttempts, maxRepairs),
    usage: currentTextRes.usage,
  }
}
