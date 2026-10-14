/**
 * Mock AI Provider Adapter
 * 
 * Provides deterministic offline text generation without network calls or API keys.
 */

import type { AIOptions, AIProviderResponse } from '../types'

export async function executeMock(options: AIOptions): Promise<AIProviderResponse<string>> {
  const start = Date.now()
  const model = options.model ?? 'mock-model'

  return {
    success: true,
    data: `[Mock AI Response for: "${options.prompt.slice(0, 40)}..."]`,
    provider: 'mock',
    model,
    latencyMs: Date.now() - start,
    usage: {
      promptTokens: 10,
      completionTokens: 15,
      totalTokens: 25,
    },
  }
}
