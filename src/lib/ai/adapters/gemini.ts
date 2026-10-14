/**
 * Google Gemini Provider Adapter
 */

import { safeFetch } from '@/lib/api/client'
import type { AIOptions, AIProviderResponse, AIUsage, AIErrorDetail } from '../types'

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

export async function executeGemini(options: AIOptions): Promise<AIProviderResponse<string>> {
  const start = Date.now()
  const apiKey = options.apiKey ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY
  const model = options.model ?? 'gemini-1.5-flash'

  if (!apiKey) {
    const errorDetail: AIErrorDetail = {
      code: 'MISSING_API_KEY',
      message: 'Missing GOOGLE_GENERATIVE_AI_API_KEY. Add key or use provider: "mock".',
      status: 401,
      retryable: false,
    }
    return {
      success: false,
      error: errorDetail.message,
      errorDetail,
      provider: 'gemini',
      model,
      latencyMs: Date.now() - start,
    }
  }

  const res = await safeFetch<GeminiResponse>(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          ...(options.system ? [{ role: 'user', parts: [{ text: `System instruction: ${options.system}` }] }] : []),
          { role: 'user', parts: [{ text: options.prompt }] },
        ],
      }),
      timeoutMs: options.timeoutMs ?? 15000,
      idempotent: false,
    }
  )

  if (!res.ok || !res.data) {
    let code: AIErrorDetail['code'] = 'UPSTREAM_ERROR'
    if (res.status === 429) code = 'RATE_LIMITED'
    else if (res.status === 408 || res.status === 504 || res.error?.includes('timed out')) code = 'TIMEOUT'
    else if (res.status === 0) code = 'NETWORK_ERROR'

    const errorDetail: AIErrorDetail = {
      code,
      message: res.error || 'Failed to complete Gemini request',
      status: res.status || 500,
      retryable: code === 'RATE_LIMITED' || code === 'TIMEOUT' || code === 'NETWORK_ERROR',
    }

    return {
      success: false,
      error: errorDetail.message,
      errorDetail,
      provider: 'gemini',
      model,
      latencyMs: Date.now() - start,
    }
  }

  const content = res.data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  let usage: AIUsage | undefined
  if (res.data.usageMetadata) {
    usage = {
      promptTokens: res.data.usageMetadata.promptTokenCount,
      completionTokens: res.data.usageMetadata.candidatesTokenCount,
      totalTokens: res.data.usageMetadata.totalTokenCount,
    }
  }

  return {
    success: true,
    data: content,
    provider: 'gemini',
    model,
    latencyMs: Date.now() - start,
    usage,
  }
}
