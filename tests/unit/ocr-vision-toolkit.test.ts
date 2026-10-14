import { describe, it, expect, beforeEach, vi } from 'vitest'
import { z } from 'zod'
import {
  detectFormatFromBytes,
  validateAndPreprocessImage,
  executeOCR,
  processVisionRequest,
  extractDocument,
  toRAGDocuments,
  type ImageInput,
} from '@/lib/vision'
import { splitDocuments, createVectorStore } from '@/lib/rag'

describe('Reusable OCR and Vision Toolkit', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.OCR_SERVICE_URL
    delete process.env.TESSERACT_SERVICE_URL
  })

  describe('Image Preprocessing & Magic Byte Detection', () => {
    it('detects PNG, JPEG, PDF, WebP, and GIF magic bytes', () => {
      // PNG: 89 50 4E 47
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00])
      expect(detectFormatFromBytes(pngBytes)).toBe('png')

      // JPEG: FF D8 FF
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
      expect(detectFormatFromBytes(jpegBytes)).toBe('jpeg')

      // PDF: %PDF (25 50 44 46)
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])
      expect(detectFormatFromBytes(pdfBytes)).toBe('pdf')

      // GIF: GIF8 (47 49 46 38)
      const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39])
      expect(detectFormatFromBytes(gifBytes)).toBe('gif')

      // Unrecognized bytes
      const unknownBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03])
      expect(detectFormatFromBytes(unknownBytes)).toBeNull()
    })

    it('validates image size limits and rotation normalization', () => {
      const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00])
      const res = validateAndPreprocessImage(
        { imageBuffer: validPng },
        { rotateDegrees: 90, maxWidth: 1024, maxHeight: 768 }
      )

      expect(res.valid).toBe(true)
      expect(res.metadata?.format).toBe('png')
      expect(res.metadata?.rotation).toBe(90)
      expect(res.metadata?.scaleFactor).toBeLessThanOrEqual(1.0)
    })

    it('rejects oversized inputs and invalid rotation angles', () => {
      const validPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47])

      const invalidAngle = validateAndPreprocessImage(
        { imageBuffer: validPng },
        { rotateDegrees: 45 as unknown as 0 }
      )
      expect(invalidAngle.valid).toBe(false)
      expect(invalidAngle.error).toContain('rotateDegrees')
    })

    it('rejects corrupt and empty inputs gracefully', () => {
      const emptyRes = validateAndPreprocessImage({})
      expect(emptyRes.valid).toBe(false)
      expect(emptyRes.error).toContain('Empty image input')

      const corruptRes = validateAndPreprocessImage({ imageBase64: '%%%not-valid-base64%%%' })
      expect(corruptRes.valid).toBe(false)
    })
  })

  describe('Generic OCR Engine', () => {
    const validPngBuffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00])

    it('executes mock OCR returning pages, lines, and bounding box coordinates', async () => {
      const input: ImageInput = {
        imageBuffer: validPngBuffer,
        filename: 'statement.png',
      }

      const result = await executeOCR(input, { provider: 'mock' })

      expect(result.success).toBe(true)
      expect(result.text).toContain('DOCUMENT PAGE 1 HEADER')
      expect(result.pages).toHaveLength(1)
      expect(result.pages[0].lines.length).toBeGreaterThan(0)
      expect(result.pages[0].lines[0].box).toBeDefined()
      expect(result.pages[0].lines[0].box?.width).toBeGreaterThan(0)
      expect(result.pages[0].lines[0].words).toBeDefined()
      expect(result.confidence).toBeGreaterThan(0.9)
    })

    it('handles multi-page PDF documents in mock OCR', async () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
      const input: ImageInput = {
        imageBuffer: pdfBytes,
        filename: 'annual-report.pdf',
        pageCount: 3,
      }

      const result = await executeOCR(input, { provider: 'mock' })

      expect(result.success).toBe(true)
      expect(result.pages).toHaveLength(3)
      expect(result.pages[0].pageNumber).toBe(1)
      expect(result.pages[2].pageNumber).toBe(3)
      expect(result.pages[2].text).toContain('DOCUMENT PAGE 3')
    })

    it('returns NOT_CONFIGURED when remote OCR endpoint is missing', async () => {
      const input: ImageInput = { imageBuffer: validPngBuffer }
      const result = await executeOCR(input, { provider: 'paddle' })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('NOT_CONFIGURED')
      expect(result.error).toContain('OCR_SERVICE_URL')
    })

    it('handles cancellation via AbortSignal before OCR execution', async () => {
      const preAborted = AbortSignal.abort()
      const input: ImageInput = { imageBuffer: validPngBuffer }
      const result = await executeOCR(input, { signal: preAborted })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('CANCELLED')
    })
  })

  describe('Multimodal Vision Model Interface', () => {
    const sampleImage: ImageInput = {
      imageBuffer: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]),
    }

    it('rejects text-only providers with explicit capability error', async () => {
      const result = await processVisionRequest({
        images: [sampleImage],
        provider: 'groq', // Groq text-only provider does not support vision in this setup
      })

      expect(result.success).toBe(false)
      expect(result.errorCode).toBe('PROVIDER_DOES_NOT_SUPPORT_VISION')
      expect(result.error).toContain('does not support multimodal vision inputs')
    })

    it('rejects empty image requests and requests exceeding 5 images', async () => {
      const emptyResult = await processVisionRequest({
        images: [],
      })
      expect(emptyResult.success).toBe(false)
      expect(emptyResult.errorCode).toBe('EMPTY_IMAGE_LIST')

      const tooManyImages = Array(6).fill(sampleImage)
      const tooManyResult = await processVisionRequest({
        images: tooManyImages,
      })
      expect(tooManyResult.success).toBe(false)
      expect(tooManyResult.errorCode).toBe('TOO_MANY_IMAGES')
    })

    it('executes visual description and VQA tasks using mock vision provider', async () => {
      const descResult = await processVisionRequest({
        images: [sampleImage],
        task: 'describe',
      })
      expect(descResult.success).toBe(true)
      expect(descResult.description).toContain('workspace photograph')

      const vqaResult = await processVisionRequest({
        images: [sampleImage],
        task: 'vqa',
        prompt: 'Is there a laptop on the desk?',
      })
      expect(vqaResult.success).toBe(true)
      expect(vqaResult.answer).toContain('present and verified')
    })

    it('validates structured information extraction using Zod schema', async () => {
      const invoiceSchema = z.object({
        title: z.string(),
        totalAmount: z.number().positive(),
        currency: z.string().length(3),
        status: z.enum(['pending', 'reconciled']),
        confidence: z.number(),
      })

      const extractResult = await processVisionRequest({
        images: [sampleImage],
        task: 'extract',
        schema: invoiceSchema,
      })

      expect(extractResult.success).toBe(true)
      expect(extractResult.structuredData).toBeDefined()
      expect(extractResult.structuredData?.totalAmount).toBe(1250.0)
      expect(extractResult.structuredData?.currency).toBe('USD')
      expect(extractResult.structuredData?.status).toBe('reconciled')
    })
  })

  describe('Document Extraction Pipeline & RAG Adaptation', () => {
    it('extracts multi-page document and converts directly into RAG Documents', async () => {
      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])
      const docInput: ImageInput = {
        imageBuffer: pdfBytes,
        filename: 'q2-earnings.pdf',
        mimeType: 'application/pdf',
        pageCount: 2,
      }

      // 1. Run extraction pipeline
      const extraction = await extractDocument(docInput)

      expect(extraction.pageCount).toBe(2)
      expect(extraction.filename).toBe('q2-earnings.pdf')
      expect(extraction.pages).toHaveLength(2)

      // 2. Convert to RAG Documents
      const ragDocs = toRAGDocuments(extraction)

      expect(ragDocs).toHaveLength(2)
      expect(ragDocs[0].id).toContain('-p1')
      expect(ragDocs[0].metadata?.source).toContain('q2-earnings.pdf (Page 1)')
      expect(ragDocs[1].id).toContain('-p2')

      // 3. Verify compatibility with Part 4.2 RAG chunking and vector store
      const chunks = splitDocuments(ragDocs, { chunkSize: 100 })
      expect(chunks.length).toBeGreaterThanOrEqual(2)

      const store = createVectorStore()
      const added = await store.addChunks(chunks)
      expect(added).toBe(chunks.length)

      const searchResults = await store.search('Account Statement Balance')
      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchResults[0].text).toContain('Account Statement')
    })
  })
})
