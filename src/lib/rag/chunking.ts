/**
 * Document Ingestion & Chunking Engine
 * 
 * Implements chunking algorithms inspired by LlamaIndex SentenceSplitter
 * and LangChain RecursiveCharacterTextSplitter.
 * 
 * Supports:
 * - Word sliding window with overlap
 * - Recursive structural splitting (paragraphs, sentences, words)
 * - Markdown header-aware splitting (extracting section titles into chunk metadata)
 * - Metadata preservation and deterministic chunk ID generation
 */

import type { Chunk, ChunkingOptions, Document } from './types'

const DEFAULT_CHUNK_SIZE = 300
const DEFAULT_CHUNK_OVERLAP = 50
const DEFAULT_MIN_CHUNK_SIZE = 20

const DEFAULT_SEPARATORS = [
  '\n\n# ',
  '\n\n## ',
  '\n\n### ',
  '\n\n',
  '\n',
  '. ',
  '? ',
  '! ',
  '; ',
  ' ',
  '',
]

export function chunkByWord(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  chunkOverlap = DEFAULT_CHUNK_OVERLAP
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  if (words.length <= chunkSize) return [words.join(' ')]

  const chunks: string[] = []
  let start = 0
  const step = Math.max(1, chunkSize - chunkOverlap)

  while (start < words.length) {
    const slice = words.slice(start, start + chunkSize)
    chunks.push(slice.join(' '))
    if (start + chunkSize >= words.length) break
    start += step
  }

  return chunks
}

export function chunkRecursive(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  chunkOverlap = DEFAULT_CHUNK_OVERLAP,
  separators = DEFAULT_SEPARATORS
): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= chunkSize) return [trimmed]

  // Find the highest-priority separator that occurs in the text
  let chosenSeparator = ''
  for (const sep of separators) {
    if (sep === '' || trimmed.includes(sep)) {
      chosenSeparator = sep
      break
    }
  }

  const rawSplits = chosenSeparator === ''
    ? trimmed.split('')
    : trimmed.split(chosenSeparator)

  const goodSplits: string[] = []
  for (const part of rawSplits) {
    if (part.trim().length > 0) {
      goodSplits.push(part.trim())
    }
  }

  // Combine small splits up to chunkSize
  const chunks: string[] = []
  let currentAccumulator: string[] = []
  let currentLength = 0

  for (const piece of goodSplits) {
    const pieceLen = piece.length + (currentAccumulator.length > 0 ? chosenSeparator.length : 0)

    if (currentLength + pieceLen > chunkSize && currentAccumulator.length > 0) {
      const merged = currentAccumulator.join(chosenSeparator || ' ')
      chunks.push(merged)

      // Retain trailing pieces for overlap
      const overlapAccumulator: string[] = []
      let overlapLen = 0

      for (let i = currentAccumulator.length - 1; i >= 0; i--) {
        const p = currentAccumulator[i]
        if (overlapLen + p.length <= chunkOverlap) {
          overlapAccumulator.unshift(p)
          overlapLen += p.length
        } else {
          break
        }
      }

      currentAccumulator = overlapAccumulator
      currentLength = overlapLen
    }

    currentAccumulator.push(piece)
    currentLength += piece.length
  }

  if (currentAccumulator.length > 0) {
    const finalMerged = currentAccumulator.join(chosenSeparator || ' ')
    if (finalMerged.trim().length >= DEFAULT_MIN_CHUNK_SIZE || chunks.length === 0) {
      chunks.push(finalMerged)
    }
  }

  return chunks
}

export function chunkMarkdown(
  text: string,
  chunkSize = DEFAULT_CHUNK_SIZE,
  chunkOverlap = DEFAULT_CHUNK_OVERLAP
): Array<{ text: string; sectionHeading?: string }> {
  const lines = text.split('\n')
  const sections: Array<{ heading?: string; content: string[] }> = []
  let currentHeading: string | undefined
  let currentLines: string[] = []

  for (const line of lines) {
    const headerMatch = line.match(/^#{1,4}\s+(.+)$/)
    if (headerMatch) {
      if (currentLines.length > 0) {
        sections.push({ heading: currentHeading, content: currentLines })
        currentLines = []
      }
      currentHeading = headerMatch[1].trim()
    }
    currentLines.push(line)
  }

  if (currentLines.length > 0) {
    sections.push({ heading: currentHeading, content: currentLines })
  }

  const results: Array<{ text: string; sectionHeading?: string }> = []

  for (const section of sections) {
    const sectionText = section.content.join('\n').trim()
    if (!sectionText) continue

    const subChunks = chunkRecursive(sectionText, chunkSize, chunkOverlap)
    for (const sub of subChunks) {
      results.push({
        text: sub,
        sectionHeading: section.heading,
      })
    }
  }

  return results
}

/**
 * Splits a Document into structured Chunks with complete metadata preservation.
 */
export function splitDocument(
  doc: Document,
  options?: ChunkingOptions
): Chunk[] {
  const strategy = options?.strategy || 'recursive'
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE
  const chunkOverlap = options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP

  let rawChunks: Array<{ text: string; sectionHeading?: string }> = []

  if (strategy === 'word') {
    rawChunks = chunkByWord(doc.text, chunkSize, chunkOverlap).map((t) => ({ text: t }))
  } else if (strategy === 'markdown') {
    rawChunks = chunkMarkdown(doc.text, chunkSize, chunkOverlap)
  } else {
    rawChunks = chunkRecursive(doc.text, chunkSize, chunkOverlap, options?.separators).map((t) => ({
      text: t,
    }))
  }

  let runningOffset = 0
  return rawChunks.map((c, index) => {
    const startIndex = doc.text.indexOf(c.text, runningOffset)
    const effectiveStart = startIndex >= 0 ? startIndex : runningOffset
    const effectiveEnd = effectiveStart + c.text.length
    runningOffset = Math.max(0, effectiveEnd - chunkOverlap)

    return {
      id: `${doc.id}-chunk-${index}`,
      documentId: doc.id,
      text: c.text,
      chunkIndex: index,
      startIndex: effectiveStart,
      endIndex: effectiveEnd,
      metadata: {
        ...doc.metadata,
        documentId: doc.id,
        ...(c.sectionHeading ? { sectionHeading: c.sectionHeading } : {}),
      },
    }
  })
}

/**
 * Splits multiple Documents in batch.
 */
export function splitDocuments(
  docs: Document[],
  options?: ChunkingOptions
): Chunk[] {
  const allChunks: Chunk[] = []
  for (const doc of docs) {
    const chunks = splitDocument(doc, options)
    allChunks.push(...chunks)
  }
  return allChunks
}
