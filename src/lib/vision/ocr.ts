/**
 * Provider-Neutral OCR Engine
 * 
 * References:
 * - PaddleOCR: Deep learning OCR with table & layout detection (Apache-2.0)
 * - Tesseract OCR: Fast multilingual text extraction (Apache-2.0)
 */

import { isValidEnvValue } from '../env'
import { validateAndPreprocessImage } from './preprocessing'
import type { ImageInput, OCROptions, OCRResult } from './types'

function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string
): Promise<T> {
  let timer: NodeJS.Timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(errorMessage)
      error.name = 'TimeoutError'
      reject(error)
    }, ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer)
  })
}

export async function executeOCR(
  input: ImageInput,
  options?: OCROptions
): Promise<OCRResult> {
  const startTime = Date.now()
  const provider = options?.provider || 'mock'

  // 1. Validation & Preprocessing
  const prep = validateAndPreprocessImage(input, options?.preprocess)
  if (!prep.valid) {
    return {
      success: false,
      text: '',
      pages: [],
      confidence: 0,
      provider,
      latencyMs: Date.now() - startTime,
      error: prep.error || 'Invalid image input',
      errorCode: 'INVALID_IMAGE',
    }
  }

  // 2. Cancellation check
  if (options?.signal?.aborted) {
    return {
      success: false,
      text: '',
      pages: [],
      confidence: 0,
      provider,
      latencyMs: 0,
      error: 'OCR execution was aborted',
      errorCode: 'CANCELLED',
    }
  }

  try {
    let ocrPromise: Promise<{
      text: string
      pages: OCRResult['pages']
      confidence: number
      metadata?: Record<string, unknown>
    }>

    switch (provider) {
      case 'mock': {
        ocrPromise = (async () => {
          const isPdf = prep.metadata?.format === 'pdf'
          const pageCount = isPdf ? Math.max(1, input.pageCount ?? 2) : 1

          const samplePages = []
          for (let p = 1; p <= pageCount; p++) {
            const lines = [
              {
                text: `DOCUMENT PAGE ${p} HEADER`,
                confidence: 0.99,
                box: { x: 40, y: 30, width: 300, height: 24 },
                words: [
                  { text: 'DOCUMENT', confidence: 0.99, box: { x: 40, y: 30, width: 100, height: 24 } },
                  { text: `PAGE ${p}`, confidence: 0.99, box: { x: 150, y: 30, width: 80, height: 24 } },
                ],
              },
              {
                text: 'Account Statement - Total Balance: $5,420.50 USD',
                confidence: 0.97,
                box: { x: 40, y: 70, width: 420, height: 22 },
              },
              {
                text: 'Status: Verified and reconciled successfully.',
                confidence: 0.98,
                box: { x: 40, y: 110, width: 380, height: 20 },
              },
            ]

            samplePages.push({
              pageNumber: p,
              text: lines.map((l) => l.text).join('\n'),
              lines,
              confidence: 0.98,
              width: 1920,
              height: 1080,
            })
          }

          const fullText = samplePages.map((sp) => sp.text).join('\n\n')
          return {
            text: fullText,
            pages: samplePages,
            confidence: 0.98,
            metadata: {
              format: prep.metadata?.format,
              pageCount,
              rotation: prep.metadata?.rotation,
            },
          }
        })()
        break
      }

      case 'paddle':
      case 'tesseract-service':
      case 'cloud': {
        const url =
          options?.serviceUrl ||
          (provider === 'paddle'
            ? process.env.OCR_SERVICE_URL
            : process.env.TESSERACT_SERVICE_URL)

        if (!isValidEnvValue(url)) {
          throw new Error(
            `Service URL for ${provider} is not configured (set OCR_SERVICE_URL or TESSERACT_SERVICE_URL)`
          )
        }

        ocrPromise = (async () => {
          const response = await fetch(`${url}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image_base64: input.imageBase64,
              image_url: input.imageUrl,
              language: options?.language || 'en',
              preprocess: options?.preprocess,
            }),
            signal: options?.signal,
          })

          if (!response.ok) {
            throw new Error(`OCR service failed with status ${response.status}`)
          }

          const data = await response.json()
          return {
            text: data.text || '',
            pages: data.pages || [
              {
                pageNumber: 1,
                text: data.text || '',
                lines: data.lines || [],
                confidence: data.confidence ?? 1.0,
              },
            ],
            confidence: data.confidence ?? 1.0,
            metadata: data.metadata,
          }
        })()
        break
      }
    }

    if (options?.timeoutMs && options.timeoutMs > 0) {
      ocrPromise = raceWithTimeout(
        ocrPromise,
        options.timeoutMs,
        `OCR execution timed out after ${options.timeoutMs}ms`
      )
    }

    const data = await ocrPromise
    const latencyMs = Date.now() - startTime

    return {
      success: true,
      text: data.text,
      pages: data.pages,
      confidence: data.confidence,
      provider,
      latencyMs,
      metadata: data.metadata,
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime
    const errorMessage = err instanceof Error ? err.message : String(err)
    const errorName = err instanceof Error ? err.name : 'Error'

    let errorCode = 'PROVIDER_ERROR'
    if (errorName === 'TimeoutError' || errorMessage.includes('timed out')) {
      errorCode = 'TIMEOUT'
    } else if (errorName === 'AbortError' || errorMessage.includes('aborted')) {
      errorCode = 'CANCELLED'
    } else if (errorMessage.includes('not configured')) {
      errorCode = 'NOT_CONFIGURED'
    }

    return {
      success: false,
      text: '',
      pages: [],
      confidence: 0,
      provider,
      latencyMs,
      error: errorMessage,
      errorCode,
    }
  }
}
