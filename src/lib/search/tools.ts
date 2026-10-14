/**
 * Reusable Agent Tools for Web Search & Webpage Extraction
 * 
 * Exposes:
 * - web_search: Bounded internet query with domain filtering and citation snippets
 * - fetch_webpage: Safe URL text retrieval with SSRF blocking and HTML cleaning
 * - extract_page_content: Local HTML boilerplate stripper and metadata extractor
 * 
 * Seamlessly registers with the existing Agent ToolRegistry in src/lib/agent/tools.ts
 */

import { z } from 'zod'
import type { AgentTool, ToolRegistry } from '../agent/tools'
import { executeSearch } from './providers'
import { fetchWebpage, extractPageContent } from './fetcher'
import type { SearchProvider, SearchRecency } from './types'

export interface WebToolsConfig {
  defaultSearchProvider?: SearchProvider
  maxSearchResultsCap?: number
  maxWebpageLengthCap?: number
  defaultTimeoutMs?: number
}

/**
 * Creates the `web_search` agent tool.
 */
export function createWebSearchTool(
  config: WebToolsConfig = {}
): AgentTool<
  {
    query: string
    maxResults?: number
    includeDomains?: string[]
    excludeDomains?: string[]
    recency?: SearchRecency
  },
  {
    query: string
    results: Array<{ title: string; url: string; snippet: string; source: string; publishedDate?: string }>
    totalFound: number
    provider: string
  }
> {
  return {
    name: 'web_search',
    description:
      'Searches the web for up-to-date information, documentation, articles, or facts. Returns title, URL, snippet, and source for each result.',
    isReadOnly: true,
    timeoutMs: config.defaultTimeoutMs ?? 10000,
    parameters: z.object({
      query: z
        .string()
        .min(1, 'Search query cannot be empty')
        .max(300, 'Search query is too long')
        .describe('Search query terms or question to look up'),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(config.maxSearchResultsCap ?? 10)
        .optional()
        .describe('Maximum number of results to return (default 3, max 10)'),
      includeDomains: z
        .array(z.string())
        .optional()
        .describe('Optional list of domains to restrict search results to (e.g. ["nextjs.org", "github.com"])'),
      excludeDomains: z
        .array(z.string())
        .optional()
        .describe('Optional list of domains to exclude from search results'),
      recency: z
        .enum(['day', 'week', 'month', 'year'])
        .optional()
        .describe('Optional recency filter to prioritize recent information'),
    }),
    execute: async (args, context) => {
      const res = await executeSearch({
        query: args.query,
        maxResults: args.maxResults ?? 3,
        includeDomains: args.includeDomains,
        excludeDomains: args.excludeDomains,
        recency: args.recency,
        provider: config.defaultSearchProvider,
        signal: context?.signal,
      })

      if (!res.success) {
        throw new Error(`Search failed: ${res.error || 'Unknown error'}`)
      }

      return {
        query: res.query,
        results: res.results,
        totalFound: res.results.length,
        provider: res.provider,
      }
    },
  }
}

/**
 * Creates the `fetch_webpage` agent tool.
 */
export function createFetchWebpageTool(
  config: WebToolsConfig = {}
): AgentTool<
  {
    url: string
    maxLength?: number
  },
  {
    url: string
    title?: string
    text: string
    byteSize: number
    contentType?: string
  }
> {
  return {
    name: 'fetch_webpage',
    description:
      'Safely fetches an external webpage via HTTP/HTTPS, strips HTML boilerplate, and returns clean readable text. Enforces anti-SSRF protection to block private networks.',
    isReadOnly: true,
    timeoutMs: config.defaultTimeoutMs ?? 10000,
    parameters: z.object({
      url: z.string().url().describe('The safe HTTP/HTTPS URL of the webpage to fetch'),
      maxLength: z
        .number()
        .int()
        .min(100)
        .max(config.maxWebpageLengthCap ?? 20000)
        .optional()
        .describe('Maximum character length of text to return (default 5000, max 20000)'),
    }),
    execute: async (args, context) => {
      const res = await fetchWebpage({
        url: args.url,
        maxContentLength: args.maxLength ?? 5000,
        signal: context?.signal,
      })

      if (!res.success) {
        throw new Error(`Webpage fetch failed: ${res.error || 'Unknown error'}`)
      }

      return {
        url: res.url,
        title: res.title,
        text: res.text,
        byteSize: res.byteSize,
        contentType: res.contentType,
      }
    },
  }
}

/**
 * Creates the `extract_page_content` agent tool.
 */
export function createExtractPageContentTool(): AgentTool<
  {
    html: string
    sourceUrl?: string
  },
  {
    title?: string
    text: string
    description?: string
    canonicalUrl?: string
  }
> {
  return {
    name: 'extract_page_content',
    description:
      'Extracts clean textual content, titles, and metadata from raw HTML strings, stripping scripts, styles, and navigation boilerplate.',
    isReadOnly: true,
    parameters: z.object({
      html: z.string().min(1, 'HTML content cannot be empty').describe('Raw HTML string to parse'),
      sourceUrl: z.string().optional().describe('Optional source URL for metadata reference'),
    }),
    execute: (args) => {
      return extractPageContent(args.html, args.sourceUrl)
    },
  }
}

/**
 * Registers all web search and external retrieval tools onto an existing ToolRegistry instance.
 */
export function registerWebTools(
  registry: ToolRegistry,
  options: {
    enableSearch?: boolean
    enableFetch?: boolean
    enableExtract?: boolean
    config?: WebToolsConfig
  } = {}
): ToolRegistry {
  const cfg = options.config || {}

  if (options.enableSearch !== false) {
    registry.register(createWebSearchTool(cfg))
  }

  if (options.enableFetch !== false) {
    registry.register(createFetchWebpageTool(cfg))
  }

  if (options.enableExtract !== false) {
    registry.register(createExtractPageContentTool())
  }

  return registry
}
