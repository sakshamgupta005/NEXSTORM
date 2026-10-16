/**
 * Standard AI Model Pricing & Cost Estimation
 */

export const KNOWN_MODEL_PRICING: Record<string, { promptPer1k: number; completionPer1k: number }> = {
  'gpt-4o': { promptPer1k: 0.0025, completionPer1k: 0.01 },
  'gpt-4o-mini': { promptPer1k: 0.00015, completionPer1k: 0.0006 },
  'claude-3-5-sonnet': { promptPer1k: 0.003, completionPer1k: 0.015 },
  'gemini-1.5-flash': { promptPer1k: 0.000075, completionPer1k: 0.0003 },
  'gemini-1.5-pro': { promptPer1k: 0.00125, completionPer1k: 0.005 },
  'gemini-3.8-flash': { promptPer1k: 0.000075, completionPer1k: 0.0003 },
}

export function calculateAiCost(
  model: string,
  promptTokens?: number,
  completionTokens?: number
): number | undefined {
  if (promptTokens === undefined && completionTokens === undefined) {
    return undefined
  }
  const normalized = model.toLowerCase().trim()
  const pricing = KNOWN_MODEL_PRICING[normalized]
  if (!pricing) return undefined

  const pTokens = promptTokens ?? 0
  const cTokens = completionTokens ?? 0
  const cost = (pTokens / 1000) * pricing.promptPer1k + (cTokens / 1000) * pricing.completionPer1k
  return Math.round(cost * 1_000_000) / 1_000_000
}
