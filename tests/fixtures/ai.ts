/**
 * Reusable AI Test Fixtures
 * 
 * Provides mock payloads for OpenAI and Gemini APIs to enable offline testing without billing.
 */

export function createMockOpenAIPayload(content: string, totalTokens: number = 42) {
  return {
    id: 'chatcmpl-mock-test-id',
    object: 'chat.completion',
    created: 1700000000,
    model: 'gpt-4o-mini',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: Math.floor(totalTokens / 2),
      completion_tokens: Math.ceil(totalTokens / 2),
      total_tokens: totalTokens,
    },
  }
}

export function createMockGeminiPayload(content: string, totalTokens: number = 30) {
  return {
    candidates: [
      {
        content: {
          parts: [{ text: content }],
          role: 'model',
        },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: {
      promptTokenCount: Math.floor(totalTokens / 2),
      candidatesTokenCount: Math.ceil(totalTokens / 2),
      totalTokenCount: totalTokens,
    },
  }
}
