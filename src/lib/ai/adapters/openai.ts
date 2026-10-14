/**
 * OpenAI & Groq Compatible Provider Adapter
 */

import { safeFetch } from '@/lib/api/client'
import type { AIOptions, AIProviderResponse, AIUsage, AIErrorDetail } from '../types'

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export async function executeOpenAICompatible(
  options: AIOptions,
  provider: 'openai' | 'groq'
): Promise<AIProviderResponse<string>> {
  const start = Date.now()
  const isGroq = provider === 'groq'
  const apiKey = options.apiKey ?? (isGroq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY)
  const baseUrl = isGroq ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1'
  const defaultModel = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'
  const model = options.model ?? defaultModel

  if (!apiKey) {
    const errorDetail: AIErrorDetail = {
      code: 'MISSING_API_KEY',
      message: `Missing API key for provider ${provider}. Add key or use provider: 'mock'.`,
      status: 401,
      retryable: false,
    }
    return {
      success: false,
      error: errorDetail.message,
      errorDetail,
      provider,
      model,
      latencyMs: Date.now() - start,
    }
  }

  const res = await safeFetch<OpenAIChatResponse>(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        ...(options.system ? [{ role: 'system', content: options.system }] : []),
        { role: 'user', content: options.prompt },
      ],
      temperature: options.temperature ?? 0.7,
    }),
    timeoutMs: options.timeoutMs ?? 15000,
    // Do not retry non-idempotent completion calls blindly
    idempotent: false,
  })

  if (!res.ok || !res.data) {
    let code: AIErrorDetail['code'] = 'UPSTREAM_ERROR'
    if (res.status === 429) code = 'RATE_LIMITED'
    else if (res.status === 408 || res.status === 504 || res.error?.includes('timed out')) code = 'TIMEOUT'
    else if (res.status === 0) code = 'NETWORK_ERROR'

    const errorDetail: AIErrorDetail = {
      code,
      message: res.error || `Failed to complete ${provider} request`,
      status: res.status || 500,
      retryable: code === 'RATE_LIMITED' || code === 'TIMEOUT' || code === 'NETWORK_ERROR',
    }

    return {
      success: false,
      error: errorDetail.message,
      errorDetail,
      provider,
      model,
      latencyMs: Date.now() - start,
    }
  }

  const content = res.data.choices?.[0]?.message?.content ?? ''
  
  // Extract usage without inventing numbers
  let usage: AIUsage | undefined
  if (res.data.usage) {
    usage = {
      promptTokens: res.data.usage.prompt_tokens,
      completionTokens: res.data.usage.completion_tokens,
      totalTokens: res.data.usage.total_tokens,
    }
  }

  return {
    success: true,
    data: content,
    provider,
    model,
    latencyMs: Date.now() - start,
    usage,
  }
}
