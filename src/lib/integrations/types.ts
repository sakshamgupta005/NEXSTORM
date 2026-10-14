/**
 * Modular Integration Framework — Types & Contracts
 * 
 * Defines standard interfaces for optional capabilities:
 * - RAG and document retrieval (LlamaIndex reference)
 * - Advanced document understanding (RAGFlow reference)
 * - OCR and document parsing (PaddleOCR reference)
 * - Speech recognition / transcription (Faster-Whisper reference)
 * - AI vision and multimodal models (Hugging Face Transformers reference)
 * - Web search for AI agents (Tavily reference)
 * - Background jobs and queues (BullMQ reference)
 */

export type IntegrationCategory =
  | 'rag'
  | 'doc_understanding'
  | 'ocr'
  | 'speech'
  | 'vision'
  | 'search'
  | 'queue'

export type IntegrationErrorCode =
  | 'NOT_REGISTERED'
  | 'NOT_CONFIGURED'
  | 'MISSING_DEPENDENCY'
  | 'TIMEOUT'
  | 'CANCELLED'
  | 'INVALID_INPUT'
  | 'EXECUTION_ERROR'
  | 'HEALTH_CHECK_FAILED'
  | 'DUPLICATE_REGISTRATION'

export interface IntegrationErrorDetail {
  code: IntegrationErrorCode
  message: string
  details?: Record<string, unknown>
  recoverable?: boolean
}

export interface IntegrationHealth {
  status: 'healthy' | 'unhealthy' | 'degraded'
  message?: string
  latencyMs?: number
  timestamp?: number
  details?: Record<string, unknown>
}

export interface IntegrationResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  errorDetail?: IntegrationErrorDetail
  latencyMs: number
  integrationId: string
  metadata?: Record<string, unknown>
}

export interface ExecutionOptions {
  signal?: AbortSignal
  timeoutMs?: number
  config?: Record<string, unknown>
}

// ============================================================================
// 1. RAG & Document Retrieval Contracts (LlamaIndex Reference)
// ============================================================================

export interface DocumentChunk {
  id: string
  text: string
  metadata?: Record<string, unknown>
  score?: number
}

export interface RAGIndexInput {
  documents: Array<{
    id: string
    text: string
    metadata?: Record<string, unknown>
  }>
  chunkSize?: number
  chunkOverlap?: number
}

export interface RAGIndexOutput {
  documentCount: number
  chunkCount: number
}

export interface RAGRetrieveInput {
  query: string
  topK?: number
  minScore?: number
}

export interface RAGRetrieveOutput {
  results: DocumentChunk[]
  query: string
}

// ============================================================================
// 2. Document Understanding & Parsing Contracts (RAGFlow Reference)
// ============================================================================

export interface ExtractedTable {
  headers: string[]
  rows: string[][]
  caption?: string
}

export interface DocSection {
  title?: string
  content: string
  pageNumber?: number
}

export interface DocUnderstandingInput {
  documentUrl?: string
  documentBase64?: string
  documentText?: string
  mimeType?: string
  extractTables?: boolean
}

export interface DocUnderstandingOutput {
  summary: string
  sections: DocSection[]
  tables: ExtractedTable[]
  metadata?: Record<string, unknown>
}

// ============================================================================
// 3. OCR & Document Parsing Contracts (PaddleOCR Reference)
// ============================================================================

export interface OCRBoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface OCRLine {
  text: string
  confidence: number
  box?: OCRBoundingBox
}

export interface OCRInput {
  imageUrl?: string
  imageBase64?: string
  language?: string
}

export interface OCROutput {
  text: string
  lines: OCRLine[]
  confidence: number
}

// ============================================================================
// 4. Speech Recognition Contracts (Faster-Whisper Reference)
// ============================================================================

export interface SpeechSegment {
  start: number
  end: number
  text: string
  confidence?: number
}

export interface SpeechTranscriptionInput {
  audioUrl?: string
  audioBase64?: string
  language?: string
  prompt?: string
}

export interface SpeechTranscriptionOutput {
  text: string
  duration?: number
  language?: string
  segments: SpeechSegment[]
}

// ============================================================================
// 5. AI Vision & Multimodal Contracts (Transformers Reference)
// ============================================================================

export interface VisionLabel {
  label: string
  score: number
  box?: OCRBoundingBox
}

export interface VisionInput {
  imageUrl?: string
  imageBase64?: string
  prompt?: string
  task?: 'caption' | 'vqa' | 'detect' | 'classify'
}

export interface VisionOutput {
  description: string
  labels?: VisionLabel[]
  answer?: string
}

// ============================================================================
// 6. Web Search Contracts (Tavily Reference)
// ============================================================================

export interface SearchResultItem {
  title: string
  url: string
  content: string
  score?: number
}

export interface WebSearchInput {
  query: string
  maxResults?: number
  includeAnswer?: boolean
}

export interface WebSearchOutput {
  query: string
  results: SearchResultItem[]
  answer?: string
}

// ============================================================================
// 7. Background Jobs & Queues Contracts (BullMQ Reference)
// ============================================================================

export type QueueJobStatus = 'waiting' | 'active' | 'completed' | 'failed'

export interface QueueJob<TData = unknown, TResult = unknown> {
  id: string
  name: string
  data: TData
  priority?: number
  delayMs?: number
  attempts?: number
  maxAttempts?: number
  status: QueueJobStatus
  result?: TResult
  error?: string
  createdAt: number
  processedAt?: number
  finishedAt?: number
}

export interface QueueAddJobInput<TData = unknown> {
  name: string
  data: TData
  priority?: number
  delayMs?: number
  maxAttempts?: number
}

export interface QueueJobStats {
  waiting: number
  active: number
  completed: number
  failed: number
  total: number
}

export interface QueueJobOutput<TResult = unknown> {
  jobId: string
  status: QueueJobStatus
  result?: TResult
  error?: string
}
