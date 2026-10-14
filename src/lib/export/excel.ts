/**
 * Reusable SpreadsheetML (XML) Excel Workbook Generator
 * 
 * References:
 * - ExcelJS: Column dimensions, typed cell values, and workbook structures (MIT)
 * - Microsoft SpreadsheetML (XML) Specification: Native Excel-compatible XML format
 * - OWASP: Formula Injection Protection (CWE-1236)
 */

import type { ColumnDefinition, ExportOptions } from './types'
import { sanitizeFormulaValue } from './csv'

/**
 * Escapes characters for XML attributes and text content.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Converts a cell value into SpreadsheetML cell XML with appropriate type and formatting.
 */
function formatXmlCell(value: unknown, protectFormulas: boolean): string {
  if (value === null || value === undefined) {
    return '<ss:Cell><ss:Data ss:Type="String"></ss:Data></ss:Cell>'
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<ss:Cell><ss:Data ss:Type="Number">${value}</ss:Data></ss:Cell>`
  }

  if (typeof value === 'boolean') {
    return `<ss:Cell><ss:Data ss:Type="Boolean">${value ? 1 : 0}</ss:Data></ss:Cell>`
  }

  if (value instanceof Date) {
    const iso = value.toISOString().split('.')[0] // YYYY-MM-DDTHH:mm:ss
    return `<ss:Cell ss:StyleID="sDate"><ss:Data ss:Type="DateTime">${iso}</ss:Data></ss:Cell>`
  }

  let text = String(value)
  if (protectFormulas) {
    text = sanitizeFormulaValue(text)
  }

  return `<ss:Cell><ss:Data ss:Type="String">${escapeXml(text)}</ss:Data></ss:Cell>`
}

/**
 * Generates an Excel-compatible SpreadsheetML XML document from tabular records.
 */
export function recordsToExcelXml<T = Record<string, unknown>>(
  records: T[],
  options: ExportOptions<T> = {}
): string {
  const maxRows = options.maxRows ?? 50000
  if (records.length > maxRows) {
    throw new Error(
      `Dataset exceeds maximum row limit of ${maxRows.toLocaleString()} rows (got ${records.length.toLocaleString()})`
    )
  }

  const sheetName = escapeXml(options.sheetName || 'Sheet1')
  const protectFormulas = options.protectFormulas !== false

  // Determine columns
  let columns: ColumnDefinition<T>[]
  if (options.columns && options.columns.length > 0) {
    columns = options.columns
  } else if (records.length > 0 && typeof records[0] === 'object' && records[0] !== null) {
    columns = Object.keys(records[0] as Record<string, unknown>).map((key) => ({
      key,
      header: key,
      width: 120,
    }))
  } else {
    columns = []
  }

  const xmlParts: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<ss:Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:html="http://www.w3.org/TR/REC-html40">',
    ' <ss:Styles>',
    '  <ss:Style ss:ID="Default" ss:Name="Normal">',
    '   <ss:Alignment ss:Vertical="Center"/>',
    '   <ss:Font ss:FontName="Calibri" ss:Size="11" ss:Color="#000000"/>',
    '  </ss:Style>',
    '  <ss:Style ss:ID="sHeader">',
    '   <ss:Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#111827"/>',
    '   <ss:Interior ss:Color="#F3F4F6" ss:Pattern="Solid"/>',
    '   <ss:Borders>',
    '    <ss:Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D1D5DB"/>',
    '   </ss:Borders>',
    '  </ss:Style>',
    '  <ss:Style ss:ID="sDate">',
    '   <ss:NumberFormat ss:Format="yyyy-mm-dd hh:mm:ss"/>',
    '  </ss:Style>',
    ' </ss:Styles>',
    ` <ss:Worksheet ss:Name="${sheetName}">`,
    '  <ss:Table>',
  ]

  // Column definitions with widths
  for (const col of columns) {
    const width = col.width ? col.width : 100
    xmlParts.push(`   <ss:Column ss:Width="${width}"/>`)
  }

  // Header row
  if (columns.length > 0) {
    xmlParts.push('   <ss:Row ss:StyleID="sHeader">')
    for (const col of columns) {
      xmlParts.push(`    <ss:Cell><ss:Data ss:Type="String">${escapeXml(col.header)}</ss:Data></ss:Cell>`)
    }
    xmlParts.push('   </ss:Row>')
  }

  // Data rows
  for (const record of records) {
    xmlParts.push('   <ss:Row>')
    for (const col of columns) {
      const rawVal = (record as Record<string, unknown>)[col.key]
      const val = col.formatter ? col.formatter(rawVal, record) : rawVal
      xmlParts.push(`    ${formatXmlCell(val, protectFormulas)}`)
    }
    xmlParts.push('   </ss:Row>')
  }

  xmlParts.push('  </ss:Table>')
  xmlParts.push(' </ss:Worksheet>')
  xmlParts.push('</ss:Workbook>')

  return xmlParts.join('\r\n')
}
