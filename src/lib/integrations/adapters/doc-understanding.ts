/**
 * Document Understanding Integration Adapters
 * 
 * Reference: RAGFlow (https://github.com/infiniflow/ragflow)
 * License: Apache-2.0
 * 
 * Provides:
 * - doc_understanding:mock: Deterministic structural document analysis for tests
 * - doc_understanding:ragflow: HTTP adapter for RAGFlow document parsing service
 */

import { isValidEnvValue } from '../../env'
import type { IntegrationDefinition } from '../registry'
import type { DocUnderstandingInput, DocUnderstandingOutput } from '../types'

export const mockDocUnderstandingDefinition: IntegrationDefinition<
  DocUnderstandingInput,
  DocUnderstandingOutput
> = {
  id: 'doc_understanding:mock',
  category: 'doc_understanding',
  name: 'Mock Deep Document Parser',
  description: 'Deterministic document structure, layout, and table extraction engine',
  referenceRepo: 'https://github.com/infiniflow/ragflow',
  license: 'Apache-2.0',
  requiredEnvVars: [],
  isConfigured: () => true,
  checkHealth: async () => ({
    status: 'healthy',
    message: 'Mock document understanding engine operational',
  }),
  createAdapter: () => ({
    execute: async (input) => {
      const tables = input.extractTables !== false
        ? [
            {
              caption: 'Quarterly Revenue Performance ($M)',
              headers: ['Quarter', 'Target', 'Actual', 'Growth (%)'],
              rows: [
                ['Q1 2026', '12.0', '13.4', '+11.7%'],
                ['Q2 2026', '14.5', '15.2', '+4.8%'],
                ['Q3 2026', '16.0', '17.8', '+11.2%'],
              ],
            },
          ]
        : []

      const sections = [
        {
          title: 'Executive Summary',
          pageNumber: 1,
          content: 'The document outlines organizational milestones, technical infrastructure, and performance metrics.',
        },
        {
          title: 'Technical Milestones',
          pageNumber: 2,
          content: 'Key deliverables include real-time integrations, offline-first reliability, and strict validation boundaries.',
        },
      ]

      return {
        summary: 'Parsed business document containing 2 primary sections and 1 data table.',
        sections,
        tables,
        metadata: {
          mimeType: input.mimeType || 'application/pdf',
          pageCount: 2,
        },
      }
    },
  }),
}

export const ragflowDocUnderstandingDefinition: IntegrationDefinition<
  DocUnderstandingInput,
  DocUnderstandingOutput
> = {
  id: 'doc_understanding:ragflow',
  category: 'doc_understanding',
  name: 'RAGFlow Document Parsing Adapter',
  description: 'HTTP adapter communicating with a RAGFlow backend for deep document analysis',
  referenceRepo: 'https://github.com/infiniflow/ragflow',
  license: 'Apache-2.0',
  requiredEnvVars: ['RAGFLOW_SERVICE_URL'],
  isConfigured: () => isValidEnvValue(process.env.RAGFLOW_SERVICE_URL),
  checkHealth: async () => {
    const url = process.env.RAGFLOW_SERVICE_URL
    if (!isValidEnvValue(url)) {
      return {
        status: 'unhealthy',
        message: 'RAGFLOW_SERVICE_URL is not configured',
      }
    }
    return {
      status: 'healthy',
      message: `RAGFlow service endpoint configured at ${url}`,
    }
  },
  createAdapter: (config) => ({
    execute: async (input, options) => {
      const serviceUrl =
        (config?.serviceUrl as string | undefined) ||
        process.env.RAGFLOW_SERVICE_URL

      if (!isValidEnvValue(serviceUrl)) {
        throw new Error('RAGFLOW_SERVICE_URL is not configured')
      }

      const apiKey =
        (config?.apiKey as string | undefined) ||
        process.env.RAGFLOW_API_KEY

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (isValidEnvValue(apiKey)) {
        headers['Authorization'] = `Bearer ${apiKey}`
      }

      const response = await fetch(`${serviceUrl}/api/v1/document/parse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          document_url: input.documentUrl,
          document_base64: input.documentBase64,
          extract_tables: input.extractTables,
        }),
        signal: options?.signal,
      })

      if (!response.ok) {
        throw new Error(`RAGFlow document parsing failed with HTTP ${response.status}`)
      }

      const data = await response.json()
      return {
        summary: data.summary || '',
        sections: data.sections || [],
        tables: data.tables || [],
        metadata: data.metadata,
      }
    },
  }),
}
