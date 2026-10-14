/**
 * Source-Grounded Question Answering & Citation Synthesis
 * 
 * Conducts bounded web research and synthesizes answers strictly grounded in retrieved evidence.
 * 
 * Safety & Quality Guardrails:
 * - Traceable citations [1], [2] linked to exact source URLs and snippets
 * - Explicit insufficient-evidence response when sources do not support an answer
 * - Bounded pages and content limit to prevent unbounded scraping
 * - Prompt injection barriers around untrusted external content
 */

import { generateText } from '../ai/client'
import { executeSearch } from './providers'
import { fetchWebpage } from './fetcher'
import { formatUntrustedWebContent } from './security'
import type { GroundedAnswerOptions, GroundedAnswerResult, Citation } from './types'

export async function synthesizeGroundedAnswer(
  options: GroundedAnswerOptions
): Promise<GroundedAnswerResult> {
  const startTime = Date.now()
  const query = options.query?.trim()

  if (!query) {
    return {
      success: false,
      query: '',
      answer: 'Query cannot be empty.',
      citations: [],
      hasSufficientEvidence: false,
      searchesExecuted: 0,
      pagesFetched: 0,
      latencyMs: 0,
      error: 'Query cannot be empty',
    }
  }

  // 1. Execute search
  const searchRes = await executeSearch({
    query,
    maxResults: options.searchOptions?.maxResults ?? 4,
    includeDomains: options.searchOptions?.includeDomains,
    excludeDomains: options.searchOptions?.excludeDomains,
    recency: options.searchOptions?.recency,
    provider: options.searchOptions?.provider ?? 'mock',
    signal: options.signal,
    timeoutMs: options.timeoutMs ?? 10000,
  })

  if (!searchRes.success || searchRes.results.length === 0) {
    return {
      success: true,
      query,
      answer: `Insufficient evidence: No relevant web sources could be found for query "${query}".`,
      citations: [],
      hasSufficientEvidence: false,
      searchesExecuted: 1,
      pagesFetched: 0,
      latencyMs: Date.now() - startTime,
    }
  }

  // 2. Fetch top pages (bounded)
  const maxPages = Math.min(options.maxPagesToFetch ?? 2, 4)
  const topResults = searchRes.results.slice(0, maxPages)
  let pagesFetched = 0

  const evidenceSnippets: Array<{ index: number; title: string; url: string; content: string }> = []
  const citations: Citation[] = []

  for (let i = 0; i < topResults.length; i++) {
    const item = topResults[i]
    const citationIndex = i + 1

    citations.push({
      sourceIndex: citationIndex,
      title: item.title,
      url: item.url,
      snippet: item.snippet,
    })

    // Optionally fetch full page text if deep research is desired and URL is safe
    let pageContent = item.snippet
    if (options.maxPagesToFetch && options.maxPagesToFetch > 0) {
      const pageRes = await fetchWebpage({
        url: item.url,
        maxContentLength: 4000,
        timeoutMs: 5000,
        signal: options.signal,
      })
      if (pageRes.success && pageRes.text.trim().length > 50) {
        pageContent = pageRes.text.slice(0, 3000)
        pagesFetched++
      }
    }

    evidenceSnippets.push({
      index: citationIndex,
      title: item.title,
      url: item.url,
      content: pageContent,
    })
  }

  // 3. Check evidence relevance / sufficiency
  const combinedEvidenceText = evidenceSnippets.map((s) => s.content.toLowerCase()).join(' ')
  const queryTerms = query.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  const hasKeywordOverlap = queryTerms.some((term) => combinedEvidenceText.includes(term))

  if (!hasKeywordOverlap && options.requireSufficientEvidence !== false) {
    return {
      success: true,
      query,
      answer: `Insufficient evidence: The retrieved web sources do not contain factual corroboration for "${query}".`,
      citations,
      hasSufficientEvidence: false,
      searchesExecuted: 1,
      pagesFetched,
      latencyMs: Date.now() - startTime,
    }
  }

  // 4. Construct grounded synthesis prompt with injection delimiters
  const formattedEvidence = evidenceSnippets
    .map(
      (e) =>
        `[Source ${e.index}]: ${e.title}\nURL: ${e.url}\n${formatUntrustedWebContent(
          e.content,
          e.url
        )}`
    )
    .join('\n\n')

  const prompt = [
    `You are a strict, evidence-grounded research assistant.`,
    `Answer the user inquiry solely based on the numbered sources below.`,
    `INSTRUCTIONS:`,
    `- Insert citations inline using [1], [2], etc., matching the exact source number that supports each claim.`,
    `- Distinguish confirmed facts from inferences.`,
    `- Do NOT invent or fabricate facts or citations.`,
    `- If the sources do not provide sufficient evidence to answer part of the inquiry, state so clearly.`,
    ``,
    `=== RETRIEVED SOURCES ===`,
    formattedEvidence,
    ``,
    `USER INQUIRY: ${query}`,
    ``,
    `ANSWER:`,
  ].join('\n')

  try {
    const aiProvider = options.aiProvider ?? 'mock'
    const aiRes = await generateText({
      prompt,
      provider: aiProvider,
      model: options.model,
      temperature: 0.2, // Low temperature for high factual precision
    })

    if (!aiRes.success) {
      // Deterministic fallback if offline/mock
      const fallbackAnswer = `Based on retrieved sources: ${evidenceSnippets
        .map((e) => `${e.title} [${e.index}]`)
        .join(', ')}.`

      return {
        success: true,
        query,
        answer: fallbackAnswer,
        citations,
        hasSufficientEvidence: true,
        searchesExecuted: 1,
        pagesFetched,
        latencyMs: Date.now() - startTime,
      }
    }

    return {
      success: true,
      query,
      answer: aiRes.data || '',
      citations,
      hasSufficientEvidence: true,
      searchesExecuted: 1,
      pagesFetched,
      latencyMs: Date.now() - startTime,
    }
  } catch (err) {
    return {
      success: false,
      query,
      answer: '',
      citations,
      hasSufficientEvidence: false,
      searchesExecuted: 1,
      pagesFetched,
      latencyMs: Date.now() - startTime,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
