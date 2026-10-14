/**
 * Safe Webpage Retrieval & Boilerplate Extraction Engine
 * 
 * Inspired by Firecrawl and LangChain.js web loaders:
 * - Anti-SSRF URL pre-validation and post-redirect re-validation
 * - Response size & timeout constraints
 * - Content-Type validation
 * - Semantic boilerplate stripping (<nav>, <header>, <footer>, <script>, <style>)
 * - Text normalization and metadata extraction (title, description, canonical)
 */

import { validateSafeUrl, isRestrictedUrl } from './security'
import { sharedSearchCache } from './cache'
import type { FetchWebpageOptions, WebpageExtraction } from './types'

const DEFAULT_ALLOWED_CONTENT_TYPES = [
  'text/html',
  'application/xhtml+xml',
  'text/plain',
  'application/xml',
  'text/xml',
]

/**
 * Extracts readable textual content and metadata from raw HTML.
 */
export function extractPageContent(
  html: string,
  sourceUrl?: string
): { title?: string; text: string; description?: string; canonicalUrl?: string } {
  if (!html || typeof html !== 'string') {
    return { text: '' }
  }

  // 1. Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : undefined

  // 2. Extract meta description
  const metaDescMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)
  const description = metaDescMatch ? metaDescMatch[1].trim() : undefined

  // 3. Extract canonical link
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
  const canonicalUrl = canonicalMatch ? canonicalMatch[1].trim() : sourceUrl

  // 4. Strip non-content and layout blocks
  let cleaned = html
    .replace(/<!--[\s\S]*?-->/g, '') // HTML comments
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Scripts
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Styles
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '') // SVGs
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '') // Navigations
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '') // Headers
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '') // Footers
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, '') // Asides
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '') // Noscript

  // 5. Replace block breaks with newlines
  cleaned = cleaned
    .replace(/<(?:p|div|section|article|h[1-6]|li|tr|blockquote)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')

  // 6. Strip all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ')

  // 7. Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  // 8. Collapse whitespace while preserving paragraph breaks
  const lines = cleaned
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)

  const text = lines.join('\n\n')

  return {
    title,
    text,
    description,
    canonicalUrl,
  }
}

/**
 * Fetches a webpage securely with anti-SSRF checks, size/timeout limits, and content cleaning.
 */
export async function fetchWebpage(options: FetchWebpageOptions): Promise<WebpageExtraction> {
  const startTime = Date.now()
  const rawUrl = options.url?.trim()

  // 1. Initial Anti-SSRF URL validation
  const validation = validateSafeUrl(rawUrl)
  if (!validation.valid || !validation.url) {
    return {
      success: false,
      url: rawUrl || '',
      text: '',
      byteSize: 0,
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      error: `URL validation failed: ${validation.error}`,
      errorCode: validation.error?.includes('restricted') || validation.error?.includes('prohibited')
        ? 'RESTRICTED_DESTINATION'
        : 'INVALID_URL',
    }
  }

  // 2. Cache check
  const cacheKey = `webpage:${validation.url.toString()}:${options.extractTextOnly !== false}:${options.maxContentLength || 50000}`
  if (options.useCache !== false) {
    const cached = sharedSearchCache.get<WebpageExtraction>(cacheKey)
    if (cached) {
      return {
        ...cached,
        cached: true,
        latencyMs: Date.now() - startTime,
      }
    }
  }

  // 3. Cancellation check
  if (options.signal?.aborted) {
    return {
      success: false,
      url: rawUrl,
      text: '',
      byteSize: 0,
      retrievedAt: new Date().toISOString(),
      latencyMs: 0,
      error: 'Fetch operation was cancelled',
      errorCode: 'CANCELLED',
    }
  }

  const maxSizeBytes = options.maxSizeBytes ?? 5 * 1024 * 1024 // 5MB default
  const maxContentLength = options.maxContentLength ?? 50000
  const allowedContentTypes = options.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000)

  const effectiveSignal = options.signal
    ? combineSignals(options.signal, controller.signal)
    : controller.signal

  try {
    const res = await fetch(validation.url.toString(), {
      method: 'GET',
      headers: {
        'User-Agent': 'Hackathon-Starter-Web-Bot/1.0 (Safe Retrieval)',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1',
        ...(options.customHeaders || {}),
      },
      signal: effectiveSignal,
    })

    clearTimeout(timeoutId)

    // 4. Post-redirect destination re-validation (Prevent SSRF via 301/302 redirect loops)
    if (res.url && res.url !== validation.url.toString()) {
      const redirectCheck = isRestrictedUrl(res.url)
      if (redirectCheck.restricted) {
        return {
          success: false,
          url: res.url,
          text: '',
          byteSize: 0,
          retrievedAt: new Date().toISOString(),
          latencyMs: Date.now() - startTime,
          statusCode: res.status,
          error: `Redirect to restricted destination blocked: ${redirectCheck.reason}`,
          errorCode: 'RESTRICTED_DESTINATION',
        }
      }
    }

    if (!res.ok) {
      return {
        success: false,
        url: res.url || rawUrl,
        text: '',
        byteSize: 0,
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        statusCode: res.status,
        error: `HTTP error ${res.status}: ${res.statusText}`,
        errorCode: 'HTTP_ERROR',
      }
    }

    // 5. Content-Type inspection
    const contentType = res.headers.get('content-type') || 'text/html'
    const isAllowedType = allowedContentTypes.some((type) =>
      contentType.toLowerCase().includes(type.toLowerCase())
    )

    if (!isAllowedType) {
      return {
        success: false,
        url: res.url || rawUrl,
        text: '',
        contentType,
        byteSize: 0,
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        statusCode: res.status,
        error: `Unsupported content type "${contentType}". Expected text or HTML.`,
        errorCode: 'UNSUPPORTED_CONTENT_TYPE',
      }
    }

    // 6. Response body size check
    const rawText = await res.text()
    const byteSize = Buffer.byteLength(rawText, 'utf8')

    if (byteSize > maxSizeBytes) {
      return {
        success: false,
        url: res.url || rawUrl,
        text: '',
        byteSize,
        retrievedAt: new Date().toISOString(),
        latencyMs: Date.now() - startTime,
        statusCode: res.status,
        error: `Webpage exceeded maximum permitted size of ${maxSizeBytes} bytes (got ${byteSize} bytes)`,
        errorCode: 'CONTENT_TOO_LARGE',
      }
    }

    // 7. Extract and clean content
    let extractedText = rawText
    let title: string | undefined
    let description: string | undefined
    let canonicalUrl: string | undefined

    if (contentType.includes('html')) {
      const parsed = extractPageContent(rawText, res.url || rawUrl)
      title = parsed.title
      description = parsed.description
      canonicalUrl = parsed.canonicalUrl
      extractedText = options.extractTextOnly !== false ? parsed.text : rawText
    }

    // Cap text length
    if (extractedText.length > maxContentLength) {
      extractedText = extractedText.slice(0, maxContentLength) + '\n\n[...Content truncated by length limit]'
    }

    const result: WebpageExtraction = {
      success: true,
      url: res.url || rawUrl,
      canonicalUrl,
      title,
      description,
      text: extractedText,
      contentType,
      byteSize,
      statusCode: res.status,
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
    }

    if (options.useCache !== false) {
      sharedSearchCache.set(cacheKey, result)
    }

    return result
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    const isCancelled = options.signal?.aborted || (err instanceof Error && err.name === 'AbortError')
    const isTimeout = err instanceof Error && err.message.toLowerCase().includes('timeout')

    return {
      success: false,
      url: rawUrl,
      text: '',
      byteSize: 0,
      retrievedAt: new Date().toISOString(),
      latencyMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
      errorCode: isCancelled ? 'CANCELLED' : isTimeout ? 'TIMEOUT' : 'FETCH_ERROR',
    }
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
