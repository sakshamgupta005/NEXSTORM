/**
 * Reusable Web Search & External Data Toolkit Types
 * 
 * Provider-neutral types inspired by Tavily, Exa, Firecrawl, and LangChain.js
 */

export interface SearchResultItem {
  title: string
  url: string
  snippet: string
  source: string
  publishedDate?: string
  score?: number
}

export type SearchRecency = 'day' | 'week' | 'month' | 'year'

export type SearchProvider = 'mock' | 'tavily' | 'exa' | 'custom'

export interface SearchQueryOptions {
  query: string
  maxResults?: number
  includeDomains?: string[]
  excludeDomains?: string[]
  recency?: SearchRecency
  provider?: SearchProvider
  providerOptions?: Record<string, unknown>
  useCache?: boolean
  signal?: AbortSignal
  timeoutMs?: number
}

export type SearchErrorCode =
  | 'NOT_CONFIGURED'
  | 'INVALID_QUERY'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'RATE_LIMITED'
  | 'PROVIDER_ERROR'
  | 'RESTRICTED_QUERY'

export interface SearchResponse {
  success: boolean
  query: string
  results: SearchResultItem[]
  provider: string
  latencyMs: number
  cached?: boolean
  answer?: string
  error?: string
  errorCode?: SearchErrorCode
}

export type WebpageErrorCode =
  | 'INVALID_URL'
  | 'RESTRICTED_DESTINATION'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'CONTENT_TOO_LARGE'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'FETCH_ERROR'
  | 'HTTP_ERROR'

export interface FetchWebpageOptions {
  url: string
  maxContentLength?: number
  maxSizeBytes?: number
  timeoutMs?: number
  signal?: AbortSignal
  allowedContentTypes?: string[]
  extractTextOnly?: boolean
  useCache?: boolean
  customHeaders?: Record<string, string>
}

export interface WebpageExtraction {
  success: boolean
  url: string
  canonicalUrl?: string
  title?: string
  text: string
  description?: string
  contentType?: string
  byteSize: number
  retrievedAt: string
  latencyMs: number
  cached?: boolean
  statusCode?: number
  error?: string
  errorCode?: WebpageErrorCode
}

export interface Citation {
  sourceIndex: number
  title: string
  url: string
  snippet: string
}

export interface GroundedAnswerOptions {
  query: string
  searchOptions?: Partial<SearchQueryOptions>
  maxPagesToFetch?: number
  aiProvider?: 'mock' | 'openai' | 'gemini' | 'groq'
  model?: string
  requireSufficientEvidence?: boolean
  signal?: AbortSignal
  timeoutMs?: number
}

export interface GroundedAnswerResult {
  success: boolean
  query: string
  answer: string
  citations: Citation[]
  hasSufficientEvidence: boolean
  searchesExecuted: number
  pagesFetched: number
  latencyMs: number
  error?: string
  errorCode?: string
}
