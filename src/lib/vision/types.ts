/**
 * Reusable OCR & Vision Toolkit — Types & Contracts
 * 
 * References:
 * - PaddleOCR: Production text detection & recognition (Apache-2.0)
 * - Tesseract OCR: Established open-source OCR engine (Apache-2.0)
 * - Transformers.js: Lightweight browser/Node vision pipelines (Apache-2.0)
 * - OpenCV: Image preprocessing standards (Apache-2.0)
 * - Docling: Document conversion & structured parsing (MIT)
 * - Marker: PDF layout & markdown conversion (GPL-3.0 / PolyForm)
 */

import { z } from 'zod'
import type { AIProvider } from '../ai/types'

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'pdf'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface OCRWord {
  text: string
  confidence: number
  box?: BoundingBox
}

export interface OCRLine {
  text: string
  confidence: number
  box?: BoundingBox
  words?: OCRWord[]
}

export interface OCRPage {
  pageNumber: number
  text: string
  lines: OCRLine[]
  confidence: number
  width?: number
  height?: number
}

export interface ImageInput {
  /** Raw base64 or data URI */
  imageBase64?: string
  /** Image or document URL */
  imageUrl?: string
  /** Binary buffer or Uint8Array */
  imageBuffer?: Uint8Array
  /** Explicit format or MIME type */
  mimeType?: string
  /** Original filename for tracking */
  filename?: string
  /** Expected page count for multi-page documents */
  pageCount?: number
}

export interface PreprocessOptions {
  maxWidth?: number
  maxHeight?: number
  rotateDegrees?: 0 | 90 | 180 | 270
  grayscale?: boolean
  contrast?: number
  denoise?: boolean
}

export type OCRProvider = 'mock' | 'paddle' | 'tesseract-service' | 'cloud'

export interface OCROptions {
  provider?: OCRProvider
  language?: string
  serviceUrl?: string
  apiKey?: string
  preprocess?: PreprocessOptions
  timeoutMs?: number
  signal?: AbortSignal
}

export interface OCRResult {
  success: boolean
  text: string
  pages: OCRPage[]
  confidence: number
  provider: OCRProvider
  latencyMs: number
  error?: string
  errorCode?: string
  metadata?: Record<string, unknown>
}

export type VisionTask = 'describe' | 'vqa' | 'extract' | 'summarize'

export interface VisionRequest<T = unknown> {
  images: ImageInput[]
  prompt?: string
  task?: VisionTask
  schema?: z.ZodType<T>
  provider?: AIProvider
  model?: string
  timeoutMs?: number
  signal?: AbortSignal
}

export interface VisionResult<T = unknown> {
  success: boolean
  description?: string
  answer?: string
  structuredData?: T
  provider: AIProvider
  latencyMs: number
  confidence?: number
  error?: string
  errorCode?: string
}

export interface DocumentExtractionResult {
  documentId: string
  filename?: string
  mimeType: string
  pageCount: number
  pages: OCRPage[]
  fullText: string
  confidence: number
  metadata?: Record<string, unknown>
}
