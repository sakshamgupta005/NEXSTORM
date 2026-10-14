/**
 * Reusable RFC-4180 CSV Serializer with Formula-Injection Defense
 * 
 * References:
 * - Papa Parse: RFC-4180 delimiter escaping and quoting (MIT)
 * - OWASP: CSV / Formula Injection Defense (CWE-1236)
 */

import type { ColumnDefinition, ExportOptions } from './types'

const FORMULA_TRIGGERS = new Set(['=', '+', '-', '@', '\t', '\r'])

/**
 * Sanitizes untrusted values to prevent spreadsheet formula injection attacks (CWE-1236).
 * Prepend a single quote (') if the string begins with =, +, -, @, \t, or \r.
 */
export function sanitizeFormulaValue(value: string): string {
  if (!value || typeof value !== 'string') return value

  const firstChar = value.charAt(0)
  if (FORMULA_TRIGGERS.has(firstChar)) {
    // Exclude standard valid numeric representations like -42 or +10
    if ((firstChar === '-' || firstChar === '+') && !Number.isNaN(Number(value))) {
      return value
    }
    return `'${value}`
  }

  return value
}

/**
 * Serializes a single cell value into an RFC-4180 compliant CSV field.
 */
export function formatCsvCell(
  value: unknown,
  delimiter: string,
  protectFormulas: boolean
): string {
  if (value === null || value === undefined) {
    return ''
  }

  let formatted: string
  if (value instanceof Date) {
    formatted = value.toISOString()
  } else if (typeof value === 'object') {
    formatted = JSON.stringify(value)
  } else {
    formatted = String(value)
  }

  if (protectFormulas) {
    formatted = sanitizeFormulaValue(formatted)
  }

  // Check if cell needs RFC-4180 quoting
  const needsQuotes =
    formatted.includes(delimiter) ||
    formatted.includes('"') ||
    formatted.includes('\n') ||
    formatted.includes('\r')

  if (needsQuotes) {
    return `"${formatted.replace(/"/g, '""')}"`
  }

  return formatted
}

/**
 * Converts an array of records into an RFC-4180 CSV string with configurable headers,
 * formula injection defenses, and UTF-8 BOM support.
 */
export function recordsToCsv<T = Record<string, unknown>>(
  records: T[],
  options: ExportOptions<T> = {}
): string {
  const maxRows = options.maxRows ?? 50000
  if (records.length > maxRows) {
    throw new Error(
      `Dataset exceeds maximum row limit of ${maxRows.toLocaleString()} rows (got ${records.length.toLocaleString()})`
    )
  }

  const delimiter = options.delimiter || ','
  const protectFormulas = options.protectFormulas !== false
  const includeBom = options.includeBom !== false

  // Determine columns
  let columns: ColumnDefinition<T>[]
  if (options.columns && options.columns.length > 0) {
    columns = options.columns
  } else if (records.length > 0 && typeof records[0] === 'object' && records[0] !== null) {
    // Derive columns from keys of first record
    columns = Object.keys(records[0] as Record<string, unknown>).map((key) => ({
      key,
      header: key,
    }))
  } else {
    columns = []
  }

  const lines: string[] = []

  // 1. Header row
  if (columns.length > 0) {
    const headerRow = columns
      .map((col) => formatCsvCell(col.header, delimiter, false))
      .join(delimiter)
    lines.push(headerRow)
  }

  // 2. Data rows
  for (const record of records) {
    const rowValues = columns.map((col) => {
      const rawVal = (record as Record<string, unknown>)[col.key]
      const val = col.formatter ? col.formatter(rawVal, record) : rawVal
      return formatCsvCell(val, delimiter, protectFormulas)
    })
    lines.push(rowValues.join(delimiter))
  }

  const csvContent = lines.join('\r\n')
  return includeBom ? `\uFEFF${csvContent}` : csvContent
}
