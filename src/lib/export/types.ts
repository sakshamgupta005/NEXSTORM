/**
 * Reusable Export, Reporting & Document Generation Types
 * 
 * References:
 * - ExcelJS: Workbook & worksheet specifications, column mappings, styles (MIT)
 * - PDFKit: Vector document structure, multi-page flows, typography (MIT)
 * - Papa Parse: RFC-4180 CSV serialization & delimiter escaping (MIT)
 * - SheetJS: Multi-format spreadsheet abstractions (Apache-2.0)
 */

export type ExportFormat = 'csv' | 'json' | 'excel' | 'pdf' | 'html'

/** Column configuration for tabular data exports */
export interface ColumnDefinition<T = Record<string, unknown>> {
  /** Property key on the record */
  key: string
  /** Human-readable column header title */
  header: string
  /** Suggested column width in characters/points */
  width?: number
  /** Custom value formatter */
  formatter?: (value: unknown, row: T) => string | number | boolean | null | undefined
}

/** Configuration options for tabular exports */
export interface ExportOptions<T = Record<string, unknown>> {
  /** Suggested download filename (without or with extension) */
  filename?: string
  /** Title of the document or report */
  title?: string
  /** Custom column mappings; if omitted, inferred from the first record keys */
  columns?: ColumnDefinition<T>[]
  /** Sheet name for Excel workbooks (default: 'Sheet1') */
  sheetName?: string
  /** Maximum number of rows allowed before throwing an error (default: 50,000) */
  maxRows?: number
  /** Whether to neutralize formula injection characters (=, +, -, @) (default: true) */
  protectFormulas?: boolean
  /** Whether to include UTF-8 Byte Order Mark (\uFEFF) in CSV for Excel compatibility (default: true) */
  includeBom?: boolean
  /** Custom delimiter for CSV exports (default: ',') */
  delimiter?: string
  /** Custom metadata to embed in JSON or report header */
  metadata?: Record<string, unknown>
}

/** Output artifact from an export operation */
export interface ExportResult {
  /** Sanitized output filename with extension */
  filename: string
  /** Export format */
  format: ExportFormat
  /** Standard MIME Content-Type header */
  contentType: string
  /** Exported payload as string or binary Buffer */
  data: string | Uint8Array
  /** Payload size in bytes */
  sizeBytes: number
  /** Total number of data rows processed */
  rowCount: number
  /** Generation timestamp */
  generatedAt: string
}

// --- PDF & Document Reporting Types ---

export type ReportSectionType = 'heading' | 'paragraph' | 'key_value' | 'table' | 'page_break'

export interface ReportSection<T = Record<string, unknown>> {
  type: ReportSectionType
  /** Heading level: 1 (H1), 2 (H2), or 3 (H3) */
  level?: 1 | 2 | 3
  /** Text content for heading or paragraph */
  content?: string
  /** Key-value dictionary or array of records for tables */
  data?: Record<string, unknown> | T[]
  /** Column definitions when section is a table */
  columns?: ColumnDefinition<T>[]
}

/** Document structure for structured PDF or HTML reports */
export interface ReportDocument<T = Record<string, unknown>> {
  /** Main report title */
  title: string
  /** Optional subtitle or description */
  subtitle?: string
  /** Author or generating service */
  author?: string
  /** Creation timestamp */
  generatedAt?: Date | string
  /** Header text displayed at top of each page */
  headerText?: string
  /** Footer text displayed at bottom of each page */
  footerText?: string
  /** Whether to render page numbers (e.g. Page 1 of 3) */
  includePageNumbers?: boolean
  /** Report content sections */
  sections: ReportSection<T>[]
}
