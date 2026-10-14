/**
 * Reusable PDF Document & Report Generator
 * 
 * References:
 * - PDFKit: Vector page trees, content streams, and standard Type1 typography (MIT)
 * - Adobe PDF 1.4 Reference: Cross-reference tables, stream objects, and font dictionaries
 * 
 * Capabilities:
 * - Pure TypeScript binary %PDF-1.4 vector generator (Zero dependencies, Zero headless browser)
 * - Multi-page pagination, automatic line-wrapping, and vertical page breaks
 * - Titles, subtitles, metadata, headings, paragraphs, and structured data tables
 * - Standard 14 built-in Type1 fonts (Helvetica, Helvetica-Bold) for universal rendering
 * - Page headers, footers, timestamps, and page numbers ("Page X of Y")
 * - Optional printable HTML template with @media print CSS styling
 */

import type { ReportDocument, ColumnDefinition } from './types'

/** Escapes parentheses and backslashes for PDF string literals */
function escapePdfText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/** Wraps long text into multiple lines given a maximum character budget per line */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim()
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines.length > 0 ? lines : ['']
}

interface PageContent {
  commands: string[]
}

/**
 * Generates a valid %PDF-1.4 binary document from a structured ReportDocument.
 */
export function generatePdfDocument<T = Record<string, unknown>>(
  report: ReportDocument<T>
): Uint8Array {
  const pageWidth = 595.28 // Standard A4 width in points
  const pageHeight = 841.89 // Standard A4 height in points
  const leftMargin = 50
  const rightMargin = 50
  const topMargin = 55
  const bottomMargin = 55
  const contentWidth = pageWidth - leftMargin - rightMargin

  const pages: PageContent[] = []
  let currentPageCommands: string[] = []
  let currentY = pageHeight - topMargin

  const finishPage = () => {
    pages.push({ commands: currentPageCommands })
    currentPageCommands = []
    currentY = pageHeight - topMargin
  }

  const checkPageSpace = (neededHeight: number) => {
    if (currentY - neededHeight < bottomMargin) {
      finishPage()
    }
  }

  // --- 1. Document Title & Subtitle ---
  checkPageSpace(60)
  currentPageCommands.push(
    `BT /F2 20 Tf ${leftMargin} ${currentY} Td (${escapePdfText(report.title)}) Tj ET`
  )
  currentY -= 26

  if (report.subtitle) {
    checkPageSpace(20)
    currentPageCommands.push(
      `BT /F1 11 Tf 0.3 0.3 0.3 rg ${leftMargin} ${currentY} Td (${escapePdfText(report.subtitle)}) Tj 0 0 0 rg ET`
    )
    currentY -= 20
  }

  // Metadata rule & timestamp
  const dateStr = report.generatedAt
    ? new Date(report.generatedAt).toLocaleString()
    : new Date().toLocaleString()
  const authorStr = report.author ? ` | Author: ${report.author}` : ''
  const metaText = `Generated: ${dateStr}${authorStr}`

  currentPageCommands.push(
    `BT /F1 9 Tf 0.4 0.4 0.4 rg ${leftMargin} ${currentY} Td (${escapePdfText(metaText)}) Tj 0 0 0 rg ET`
  )
  currentY -= 15

  // Horizontal dividing line
  currentPageCommands.push(
    `0.8 0.8 0.8 RG 1 w ${leftMargin} ${currentY} m ${pageWidth - rightMargin} ${currentY} l S`
  )
  currentY -= 25

  // --- 2. Render Sections ---
  for (const section of report.sections) {
    if (section.type === 'page_break') {
      finishPage()
      continue
    }

    if (section.type === 'heading') {
      const headingText = section.content || ''
      const level = section.level || 1
      const fontSize = level === 1 ? 14 : level === 2 ? 12 : 11
      const fontId = '/F2'
      const spacingBefore = level === 1 ? 22 : 16
      const spacingAfter = level === 1 ? 14 : 10

      checkPageSpace(spacingBefore + spacingAfter + 10)
      currentY -= spacingBefore

      currentPageCommands.push(
        `BT ${fontId} ${fontSize} Tf 0.1 0.1 0.1 rg ${leftMargin} ${currentY} Td (${escapePdfText(headingText)}) Tj 0 0 0 rg ET`
      )
      currentY -= spacingAfter
    } else if (section.type === 'paragraph') {
      const text = section.content || ''
      const lines = wrapText(text, 82)
      const lineHeight = 14

      for (const line of lines) {
        checkPageSpace(lineHeight)
        currentPageCommands.push(
          `BT /F1 10 Tf 0.15 0.15 0.15 rg ${leftMargin} ${currentY} Td (${escapePdfText(line)}) Tj 0 0 0 rg ET`
        )
        currentY -= lineHeight
      }
      currentY -= 10
    } else if (section.type === 'key_value') {
      const kvData = (section.data as Record<string, unknown>) || {}
      for (const [k, v] of Object.entries(kvData)) {
        checkPageSpace(16)
        currentPageCommands.push(
          `BT /F2 10 Tf ${leftMargin} ${currentY} Td (${escapePdfText(k)}:) Tj ET`,
          `BT /F1 10 Tf ${leftMargin + 120} ${currentY} Td (${escapePdfText(String(v))}) Tj ET`
        )
        currentY -= 16
      }
      currentY -= 8
    } else if (section.type === 'table') {
      const records = (section.data as Array<Record<string, unknown>>) || []
      const columns: ColumnDefinition<T>[] = section.columns || (records.length > 0
        ? Object.keys(records[0]).map((k) => ({ key: k, header: k }))
        : [])

      if (columns.length > 0) {
        const colWidth = Math.floor(contentWidth / columns.length)
        const rowHeight = 18

        // Table Header
        checkPageSpace(rowHeight * 2)
        // Background fill for header
        currentPageCommands.push(
          `0.94 0.95 0.96 rg ${leftMargin} ${currentY - 4} ${contentWidth} ${rowHeight} re f 0 0 0 rg`
        )

        columns.forEach((col, idx) => {
          const x = leftMargin + idx * colWidth + 4
          currentPageCommands.push(
            `BT /F2 9 Tf 0.1 0.1 0.1 rg ${x} ${currentY} Td (${escapePdfText(col.header)}) Tj 0 0 0 rg ET`
          )
        })
        currentY -= rowHeight

        // Table Rows
        records.forEach((record, rowIdx) => {
          checkPageSpace(rowHeight)
          if (rowIdx % 2 === 1) {
            currentPageCommands.push(
              `0.98 0.98 0.98 rg ${leftMargin} ${currentY - 4} ${contentWidth} ${rowHeight} re f 0 0 0 rg`
            )
          }

          columns.forEach((col, idx) => {
            const rawVal = record[col.key]
            const val = col.formatter ? col.formatter(rawVal, record as T) : rawVal
            const cellText = val !== null && val !== undefined ? String(val) : ''
            const truncated = cellText.length > 25 ? cellText.substring(0, 22) + '...' : cellText
            const x = leftMargin + idx * colWidth + 4
            currentPageCommands.push(
              `BT /F1 9 Tf 0.2 0.2 0.2 rg ${x} ${currentY} Td (${escapePdfText(truncated)}) Tj 0 0 0 rg ET`
            )
          })
          currentY -= rowHeight
        })

        currentY -= 12
      }
    }
  }

  // Push final page
  finishPage()

  const totalPages = pages.length

  // Add Headers & Footers to all pages
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = pages[pageNum - 1]

    // Running Header
    if (report.headerText) {
      page.commands.unshift(
        `BT /F1 8 Tf 0.5 0.5 0.5 rg ${leftMargin} ${pageHeight - 35} Td (${escapePdfText(report.headerText)}) Tj 0 0 0 rg ET`,
        `0.85 0.85 0.85 RG 0.5 w ${leftMargin} ${pageHeight - 40} m ${pageWidth - rightMargin} ${pageHeight - 40} l S`
      )
    }

    // Running Footer with page numbering
    const footerParts: string[] = []
    if (report.footerText) {
      footerParts.push(report.footerText)
    }
    if (report.includePageNumbers !== false) {
      footerParts.push(`Page ${pageNum} of ${totalPages}`)
    }

    if (footerParts.length > 0) {
      page.commands.push(
        `0.85 0.85 0.85 RG 0.5 w ${leftMargin} 45 m ${pageWidth - rightMargin} 45 l S`,
        `BT /F1 8 Tf 0.5 0.5 0.5 rg ${leftMargin} 30 Td (${escapePdfText(footerParts.join('  |  '))}) Tj 0 0 0 rg ET`
      )
    }
  }

  // --- 3. Assemble PDF 1.4 Binary Streams and XRef Table ---
  const objects: string[] = []
  const xrefOffsets: number[] = []

  let binaryContent = '%PDF-1.4\r\n%âãÏÓ\r\n'

  const addObject = (body: string): number => {
    const objIndex = objects.length + 1
    xrefOffsets.push(binaryContent.length)
    const objStr = `${objIndex} 0 obj\r\n${body}\r\nendobj\r\n`
    binaryContent += objStr
    objects.push(objStr)
    return objIndex
  }

  // Font Objects (Helvetica & Helvetica-Bold)
  const f1Index = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const f2Index = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>')

  // Content Stream Objects for each page
  const contentIndices: number[] = []
  for (const page of pages) {
    const streamData = page.commands.join('\r\n')
    const contentIndex = addObject(
      `<< /Length ${streamData.length} >>\r\nstream\r\n${streamData}\r\nendstream`
    )
    contentIndices.push(contentIndex)
  }

  // Page Objects
  const pageIndices: number[] = []
  // Forward reference to Pages object
  const pagesObjIndex = objects.length + pages.length + 1

  for (let i = 0; i < pages.length; i++) {
    const pIndex = addObject(
      `<< /Type /Page /Parent ${pagesObjIndex} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentIndices[i]} 0 R /Resources << /Font << /F1 ${f1Index} 0 R /F2 ${f2Index} 0 R >> >> >>`
    )
    pageIndices.push(pIndex)
  }

  // Pages Object
  addObject(
    `<< /Type /Pages /Kids [${pageIndices.map((idx) => `${idx} 0 R`).join(' ')}] /Count ${pages.length} >>`
  )

  // Catalog Object
  const catalogIndex = addObject(`<< /Type /Catalog /Pages ${pagesObjIndex} 0 R >>`)

  // XRef Table & Trailer
  const startXref = binaryContent.length
  binaryContent += `xref\r\n0 ${objects.length + 1}\r\n`
  binaryContent += '0000000000 65535 f \r\n'

  for (const offset of xrefOffsets) {
    binaryContent += `${String(offset).padStart(10, '0')} 00000 n \r\n`
  }

  binaryContent += `trailer\r\n<< /Size ${objects.length + 1} /Root ${catalogIndex} 0 R >>\r\n`
  binaryContent += `startxref\r\n${startXref}\r\n%%EOF\r\n`

  return new TextEncoder().encode(binaryContent)
}

/**
 * Generates clean, printable HTML with @media print CSS rules for browser printing or headless export.
 */
export function generatePrintableHtml<T = Record<string, unknown>>(
  report: ReportDocument<T>
): string {
  const sectionsHtml = report.sections
    .map((s) => {
      if (s.type === 'page_break') return '<div class="page-break"></div>'
      if (s.type === 'heading') {
        const tag = s.level === 1 ? 'h2' : s.level === 2 ? 'h3' : 'h4'
        return `<${tag}>${escapeXml(s.content || '')}</${tag}>`
      }
      if (s.type === 'paragraph') {
        return `<p>${escapeXml(s.content || '')}</p>`
      }
      if (s.type === 'table') {
        const records = (s.data as Array<Record<string, unknown>>) || []
        const cols: ColumnDefinition<T>[] = s.columns || (records.length > 0 ? Object.keys(records[0]).map((k) => ({ key: k, header: k })) : [])
        const ths = cols.map((c) => `<th>${escapeXml(c.header)}</th>`).join('')
        const trs = records
          .map((r) => {
            const tds = cols
              .map((c) => {
                const val = c.formatter ? c.formatter(r[c.key], r as T) : r[c.key]
                return `<td>${escapeXml(val !== null && val !== undefined ? String(val) : '')}</td>`
              })
              .join('')
            return `<tr>${tds}</tr>`
          })
          .join('')
        return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`
      }
      return ''
    })
    .join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(report.title)}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; line-height: 1.5; margin: 0; padding: 24px; }
    h1 { font-size: 24px; margin-bottom: 4px; }
    .subtitle { color: #4B5563; font-size: 14px; margin-bottom: 12px; }
    .meta { font-size: 12px; color: #6B7280; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    th, td { border: 1px solid #E5E7EB; padding: 8px 12px; text-align: left; }
    th { background: #F9FAFB; font-weight: 600; }
    @media print { .page-break { page-break-after: always; } }
  </style>
</head>
<body>
  <h1>${escapeXml(report.title)}</h1>
  ${report.subtitle ? `<div class="subtitle">${escapeXml(report.subtitle)}</div>` : ''}
  <div class="meta">Generated: ${new Date().toLocaleString()} ${report.author ? `| Author: ${escapeXml(report.author)}` : ''}</div>
  ${sectionsHtml}
</body>
</html>`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
