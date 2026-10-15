import { z } from 'zod'

export interface StructuredOutputValidationResult<T> {
  success: boolean
  data?: T
  error?: string
  rawExtractedJson?: unknown
  format: 'json_raw' | 'json_markdown' | 'invalid'
}

export interface CitationGroundingResult {
  grounded: boolean
  citationCount: number
  citations: string[]
  groundingScore: number
  unsupportedClaims: string[]
}

export function validateStructuredOutput<T>(
  rawOutput: unknown,
  schema: z.ZodType<T>
): StructuredOutputValidationResult<T> {
  if (typeof rawOutput !== 'string' && typeof rawOutput !== 'object') {
    return {
      success: false,
      error: `Expected string or object, got ${typeof rawOutput}`,
      format: 'invalid',
    }
  }

  let jsonCandidate = rawOutput
  let format: 'json_raw' | 'json_markdown' | 'invalid' = 'json_raw'

  if (typeof rawOutput === 'string') {
    const trimmed = rawOutput.trim()
    const markdownMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
    if (markdownMatch) {
      format = 'json_markdown'
      try {
        jsonCandidate = JSON.parse(markdownMatch[1])
      } catch (err: unknown) {
        return {
          success: false,
          error: `Failed to parse markdown-wrapped JSON: ${(err as Error).message}`,
          format: 'json_markdown',
        }
      }
    } else {
      try {
        jsonCandidate = JSON.parse(trimmed)
      } catch (err: unknown) {
        return {
          success: false,
          error: `Failed to parse raw JSON: ${(err as Error).message}`,
          format: 'invalid',
        }
      }
    }
  }

  const parseResult = schema.safeParse(jsonCandidate)
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.message,
      rawExtractedJson: jsonCandidate,
      format,
    }
  }

  return {
    success: true,
    data: parseResult.data,
    rawExtractedJson: jsonCandidate,
    format,
  }
}

export function evaluateCitationGrounding(
  response: string,
  sourceDocuments: string[]
): CitationGroundingResult {
  const citationPattern = /\[(\d+|doc[-_]?[a-zA-Z0-9]+|source[-_]?[a-zA-Z0-9]+)\]/g
  const matches = response.match(citationPattern) || []
  const uniqueCitations = Array.from(new Set(matches))

  const combinedSource = sourceDocuments.join(' ').toLowerCase()
  const sourceWords = new Set(
    combinedSource
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  )

  const sentences = response
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)

  let supportedSentences = 0
  const unsupportedClaims: string[] = []

  for (const sentence of sentences) {
    const sentenceWords = sentence
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)

    if (sentenceWords.length === 0) {
      supportedSentences++
      continue
    }

    const overlapCount = sentenceWords.filter((w) => sourceWords.has(w)).length
    const overlapRatio = overlapCount / sentenceWords.length
    const hasCitation = citationPattern.test(sentence)

    if (overlapRatio >= 0.3 || hasCitation) {
      supportedSentences++
    } else {
      unsupportedClaims.push(sentence)
    }
  }

  const total = sentences.length || 1
  const groundingScore = Math.round((supportedSentences / total) * 100) / 100
  const grounded = groundingScore >= 0.7

  return {
    grounded,
    citationCount: uniqueCitations.length,
    citations: uniqueCitations,
    groundingScore,
    unsupportedClaims,
  }
}
