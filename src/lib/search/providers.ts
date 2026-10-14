/**
 * Provider-Neutral Search Engine & Adapters
 * 
 * Supports:
 * - mock: Offline deterministic engine for testing with domain/recency filtering
 * - tavily: Tavily AI search adapter (process.env.TAVILY_API_KEY)
 * - exa: Exa AI neural search adapter (process.env.EXA_API_KEY)
 * - custom: User-supplied provider function
 */

import { isValidEnvValue } from '../env'
import { sharedSearchCache } from './cache'
import type {
  SearchQueryOptions,
  SearchResponse,
  SearchResultItem,
  SearchProvider,
} from './types'

export function isSearchProviderConfigured(provider: SearchProvider): boolean {
  if (provider === 'mock' || provider === 'custom') return true
  if (provider === 'tavily') return isValidEnvValue(process.env.TAVILY_API_KEY)
  if (provider === 'exa') return isValidEnvValue(process.env.EXA_API_KEY)
  return false
}

// Deterministic mock database for offline hackathon testing
const now = Date.now()
const MOCK_SEARCH_DATABASE: (SearchResultItem & { keywords: string[]; dateTimestamp: number })[] = [
  {
    title: 'Next.js 16 Documentation — App Router & Turbopack',
    url: 'https://nextjs.org/docs/app-router',
    snippet: 'Next.js 16 features Next Turbopack, React 19 Server Components, async request headers and cookies, and optimized caching.',
    source: 'nextjs.org',
    publishedDate: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
    dateTimestamp: now - 2 * 24 * 60 * 60 * 1000,
    score: 0.98,
    keywords: ['next.js', 'nextjs', 'react', 'router', 'turbopack', 'frontend', 'app'],
  },
  {
    title: 'Supabase Architecture Guide & PostgreSQL pgvector',
    url: 'https://supabase.com/docs/guides/database',
    snippet: 'Supabase provides hosted PostgreSQL databases, Row Level Security, instant real-time websocket subscriptions, and pgvector embeddings.',
    source: 'supabase.com',
    publishedDate: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
    dateTimestamp: now - 5 * 24 * 60 * 60 * 1000,
    score: 0.94,
    keywords: ['supabase', 'database', 'postgres', 'postgresql', 'sql', 'pgvector', 'auth'],
  },
  {
    title: 'Hackathon Starter Modular Architecture',
    url: 'https://github.com/sakshamgupta005/Hackathon-starter',
    snippet: 'A production-grade, domain-agnostic starter template with modular AI adapters, RAG pipelines, speech, vision, and offline test harnesses.',
    source: 'github.com',
    publishedDate: new Date(now - 12 * 24 * 60 * 60 * 1000).toISOString(),
    dateTimestamp: now - 12 * 24 * 60 * 60 * 1000,
    score: 0.96,
    keywords: ['hackathon', 'starter', 'template', 'agent', 'rag', 'vision', 'speech', 'ai'],
  },
  {
    title: 'Tailwind CSS v4 Modern Styling Principles',
    url: 'https://tailwindcss.com/docs/v4',
    snippet: 'Tailwind CSS v4 introduces CSS-first configuration, lightning-fast Rust compilation, and container queries without javascript config.',
    source: 'tailwindcss.com',
    publishedDate: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
    dateTimestamp: now - 20 * 24 * 60 * 60 * 1000,
    score: 0.88,
    keywords: ['tailwind', 'css', 'styling', 'styles', 'ui'],
  },
  {
    title: 'Tavily AI Search: Agentic Web Retrieval API',
    url: 'https://tavily.com/docs',
    snippet: 'Tavily is a search engine built specifically for LLM agents, returning high-signal structured web snippets with minimal hallucination.',
    source: 'tavily.com',
    publishedDate: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
    dateTimestamp: now - 3 * 24 * 60 * 60 * 1000,
    score: 0.92,
    keywords: ['tavily', 'search', 'agent', 'retrieval', 'web'],
  },
]

export async function executeSearch(options: SearchQueryOptions): Promise<SearchResponse> {
  const startTime = Date.now()
  const rawQuery = options.query?.trim()

  if (!rawQuery) {
    return {
      success: false,
      query: '',
      results: [],
      provider: options.provider || 'mock',
      latencyMs: 0,
      error: 'Search query cannot be empty',
      errorCode: 'INVALID_QUERY',
    }
  }

  const provider = options.provider ?? (isValidEnvValue(process.env.TAVILY_API_KEY) ? 'tavily' : 'mock')
  const maxResults = Math.min(Math.max(options.maxResults ?? 5, 1), 20)

  // 1. Check cache
  const cacheKey = `search:${provider}:${rawQuery}:${maxResults}:${(options.includeDomains || []).join(',')}:${(options.excludeDomains || []).join(',')}:${options.recency || ''}`
  if (options.useCache !== false) {
    const cached = sharedSearchCache.get<SearchResponse>(cacheKey)
    if (cached) {
      return {
        ...cached,
        cached: true,
        latencyMs: Date.now() - startTime,
      }
    }
  }

  // 2. Cancellation check
  if (options.signal?.aborted) {
    return {
      success: false,
      query: rawQuery,
      results: [],
      provider,
      latencyMs: 0,
      error: 'Search operation was cancelled before execution',
      errorCode: 'CANCELLED',
    }
  }

  // 3. Provider execution
  try {
    let results: SearchResultItem[] = []
    let answer: string | undefined

    switch (provider) {
      case 'mock': {
        const queryLower = rawQuery.toLowerCase()
        let pool = [...MOCK_SEARCH_DATABASE]

        // Domain inclusion
        if (options.includeDomains && options.includeDomains.length > 0) {
          const inc = options.includeDomains.map((d) => d.toLowerCase())
          pool = pool.filter((item) => inc.some((d) => item.url.toLowerCase().includes(d) || item.source.toLowerCase().includes(d)))
        }

        // Domain exclusion
        if (options.excludeDomains && options.excludeDomains.length > 0) {
          const exc = options.excludeDomains.map((d) => d.toLowerCase())
          pool = pool.filter((item) => !exc.some((d) => item.url.toLowerCase().includes(d) || item.source.toLowerCase().includes(d)))
        }

        // Recency filtering (mock timestamps)
        if (options.recency) {
          const now = Date.now()
          const maxAgeMs =
            options.recency === 'day'
              ? 24 * 60 * 60 * 1000
              : options.recency === 'week'
              ? 7 * 24 * 60 * 60 * 1000
              : options.recency === 'month'
              ? 30 * 24 * 60 * 60 * 1000
              : 365 * 24 * 60 * 60 * 1000

          pool = pool.filter((item) => now - item.dateTimestamp <= maxAgeMs)
        }

        // Match query
        const matched = pool.filter(
          (item) =>
            item.keywords.some((k) => queryLower.includes(k)) ||
            item.title.toLowerCase().includes(queryLower) ||
            item.snippet.toLowerCase().includes(queryLower)
        )

        const chosen = matched.length > 0 ? matched : pool
        results = chosen.slice(0, maxResults).map(({ title, url, snippet, source, publishedDate, score }) => ({
          title,
          url,
          snippet,
          source,
          publishedDate,
          score,
        }))

        answer = `Retrieved ${results.length} result(s) for query "${rawQuery}".`
        break
      }

      case 'tavily': {
        if (!isValidEnvValue(process.env.TAVILY_API_KEY)) {
          return {
            success: false,
            query: rawQuery,
            results: [],
            provider: 'tavily',
            latencyMs: Date.now() - startTime,
            error: 'Tavily API key is not configured in environment variables (TAVILY_API_KEY)',
            errorCode: 'NOT_CONFIGURED',
          }
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000)

        const effectiveSignal = options.signal
          ? combineSignals(options.signal, controller.signal)
          : controller.signal

        try {
          const res = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query: rawQuery,
              max_results: maxResults,
              include_domains: options.includeDomains,
              exclude_domains: options.excludeDomains,
              include_answer: true,
            }),
            signal: effectiveSignal,
          })

          clearTimeout(timeoutId)

          if (!res.ok) {
            if (res.status === 429) {
              return {
                success: false,
                query: rawQuery,
                results: [],
                provider: 'tavily',
                latencyMs: Date.now() - startTime,
                error: 'Tavily API rate limit exceeded',
                errorCode: 'RATE_LIMITED',
              }
            }
            throw new Error(`Tavily HTTP error ${res.status}: ${res.statusText}`)
          }

          const data = (await res.json()) as {
            results?: Array<{ title: string; url: string; content: string; score?: number }>
            answer?: string
          }

          results = (data.results || []).map((item) => ({
            title: item.title,
            url: item.url,
            snippet: item.content,
            source: extractDomain(item.url),
            score: item.score,
          }))
          answer = data.answer
        } catch (fetchErr: unknown) {
          clearTimeout(timeoutId)
          throw fetchErr
        }
        break
      }

      case 'exa': {
        if (!isValidEnvValue(process.env.EXA_API_KEY)) {
          return {
            success: false,
            query: rawQuery,
            results: [],
            provider: 'exa',
            latencyMs: Date.now() - startTime,
            error: 'Exa API key is not configured in environment variables (EXA_API_KEY)',
            errorCode: 'NOT_CONFIGURED',
          }
        }

        const res = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.EXA_API_KEY!,
          },
          body: JSON.stringify({
            query: rawQuery,
            numResults: maxResults,
            includeDomains: options.includeDomains,
            excludeDomains: options.excludeDomains,
          }),
          signal: options.signal,
        })

        if (!res.ok) {
          throw new Error(`Exa HTTP error ${res.status}: ${res.statusText}`)
        }

        const data = (await res.json()) as {
          results?: Array<{ title?: string; url: string; text?: string; score?: number }>
        }

        results = (data.results || []).map((item) => ({
          title: item.title || item.url,
          url: item.url,
          snippet: item.text || '',
          source: extractDomain(item.url),
          score: item.score,
        }))
        break
      }

      default:
        return {
          success: false,
          query: rawQuery,
          results: [],
          provider,
          latencyMs: Date.now() - startTime,
          error: `Unsupported search provider: ${provider}`,
          errorCode: 'PROVIDER_ERROR',
        }
    }

    const response: SearchResponse = {
      success: true,
      query: rawQuery,
      results,
      answer,
      provider,
      latencyMs: Date.now() - startTime,
    }

    // Cache successful search
    if (options.useCache !== false) {
      sharedSearchCache.set(cacheKey, response)
    }

    return response
  } catch (err: unknown) {
    const isCancelled = options.signal?.aborted || (err instanceof Error && err.name === 'AbortError')
    const isTimeout = err instanceof Error && err.message.toLowerCase().includes('timeout')

    return {
      success: false,
      query: rawQuery,
      results: [],
      provider,
      latencyMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
      errorCode: isCancelled ? 'CANCELLED' : isTimeout ? 'TIMEOUT' : 'PROVIDER_ERROR',
    }
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'unknown'
  }
}

function combineSignals(s1: AbortSignal, s2: AbortSignal): AbortSignal {
  if (s1.aborted) return s1
  if (s2.aborted) return s2
  const controller = new AbortController()
  s1.addEventListener('abort', () => controller.abort(), { once: true })
  s2.addEventListener('abort', () => controller.abort(), { once: true })
  return controller.signal
}
