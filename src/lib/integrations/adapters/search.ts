/**
 * Web Search Integration Adapters
 * 
 * Reference: Tavily JS (https://github.com/tavily-ai/tavily-js)
 * License: Apache-2.0
 * 
 * Provides:
 * - search:mock: Deterministic mock search results for offline tests
 * - search:tavily: Native fetch adapter for Tavily AI Search API
 */

import { isValidEnvValue } from '../../env'
import type { IntegrationDefinition } from '../registry'
import type { WebSearchInput, WebSearchOutput } from '../types'

export const mockSearchDefinition: IntegrationDefinition<
  WebSearchInput,
  WebSearchOutput
> = {
  id: 'search:mock',
  category: 'search',
  name: 'Mock Web Search',
  description: 'Deterministic mock web search engine for offline testing and local development',
  referenceRepo: 'https://github.com/tavily-ai/tavily-js',
  license: 'Apache-2.0',
  requiredEnvVars: [],
  isConfigured: () => true,
  checkHealth: async () => ({
    status: 'healthy',
    message: 'Mock search engine is always ready',
  }),
  createAdapter: () => ({
    execute: async (input) => {
      const query = input.query.toLowerCase()
      const maxResults = input.maxResults ?? 3

      const sampleDatabase = [
        {
          title: 'Next.js 16 Documentation — Modern Web Development',
          url: 'https://nextjs.org/docs',
          content: 'Next.js provides App Router, React Server Components, Turbopack, and hybrid rendering capabilities.',
          keywords: ['next', 'nextjs', 'react', 'web', 'framework'],
        },
        {
          title: 'Supabase Architecture Guide',
          url: 'https://supabase.com/docs',
          content: 'Supabase provides instant PostgreSQL databases, Auth, Realtime listeners, Storage, and Vector pgvector.',
          keywords: ['supabase', 'database', 'postgres', 'auth', 'sql'],
        },
        {
          title: 'Hackathon Starter Capability Guide',
          url: 'https://github.com/sakshamgupta005/Hackathon-starter',
          content: 'Production-ready skeleton with modular AI adapters, UI primitives, offline fixtures, and auth.',
          keywords: ['hackathon', 'starter', 'starter-kit', 'ai', 'agent', 'template'],
        },
      ]

      const matched = sampleDatabase.filter((item) =>
        item.keywords.some((k) => query.includes(k)) ||
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)
      )

      const items = matched.length > 0 ? matched : sampleDatabase
      const results = items.slice(0, maxResults).map((item, idx) => ({
        title: item.title,
        url: item.url,
        content: item.content,
        score: Math.round((0.95 - idx * 0.1) * 100) / 100,
      }))

      return {
        query: input.query,
        results,
        answer: input.includeAnswer
          ? `Summary for "${input.query}": found ${results.length} relevant reference source(s).`
          : undefined,
      }
    },
  }),
}

export const tavilySearchDefinition: IntegrationDefinition<
  WebSearchInput,
  WebSearchOutput
> = {
  id: 'search:tavily',
  category: 'search',
  name: 'Tavily Agent Web Search',
  description: 'AI-tailored web search provider returning clean snippets and synthesized answers',
  referenceRepo: 'https://github.com/tavily-ai/tavily-js',
  license: 'Apache-2.0',
  requiredEnvVars: ['TAVILY_API_KEY'],
  isConfigured: () => isValidEnvValue(process.env.TAVILY_API_KEY),
  checkHealth: async () => {
    if (!isValidEnvValue(process.env.TAVILY_API_KEY)) {
      return {
        status: 'unhealthy',
        message: 'TAVILY_API_KEY environment variable is not configured',
      }
    }
    return {
      status: 'healthy',
      message: 'Tavily search endpoint configured with API key',
    }
  },
  createAdapter: (config) => ({
    execute: async (input, options) => {
      const apiKey =
        (config?.apiKey as string | undefined) ||
        process.env.TAVILY_API_KEY

      if (!isValidEnvValue(apiKey)) {
        throw new Error('TAVILY_API_KEY is not configured')
      }

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: input.query,
          max_results: input.maxResults ?? 5,
          include_answer: input.includeAnswer ?? false,
        }),
        signal: options?.signal,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => '')
        throw new Error(`Tavily search API error (${response.status}): ${errorText || response.statusText}`)
      }

      const data = await response.json()

      return {
        query: input.query,
        results: (data.results || []).map(
          (r: { title?: string; url?: string; content?: string; score?: number }) => ({
            title: r.title || 'Untitled',
            url: r.url || '',
            content: r.content || '',
            score: typeof r.score === 'number' ? r.score : undefined,
          })
        ),
        answer: data.answer,
      }
    },
  }),
}
