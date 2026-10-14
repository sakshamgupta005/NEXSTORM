/**
 * Composable Document Extraction Pipeline & RAG Adapter
 * 
 * Chains together:
 * 1. Image / PDF validation & preprocessing
 * 2. OCR & page-by-page text layout extraction
 * 3. RAG ingestion adaptation (converting OCR pages into RAG Documents)
 * 
 * References:
 * - Docling: Document conversion into structured markdown/chunks (MIT)
 * - Marker: PDF layout extraction (GPL-3.0 / PolyForm)
 */

import type { Document } from '../rag/types'
import { executeOCR } from './ocr'
import type { DocumentExtractionResult, ImageInput, OCROptions } from './types'

export async function extractDocument(
  input: ImageInput,
  options?: OCROptions
): Promise<DocumentExtractionResult> {
  const documentId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const mimeType = input.mimeType || 'image/png'

  const ocrResult = await executeOCR(input, options)

  if (!ocrResult.success) {
    throw new Error(`Document extraction failed: ${ocrResult.error || 'Unknown error'}`)
  }

  return {
    documentId,
    filename: input.filename,
    mimeType,
    pageCount: ocrResult.pages.length,
    pages: ocrResult.pages,
    fullText: ocrResult.text,
    confidence: ocrResult.confidence,
    metadata: ocrResult.metadata,
  }
}

/**
 * Adapter converting DocumentExtractionResult into RAG Documents
 * ready for splitDocuments and InMemoryVectorStore.
 */
export function toRAGDocuments(
  extraction: DocumentExtractionResult
): Document[] {
  return extraction.pages.map((page) => ({
    id: `${extraction.documentId}-p${page.pageNumber}`,
    text: page.text,
    metadata: {
      documentId: extraction.documentId,
      filename: extraction.filename,
      pageNumber: page.pageNumber,
      confidence: page.confidence,
      source: extraction.filename
        ? `${extraction.filename} (Page ${page.pageNumber})`
        : `Page ${page.pageNumber}`,
      mimeType: extraction.mimeType,
      ...extraction.metadata,
    },
  }))
}
