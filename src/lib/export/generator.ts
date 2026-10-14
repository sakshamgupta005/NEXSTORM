/**
 * Unified Document Export & Report Generation Engine
 * 
 * Capabilities:
 * - Multi-format export dispatcher (CSV, JSON, Excel, PDF, HTML)
 * - Safe filename sanitization protecting against directory traversal
 * - Seamless integration with IFileStorageAdapter for cloud/local archival
 * - Consistent metadata, content-types, and error reporting
 */

import type {
  ExportFormat,
  ExportOptions,
  ExportResult,
  ReportDocument,
} from './types'
import { recordsToCsv } from './csv'
import { recordsToJson } from './json'
import { recordsToExcelXml } from './excel'
import { generatePdfDocument, generatePrintableHtml } from './pdf'
import { sanitizeFileName } from '../security/sanitize'
import type { IFileStorageAdapter, StorageUploadResult } from '../storage/types'

const FORMAT_EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  json: 'json',
  excel: 'xls',
  pdf: 'pdf',
  html: 'html',
}

const FORMAT_MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
  excel: 'application/vnd.ms-excel; charset=utf-8',
  pdf: 'application/pdf',
  html: 'text/html; charset=utf-8',
}

/**
 * Sanitizes and generates a safe, downloadable filename with the appropriate extension.
 */
export function sanitizeExportFilename(
  rawFilename: string | undefined,
  format: ExportFormat
): string {
  const extension = FORMAT_EXTENSIONS[format]
  let baseName = rawFilename ? rawFilename.trim() : `export_${Date.now()}`

  // Strip path traversal attempts and dangerous characters
  baseName = sanitizeFileName(baseName)

  // Remove existing extension if it matches
  if (baseName.toLowerCase().endsWith(`.${extension}`)) {
    baseName = baseName.slice(0, -(extension.length + 1))
  }

  // Fallback if baseName was sanitized to empty
  if (!baseName) {
    baseName = `export_${Date.now()}`
  }

  return `${baseName}.${extension}`
}

/**
 * Exports an array of records into the desired format (CSV, JSON, Excel, PDF, or HTML).
 */
export function exportData<T = Record<string, unknown>>(
  records: T[],
  format: ExportFormat,
  options: ExportOptions<T> = {}
): ExportResult {
  if (!Array.isArray(records)) {
    throw new Error('Records input must be an array')
  }

  const filename = sanitizeExportFilename(options.filename, format)
  const contentType = FORMAT_MIME_TYPES[format]
  const generatedAt = new Date().toISOString()
  let data: string | Uint8Array

  switch (format) {
    case 'csv': {
      data = recordsToCsv(records, options)
      break
    }

    case 'json': {
      data = recordsToJson(records, options)
      break
    }

    case 'excel': {
      data = recordsToExcelXml(records, options)
      break
    }

    case 'pdf': {
      const doc: ReportDocument<T> = {
        title: options.title || 'Export Report',
        generatedAt,
        sections: [
          {
            type: 'table',
            data: records,
            columns: options.columns,
          },
        ],
      }
      data = generatePdfDocument(doc)
      break
    }

    case 'html': {
      const doc: ReportDocument<T> = {
        title: options.title || 'Export Report',
        generatedAt,
        sections: [
          {
            type: 'table',
            data: records,
            columns: options.columns,
          },
        ],
      }
      data = generatePrintableHtml(doc)
      break
    }

    default: {
      throw new Error(`Unsupported export format: ${String(format)}`)
    }
  }

  const sizeBytes = typeof data === 'string'
    ? new TextEncoder().encode(data).length
    : data.byteLength

  return {
    filename,
    format,
    contentType,
    data,
    sizeBytes,
    rowCount: records.length,
    generatedAt,
  }
}

/**
 * Generates a formatted multi-section report in PDF or HTML.
 */
export function generateReport<T = Record<string, unknown>>(
  document: ReportDocument<T>,
  format: 'pdf' | 'html' = 'pdf',
  options: ExportOptions<T> = {}
): ExportResult {
  if (!document || !document.title) {
    throw new Error('Report document must contain a valid title')
  }

  const filename = sanitizeExportFilename(options.filename || document.title, format)
  const contentType = FORMAT_MIME_TYPES[format]
  const generatedAt = document.generatedAt
    ? new Date(document.generatedAt).toISOString()
    : new Date().toISOString()

  let data: string | Uint8Array
  if (format === 'pdf') {
    data = generatePdfDocument(document)
  } else {
    data = generatePrintableHtml(document)
  }

  const sizeBytes = typeof data === 'string'
    ? new TextEncoder().encode(data).length
    : data.byteLength

  return {
    filename,
    format,
    contentType,
    data,
    sizeBytes,
    rowCount: document.sections.length,
    generatedAt,
  }
}

/**
 * Exports data and automatically uploads the result to storage (Local or Supabase Storage).
 */
export async function exportAndStore<T = Record<string, unknown>>(
  records: T[],
  format: ExportFormat,
  storage: IFileStorageAdapter,
  options: ExportOptions<T> & { isPublic?: boolean; path?: string } = {}
): Promise<{ exportResult: ExportResult; storageResult: StorageUploadResult }> {
  const exportResult = exportData(records, format, options)

  const uploadData = typeof exportResult.data === 'string'
    ? Buffer.from(exportResult.data, 'utf-8')
    : Buffer.from(exportResult.data)

  const storageResult = await storage.upload(uploadData, exportResult.filename, {
    path: options.path,
    contentType: exportResult.contentType,
    isPublic: options.isPublic ?? false,
    metadata: {
      format,
      rowCount: exportResult.rowCount,
      ...options.metadata,
    },
  })

  return { exportResult, storageResult }
}
