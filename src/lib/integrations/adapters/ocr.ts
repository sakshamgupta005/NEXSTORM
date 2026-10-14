/**
 * OCR & Document Parsing Integration Adapters
 * 
 * Reference: PaddleOCR (https://github.com/PaddlePaddle/PaddleOCR)
 * License: Apache-2.0
 * 
 * Provides:
 * - ocr:mock: Deterministic layout and text extraction for offline tests
 * - ocr:http: Generic HTTP adapter for PaddleOCR container or serving endpoints
 */

import { isValidEnvValue } from '../../env'
import type { IntegrationDefinition } from '../registry'
import type { OCRInput, OCROutput, OCRBoundingBox } from '../types'

export const mockOCRDefinition: IntegrationDefinition<OCRInput, OCROutput> = {
  id: 'ocr:mock',
  category: 'ocr',
  name: 'Mock OCR Engine',
  description: 'Deterministic text detection and OCR parser for testing and development',
  referenceRepo: 'https://github.com/PaddlePaddle/PaddleOCR',
  license: 'Apache-2.0',
  requiredEnvVars: [],
  isConfigured: () => true,
  checkHealth: async () => ({
    status: 'healthy',
    message: 'Mock OCR engine operational',
  }),
  createAdapter: () => ({
    execute: async () => {
      const sampleLines = [
        { text: 'INVOICE #INV-2026-0042', confidence: 0.99, box: { x: 50, y: 30, width: 220, height: 24 } },
        { text: 'Bill To: Acme Technologies Inc.', confidence: 0.97, box: { x: 50, y: 70, width: 260, height: 20 } },
        { text: 'Amount Due: $1,250.00 USD', confidence: 0.98, box: { x: 50, y: 110, width: 210, height: 22 } },
      ]

      return {
        text: sampleLines.map((l) => l.text).join('\n'),
        lines: sampleLines,
        confidence: 0.98,
      }
    },
  }),
}

export const httpOCRDefinition: IntegrationDefinition<OCRInput, OCROutput> = {
  id: 'ocr:http',
  category: 'ocr',
  name: 'PaddleOCR HTTP Service Adapter',
  description: 'HTTP adapter communicating with a PaddleOCR microservice or FastDeploy container',
  referenceRepo: 'https://github.com/PaddlePaddle/PaddleOCR',
  license: 'Apache-2.0',
  requiredEnvVars: ['OCR_SERVICE_URL'],
  isConfigured: () => isValidEnvValue(process.env.OCR_SERVICE_URL),
  checkHealth: async () => {
    const url = process.env.OCR_SERVICE_URL
    if (!isValidEnvValue(url)) {
      return {
        status: 'unhealthy',
        message: 'OCR_SERVICE_URL is not configured',
      }
    }
    return {
      status: 'healthy',
      message: `OCR endpoint configured at ${url}`,
    }
  },
  createAdapter: (config) => ({
    execute: async (input, options) => {
      const serviceUrl =
        (config?.serviceUrl as string | undefined) ||
        process.env.OCR_SERVICE_URL

      if (!isValidEnvValue(serviceUrl)) {
        throw new Error('OCR_SERVICE_URL is not configured')
      }

      const response = await fetch(serviceUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: input.imageUrl,
          image_base64: input.imageBase64,
          language: input.language || 'en',
        }),
        signal: options?.signal,
      })

      if (!response.ok) {
        throw new Error(`OCR service request failed with HTTP ${response.status}`)
      }

      const data = await response.json()
      return {
        text: data.text || '',
        lines: (data.lines || []).map(
          (l: { text?: string; confidence?: number; box?: OCRBoundingBox }) => ({
            text: l.text || '',
            confidence: Number(l.confidence ?? 1),
            box: l.box,
          })
        ),
        confidence: Number(data.confidence ?? 1),
      }
    },
  }),
}
